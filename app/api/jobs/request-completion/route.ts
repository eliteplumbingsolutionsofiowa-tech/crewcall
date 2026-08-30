import { NextResponse } from 'next/server'
import { sendApnsPush } from '@/lib/push/apns'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY

if (
  !supabaseUrl ||
  !supabaseAnonKey ||
  !supabaseServiceRoleKey
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
  supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

type RequestBody = {
  jobId?: string
}

type JobRow = {
  id: string
  title: string | null
  company_id: string | null
  assigned_worker_id: string | null
  status: string | null
}

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
    } = await authClient.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            userError?.message ||
            'Unable to verify the authenticated user.',
        },
        { status: 401 }
      )
    }

    const body =
      (await req.json().catch(() => null)) as
        | RequestBody
        | null

    const jobId =
      typeof body?.jobId === 'string'
        ? body.jobId.trim()
        : ''

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId.' },
        { status: 400 }
      )
    }

    const { data: job, error: jobError } =
      await adminClient
        .from('jobs')
        .select(
          'id, title, company_id, assigned_worker_id, status'
        )
        .eq('id', jobId)
        .maybeSingle<JobRow>()

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

    if (job.assigned_worker_id !== user.id) {
      return NextResponse.json(
        {
          error:
            'Only the assigned worker can request completion.',
        },
        { status: 403 }
      )
    }

    if (!job.company_id) {
      return NextResponse.json(
        {
          error:
            'This job does not have a company attached.',
        },
        { status: 400 }
      )
    }

    if (
      job.status !== 'assigned' &&
      job.status !== 'in_progress'
    ) {
      return NextResponse.json(
        {
          error:
            'Only active assigned jobs can request completion.',
        },
        { status: 409 }
      )
    }

    const createdAt = new Date().toISOString()

    const { error: completionError } = await adminClient
      .from('jobs')
      .update({
        completion_status: 'submitted',
        completion_submitted_at: createdAt,
      })
      .eq('id', job.id)
      .eq('assigned_worker_id', user.id)

    if (completionError) {
      return NextResponse.json(
        { error: completionError.message },
        { status: 400 }
      )
    }

    const { data: teamMembers, error: teamMembersError } =
      await adminClient
        .from('company_team_members')
        .select('user_id')
        .eq('company_id', job.company_id)
        .eq('status', 'joined')

    if (teamMembersError) {
      return NextResponse.json(
        { error: teamMembersError.message },
        { status: 400 }
      )
    }

    const recipientIds = Array.from(
      new Set(
        [
          job.company_id,
          ...(teamMembers || []).map((member) => member.user_id),
        ].filter((userId): userId is string => Boolean(userId))
      )
    )

    const notificationRows = recipientIds.map((recipientId) => ({
      user_id: recipientId,
      type: 'job',
      title: 'Work ready for approval',
      body: `${job.title || 'Your CrewCall job'} has been submitted for approval.`,
      link_url: `/my-jobs/${job.id}`,
      read: false,
      is_read: false,
      created_at: createdAt,
    }))

    const { error: notificationError } = await adminClient
      .from('notifications')
      .insert(notificationRows)

    if (notificationError) {
      return NextResponse.json(
        { error: notificationError.message },
        { status: 400 }
      )
    }

    try {
      const {
        data: companyDevices,
        error: companyDevicesError,
      } = await adminClient
        .from('device_tokens')
        .select('id, token, user_id')
        .in('user_id', recipientIds)
        .eq('platform', 'ios')

      if (companyDevicesError) {
        console.error(
          'Unable to load completion request push devices:',
          companyDevicesError
        )
      } else {
        const pushBody = `${
          job.title || 'Your CrewCall job'
        } has been submitted for approval.`

        for (const device of companyDevices || []) {
          try {
            const result = await sendApnsPush({
              deviceToken: device.token,
              title: 'Work Ready for Approval',
              body: pushBody,
              url: `/my-jobs/${job.id}`,
              badge: 1,
            })

            if (result.status !== 200) {
              console.error(
                'Completion request push failed:',
                {
                  deviceId: device.id,
                  status: result.status,
                  response: result.body,
                }
              )
            }
          } catch (pushError) {
            console.error(
              'Unable to send completion request push:',
              pushError
            )
          }
        }
      }
    } catch (pushError) {
      console.error(
        'Completion request push delivery failed:',
        pushError
      )
    }

    return NextResponse.json({
      success: true,
      message:
        'Completion request sent to the company.',
    })
  } catch (error) {
    console.error(
      'Request completion route failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to request completion.',
      },
      { status: 500 }
    )
  }
}
