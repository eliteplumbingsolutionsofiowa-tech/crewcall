import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendApnsPush } from '@/lib/push/apns'

export const runtime = 'nodejs'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY

if (
  !supabaseUrl ||
  !supabaseAnonKey ||
  !serviceRoleKey
) {
  throw new Error(
    'Missing required Supabase environment variables.'
  )
}

const authClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

const adminClient = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get('authorization')

  if (
    !authorization ||
    !authorization.startsWith('Bearer ')
  ) {
    return null
  }

  return authorization
    .slice('Bearer '.length)
    .trim() || null
}

type AcceptInviteRequest = {
  inviteId?: string
}

export async function POST(req: Request) {
  try {
    const accessToken = getBearerToken(req)

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authorization token required.' },
        { status: 401 }
      )
    }

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(
      accessToken
    )

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unable to verify user.' },
        { status: 401 }
      )
    }

    const body =
      (await req.json()) as AcceptInviteRequest

    const inviteId =
      typeof body.inviteId === 'string'
        ? body.inviteId.trim()
        : ''

    if (!inviteId) {
      return NextResponse.json(
        { error: 'Missing inviteId.' },
        { status: 400 }
      )
    }

    const {
      data: invite,
      error: inviteLookupError,
    } = await adminClient
      .from('job_invites')
      .select(
        `
        id,
        job_id,
        worker_id,
        company_id,
        status
      `
      )
      .eq('id', inviteId)
      .maybeSingle()

    if (inviteLookupError) {
      return NextResponse.json(
        { error: inviteLookupError.message },
        { status: 400 }
      )
    }

    if (!invite) {
      return NextResponse.json(
        { error: 'Invite not found.' },
        { status: 404 }
      )
    }

    if (invite.worker_id !== user.id) {
      return NextResponse.json(
        {
          error:
            'You cannot accept another worker’s invite.',
        },
        { status: 403 }
      )
    }

    if (invite.status === 'accepted') {
      return NextResponse.json({
        success: true,
        alreadyAccepted: true,
      })
    }

    if (invite.status !== 'pending') {
      return NextResponse.json(
        {
          error:
            'This invite is no longer available.',
        },
        { status: 409 }
      )
    }

    const {
      data: job,
      error: jobError,
    } = await adminClient
      .from('jobs')
      .select(
        `
        id,
        title,
        company_id,
        status,
        assigned_worker_id
      `
      )
      .eq('id', invite.job_id)
      .maybeSingle()

    if (jobError) {
      return NextResponse.json(
        { error: jobError.message },
        { status: 400 }
      )
    }

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found.' },
        { status: 404 }
      )
    }

    if (
      !job.company_id ||
      job.company_id !== invite.company_id
    ) {
      return NextResponse.json(
        {
          error:
            'Invite company does not match job company.',
        },
        { status: 409 }
      )
    }

    if (
      job.assigned_worker_id &&
      job.assigned_worker_id !== user.id
    ) {
      return NextResponse.json(
        {
          error:
            'This job already has another worker assigned.',
        },
        { status: 409 }
      )
    }

    const { error: jobUpdateError } =
      await adminClient
        .from('jobs')
        .update({
          status: 'assigned',
          assigned_worker_id: user.id,
        })
        .eq('id', job.id)

    if (jobUpdateError) {
      return NextResponse.json(
        { error: jobUpdateError.message },
        { status: 400 }
      )
    }

    const { error: inviteUpdateError } =
      await adminClient
        .from('job_invites')
        .update({
          status: 'accepted',
          worker_seen: true,
          company_seen: false,
        })
        .eq('id', invite.id)

    if (inviteUpdateError) {
      return NextResponse.json(
        { error: inviteUpdateError.message },
        { status: 400 }
      )
    }

    const { error: applicationError } =
      await adminClient
        .from('applications')
        .upsert(
          {
            job_id: job.id,
            worker_id: user.id,
            status: 'accepted',
          },
          {
            onConflict: 'job_id,worker_id',
          }
        )

    if (applicationError) {
      console.error(
        'Unable to update invite application:',
        applicationError
      )
    }

    const notificationBody =
      `A worker accepted your invite for ${
        job.title || 'your CrewCall job'
      }.`

    const { error: notificationError } =
      await adminClient
        .from('notifications')
        .insert({
          user_id: job.company_id,
          type: 'job_invite_accepted',
          title: 'Job Invite Accepted',
          body: notificationBody,
          link_url: `/my-jobs/${job.id}`,
          read: false,
          is_read: false,
          created_at:
            new Date().toISOString(),
        })

    if (notificationError) {
      console.error(
        'Unable to create accepted invite notification:',
        notificationError
      )
    }

    try {
      const {
        data: companyDevices,
        error: companyDevicesError,
      } = await adminClient
        .from('device_tokens')
        .select('id, token')
        .eq('user_id', job.company_id)
        .eq('platform', 'ios')

      if (companyDevicesError) {
        console.error(
          'Unable to load invite accepted push devices:',
          companyDevicesError
        )
      } else {
        for (
          const device of companyDevices || []
        ) {
          try {
            const result =
              await sendApnsPush({
                deviceToken: device.token,
                title:
                  'Job Invite Accepted',
                body: notificationBody,
                url: `/my-jobs/${job.id}`,
                badge: 1,
              })

            if (result.status !== 200) {
              console.error(
                'Invite accepted push failed:',
                {
                  deviceId: device.id,
                  status: result.status,
                  response: result.body,
                }
              )
            }
          } catch (pushError) {
            console.error(
              'Unable to send invite accepted push:',
              pushError
            )
          }
        }
      }
    } catch (pushError) {
      console.error(
        'Invite accepted push delivery failed:',
        pushError
      )
    }

    return NextResponse.json({
      success: true,
      job,
    })
  } catch (error) {
    console.error(
      'Accept invite route failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Accept failed.',
      },
      { status: 500 }
    )
  }
}
