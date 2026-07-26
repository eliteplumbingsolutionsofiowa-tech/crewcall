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

type DeleteJobRequest = {
  jobId?: string
  companyId?: string
}

type JobRow = {
  id: string
  company_id: string | null
  status: string | null
  payment_status: string | null
  payout_status: string | null
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

export async function POST(request: Request) {
  try {
    const accessToken = getBearerToken(request)

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
      (await request.json()) as DeleteJobRequest

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

    if (
      requestedCompanyId &&
      requestedCompanyId !== user.id
    ) {
      return NextResponse.json(
        {
          error:
            'You cannot delete a job for another company.',
        },
        { status: 403 }
      )
    }

    const { data: job, error: jobError } =
      await adminClient
        .from('jobs')
        .select(
          'id, company_id, status, payment_status, payout_status'
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

    if (job.company_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not own this job.' },
        { status: 403 }
      )
    }

    if (
      job.status === 'in_progress' ||
      job.status === 'completed'
    ) {
      return NextResponse.json(
        {
          error:
            'Jobs that are in progress or completed cannot be deleted.',
        },
        { status: 409 }
      )
    }

    if (
      job.payment_status === 'paid' ||
      job.payment_status === 'pending' ||
      job.payout_status === 'released'
    ) {
      return NextResponse.json(
        {
          error:
            'This job has payment activity and cannot be deleted.',
        },
        { status: 409 }
      )
    }

    const cleanupOperations = [
      adminClient
        .from('notifications')
        .delete()
        .eq('job_id', jobId),

      adminClient
        .from('messages')
        .delete()
        .eq('job_id', jobId),

      adminClient
        .from('applications')
        .delete()
        .eq('job_id', jobId),

      adminClient
        .from('job_invites')
        .delete()
        .eq('job_id', jobId),

      adminClient
        .from('job_files')
        .delete()
        .eq('job_id', jobId),

      adminClient
        .from('saved_jobs')
        .delete()
        .eq('job_id', jobId),

      adminClient
        .from('reviews')
        .delete()
        .eq('job_id', jobId),
    ]

    const cleanupResults = await Promise.all(
      cleanupOperations
    )

    const cleanupError = cleanupResults.find(
      (result) => result.error
    )?.error

    if (cleanupError) {
      console.error(
        'Job cleanup failed before deletion:',
        cleanupError
      )

      return NextResponse.json(
        {
          error:
            cleanupError.message ||
            'Unable to remove related job records.',
        },
        { status: 400 }
      )
    }

    const {
      error: conversationDeleteError,
    } = await adminClient
      .from('conversations')
      .delete()
      .eq('job_id', jobId)

    if (conversationDeleteError) {
      return NextResponse.json(
        {
          error:
            conversationDeleteError.message,
        },
        { status: 400 }
      )
    }

    const { data: deletedJob, error: deleteError } =
      await adminClient
        .from('jobs')
        .delete()
        .eq('id', jobId)
        .eq('company_id', user.id)
        .select('id')
        .maybeSingle()

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      )
    }

    if (!deletedJob) {
      return NextResponse.json(
        {
          error:
            'The job was not deleted. It may have already been removed.',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({
      success: true,
      deletedJobId: deletedJob.id,
    })
  } catch (error) {
    console.error('Job delete route failed:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete job.',
      },
      { status: 500 }
    )
  }
}