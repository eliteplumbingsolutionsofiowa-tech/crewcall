import { NextResponse } from 'next/server'
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

    const { error: notificationError } =
      await adminClient
        .from('notifications')
        .insert({
          user_id: job.company_id,
          type: 'completion_requested',
          title: 'Worker says job is complete',
          body: `The worker assigned to ${
            job.title || 'your job'
          } says the work is complete.`,
          message: `The worker assigned to ${
            job.title || 'your job'
          } says the work is complete. Review the job and mark it complete when ready.`,
          job_id: job.id,
          link_url: `/my-jobs/${job.id}`,
          read: false,
          is_read: false,
          created_at: createdAt,
        })

    if (notificationError) {
      return NextResponse.json(
        { error: notificationError.message },
        { status: 400 }
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
