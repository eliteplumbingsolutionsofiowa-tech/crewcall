import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveCompanyContext } from '@/lib/company-context'

export const dynamic = 'force-dynamic'

type UrgentBody = {
  jobId?: string
  durationHours?: number
}

type JobRow = {
  id: string
  company_id: string | null
  job_type: string | null
  status: string | null
}

function requireEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing ${name} environment variable.`)
  }

  return value
}

const supabaseUrl = requireEnv(
  'NEXT_PUBLIC_SUPABASE_URL'
)

const authClient = createClient(
  supabaseUrl,
  requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

const adminClient = createClient(
  supabaseUrl,
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get('authorization') || ''

  if (!authorization.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice(7).trim() || null
}

export async function POST(req: Request) {
  try {
    const accessToken = getBearerToken(req)

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 }
      )
    }

    const body =
      (await req.json()) as UrgentBody

    const jobId =
      typeof body.jobId === 'string'
        ? body.jobId.trim()
        : ''

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId.' },
        { status: 400 }
      )
    }

    const requestedDuration =
      Number(body.durationHours)

    const durationHours =
      Number.isFinite(requestedDuration) &&
      requestedDuration > 0
        ? Math.min(
            Math.floor(requestedDuration),
            24
          )
        : 24

    const { data: job, error: jobError } =
      await adminClient
        .from('jobs')
        .select(
          'id, company_id, job_type, status'
        )
        .eq('id', jobId)
        .eq('is_test', false)
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

    if (job.job_type !== 'worker_job') {
      return NextResponse.json(
        {
          error:
            'Urgent worker boosts are not available for contractor bid requests.',
          code: 'BID_REQUEST_JOB',
        },
        { status: 409 }
      )
    }

    if (job.status !== 'open') {
      return NextResponse.json(
        {
          error:
            'Only open worker jobs can be boosted.',
        },
        { status: 409 }
      )
    }

    const companyContext =
      await resolveCompanyContext(
        adminClient,
        user.id
      )

    const canManageJob =
      companyContext.isPlatformAdmin ||
      (
        companyContext.companyId ===
          job.company_id &&
        (
          companyContext.isCompanyOwner ||
          companyContext.teamRole === 'admin'
        )
      )

    if (!canManageJob) {
      return NextResponse.json(
        {
          error:
            'You do not have permission to boost this job.',
        },
        { status: 403 }
      )
    }

    const urgentUntil = new Date(
      Date.now() +
        durationHours * 60 * 60 * 1000
    ).toISOString()

    const { error: updateError } =
      await adminClient
        .from('jobs')
        .update({
          urgent: true,
          urgent_until: urgentUntil,
        })
        .eq('id', job.id)
        .eq('company_id', job.company_id!)
        .eq('job_type', 'worker_job')

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      urgent_until: urgentUntil,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Server error'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
