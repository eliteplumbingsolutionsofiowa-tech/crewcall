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
    .trim()
}

type InviteRequest = {
  jobId?: string
  workerId?: string
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
      (await req.json()) as InviteRequest

    const jobId =
      typeof body.jobId === 'string'
        ? body.jobId.trim()
        : ''

    const workerId =
      typeof body.workerId === 'string'
        ? body.workerId.trim()
        : ''

    if (!jobId || !workerId) {
      return NextResponse.json(
        { error: 'Missing jobId or workerId.' },
        { status: 400 }
      )
    }

    const {
      data: job,
      error: jobError,
    } = await adminClient
      .from('jobs')
      .select('id, title, company_id')
      .eq('id', jobId)
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

    if (job.company_id !== user.id) {
      return NextResponse.json(
        {
          error:
            'You are not authorized to invite workers to this job.',
        },
        { status: 403 }
      )
    }

    const {
      data: existingInvite,
      error: existingInviteError,
    } = await adminClient
      .from('job_invites')
      .select('id')
      .eq('company_id', user.id)
      .eq('worker_id', workerId)
      .eq('job_id', jobId)
      .maybeSingle()

    if (existingInviteError) {
      return NextResponse.json(
        { error: existingInviteError.message },
        { status: 400 }
      )
    }

    if (existingInvite) {
      return NextResponse.json(
        { error: 'Worker has already been invited.' },
        { status: 409 }
      )
    }

    const {
      data: invite,
      error: inviteError,
    } = await adminClient
      .from('job_invites')
      .insert({
        company_id: user.id,
        worker_id: workerId,
        job_id: jobId,
        status: 'pending',
        company_seen: true,
        worker_seen: false,
      })
      .select('id')
      .single()

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message },
        { status: 400 }
      )
    }

    const notificationBody =
      `You were invited to ${job.title || 'a CrewCall job'}.`

    const { error: notificationError } =
      await adminClient
        .from('notifications')
        .insert({
          user_id: workerId,
          type: 'job_invite',
          title: 'New Job Invite',
          body: notificationBody,
          link_url: '/invites',
          read: false,
          is_read: false,
          created_at: new Date().toISOString(),
        })

    if (notificationError) {
      console.error(
        'Unable to create invite notification:',
        notificationError
      )
    }

    const {
      data: devices,
      error: devicesError,
    } = await adminClient
      .from('device_tokens')
      .select('id, token')
      .eq('user_id', workerId)
      .eq('platform', 'ios')

    if (devicesError) {
      console.error(
        'Unable to load invite push devices:',
        devicesError
      )
    }

    for (const device of devices || []) {
      try {
        const result = await sendApnsPush({
          deviceToken: device.token,
          title: 'New Job Invite',
          body: notificationBody,
          url: '/invites',
          badge: 1,
        })

        if (result.status !== 200) {
          console.error(
            'APNs job invite push failed:',
            {
              deviceId: device.id,
              status: result.status,
              response: result.body,
            }
          )
        }
      } catch (pushError) {
        console.error(
          'Unable to send job invite push:',
          pushError
        )
      }
    }

    return NextResponse.json({
      success: true,
      inviteId: invite.id,
    })
  } catch (error) {
    console.error(
      'Job invite creation failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to invite worker.',
      },
      { status: 500 }
    )
  }
}
