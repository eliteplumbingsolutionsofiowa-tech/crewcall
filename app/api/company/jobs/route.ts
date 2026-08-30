import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveCompanyContext } from '@/lib/company-context'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null

const authClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length).trim()
}

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin || !authClient) {
      return NextResponse.json(
        { error: 'Supabase authentication is not fully configured.' },
        { status: 500 }
      )
    }

    const token = getBearerToken(request)

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      )
    }

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session.' },
        { status: 401 }
      )
    }

    const companyContext = await resolveCompanyContext(
      supabaseAdmin,
      user.id
    )

    if (!companyContext.companyId) {
      return NextResponse.json(
        { error: 'Company access required.' },
        { status: 403 }
      )
    }

    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from('jobs')
      .select(`
        id,
        title,
        description,
        trade,
        location,
        pay_rate,
        start_date,
        status,
        payment_status,
        payout_status,
        company_id,
        assigned_worker_id,
        completion_status,
        completion_submitted_at,
        created_at
      `)
      .eq('company_id', companyContext.companyId)
      .order('created_at', { ascending: false })

    if (jobsError) {
      return NextResponse.json(
        { error: jobsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      companyId: companyContext.companyId,
      jobs: jobs || [],
    })
  } catch (error) {
    console.error('Company jobs API error:', error)

    return NextResponse.json(
      { error: 'Unable to load company jobs.' },
      { status: 500 }
    )
  }
}


export async function POST(request: Request) {
  try {
    if (!supabaseAdmin || !authClient) {
      return NextResponse.json(
        { error: 'Supabase authentication is not fully configured.' },
        { status: 500 }
      )
    }

    const token = getBearerToken(request)

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      )
    }

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session.' },
        { status: 401 }
      )
    }

    const body = (await request.json()) as {
      jobId?: string
      status?: string
    }

    const jobId = String(body.jobId || '').trim()
    const status = String(body.status || '').trim().toLowerCase()

    const allowedStatuses = new Set([
      'open',
      'active',
      'completed',
      'cancelled',
    ])

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing job ID.' },
        { status: 400 }
      )
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json(
        { error: 'Invalid job status.' },
        { status: 400 }
      )
    }

    const companyContext = await resolveCompanyContext(
      supabaseAdmin,
      user.id
    )

    if (!companyContext.companyId) {
      return NextResponse.json(
        { error: 'Company access required.' },
        { status: 403 }
      )
    }

    const canManageJobs =
      companyContext.isPlatformAdmin ||
      companyContext.isCompanyOwner ||
      (
        companyContext.isTeamMember &&
        companyContext.teamRole === 'admin'
      )

    if (!canManageJobs) {
      return NextResponse.json(
        { error: 'You do not have permission to manage this job.' },
        { status: 403 }
      )
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select(
        'id, company_id, status, payment_status, payout_status, assigned_worker_id'
      )
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

    if (
      !companyContext.isPlatformAdmin &&
      job.company_id !== companyContext.companyId
    ) {
      return NextResponse.json(
        { error: 'You do not have permission to manage this job.' },
        { status: 403 }
      )
    }

    /*
      Once payment activity exists, ordinary company controls
      cannot move the job backward or bypass CrewCall's
      completion / payout workflow.
    */
    if (
      job.payment_status === 'paid' ||
      job.payment_status === 'pending' ||
      job.payout_status === 'processing' ||
      job.payout_status === 'released'
    ) {
      return NextResponse.json(
        {
          error:
            job.payment_status === 'paid'
              ? 'Funds are secured for this job. Its status can only change through the CrewCall completion and payout workflow.'
              : 'This job has payment activity and cannot be changed through ordinary job controls.',
          fundedLocked: job.payment_status === 'paid',
        },
        { status: 409 }
      )
    }

    const { data: updatedJob, error: updateError } =
      await supabaseAdmin
        .from('jobs')
        .update({ status })
        .eq('id', job.id)
        .eq('company_id', job.company_id)
        .neq('payment_status', 'paid')
        .neq('payment_status', 'pending')
        .select('id, status, payment_status, payout_status')
        .maybeSingle()

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    if (!updatedJob) {
      return NextResponse.json(
        {
          error:
            'The job changed before the update completed. Refresh and try again.',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({
      success: true,
      job: updatedJob,
    })
  } catch (error) {
    console.error('Company job status update error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update job status.',
      },
      { status: 500 }
    )
  }
}
