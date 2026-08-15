import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
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

type CompleteJobRequest = {
  jobId?: string
  companyId?: string
}

type JobRow = {
  id: string
  company_id: string | null
  assigned_worker_id: string | null
  status: string | null
  payment_status: string | null
  completed_at: string | null
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

  const token = authorization
    .slice('Bearer '.length)
    .trim()

  return token || null
}

function normalizeString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed || null
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

    const payload =
      (await req.json()) as CompleteJobRequest

    const jobId = normalizeString(payload.jobId)
    const requestedCompanyId = normalizeString(
      payload.companyId
    )

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
          `
          id,
          company_id,
          assigned_worker_id,
          status,
          payment_status,
          completed_at
        `
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

    const isCompanyUser =
      job.company_id === user.id

    const isAssignedWorker =
      job.assigned_worker_id === user.id

    if (!isCompanyUser && !isAssignedWorker) {
      return NextResponse.json(
        {
          error:
            'You do not have permission to complete this job.',
        },
        { status: 403 }
      )
    }

    if (
      job.status === 'completed' ||
      job.completed_at
    ) {
      return NextResponse.json(
        {
          success: true,
          message: 'Job is already completed.',
          alreadyCompleted: true,
        },
        { status: 200 }
      )
    }

    if (!job.assigned_worker_id) {
      return NextResponse.json(
        {
          error:
            'No worker is assigned to this job.',
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
            'Only assigned or in-progress jobs can be completed.',
        },
        { status: 409 }
      )
    }

    if (job.payment_status !== 'paid') {
      return NextResponse.json(
        {
          error:
            'Job must be paid before it can be completed.',
        },
        { status: 409 }
      )
    }

    const completedAt = new Date().toISOString()

    const {
      data: completedJob,
      error: updateError,
    } = await adminClient
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: completedAt,
        completion_status: 'approved',
        completion_approved_at: completedAt,
      })
      .eq('id', jobId)
      .in('status', ['assigned', 'in_progress'])
      .select(
        'id, company_id, assigned_worker_id, status, completed_at'
      )
      .maybeSingle()

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    if (!completedJob) {
      return NextResponse.json(
        {
          error:
            'The job was not completed because its status changed. Refresh and try again.',
        },
        { status: 409 }
      )
    }

    const notificationResults =
      isAssignedWorker
        ? await Promise.allSettled([
            adminClient.from('notifications').insert({
              user_id: job.company_id,
              type: 'job_completed',
              title: 'Worker completed job',
              body:
                'The assigned worker marked the job as completed.',
              message:
                'The assigned worker marked the job as completed.',
              job_id: jobId,
              link_url: `/my-jobs/${jobId}`,
              read: false,
              is_read: false,
              created_at: completedAt,
            } as never),
          ])
        : await Promise.allSettled([
            adminClient.from('notifications').insert({
              user_id: job.assigned_worker_id,
              type: 'job_completed',
              title: 'Job completed',
              body:
                'The company marked your job as completed.',
              message:
                'The company marked your job as completed.',
              job_id: jobId,
              link_url: `/jobs/${jobId}`,
              read: false,
              is_read: false,
              created_at: completedAt,
            } as never),
          ])

    for (const result of notificationResults) {
      if (
        result.status === 'rejected' ||
        result.value.error
      ) {
        console.error(
          'Unable to create completion notification:',
          result.status === 'rejected'
            ? result.reason
            : result.value.error
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Job marked completed.',
      job: completedJob,
    })
  } catch (error) {
    console.error('Job complete route failed:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to complete job.',
      },
      { status: 500 }
    )
  }
}