import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { resolveCompanyContext } from '@/lib/company-context'

export const dynamic = 'force-dynamic'

type UrgentCheckoutBody = {
  jobId?: string
  plan?: string
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

const supabaseAnonKey = requireEnv(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
)

const supabaseServiceRoleKey = requireEnv(
  'SUPABASE_SERVICE_ROLE_KEY'
)

const authClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
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

function getStripeClient() {
  return new Stripe(
    requireEnv('STRIPE_SECRET_KEY'),
    {
      apiVersion: '2026-04-22.dahlia',
    }
  )
}

function getBaseUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL

  if (!baseUrl) {
    throw new Error(
      'Missing NEXT_PUBLIC_BASE_URL environment variable.'
    )
  }

  if (baseUrl.startsWith('http')) {
    return baseUrl
  }

  return `https://${baseUrl}`
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
      (await req.json()) as UrgentCheckoutBody

    const jobId =
      typeof body.jobId === 'string'
        ? body.jobId.trim()
        : ''

    const plan =
      body.plan === 'premium'
        ? 'premium'
        : 'standard'

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
          'id, company_id, job_type, status'
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

    const stripe = getStripeClient()
    const baseUrl = getBaseUrl()

    const isPremium = plan === 'premium'
    const amount = isPremium ? 4900 : 2500

    const session =
      await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: isPremium
                  ? 'Urgent Job Boost (Premium 24h + SMS)'
                  : 'Urgent Job Boost (24h)',
                description:
                  'Boost your job to the top of search and mark it as urgent.',
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        metadata: {
          jobId,
          plan,
          purchasedBy: user.id,
          companyId: job.company_id || '',
          jobType: 'worker_job',
        },
        success_url:
          `${baseUrl}/jobs?urgent_success=true` +
          `&jobId=${encodeURIComponent(jobId)}` +
          `&plan=${encodeURIComponent(plan)}`,
        cancel_url: `${baseUrl}/billing`,
      })

    return NextResponse.json({
      url: session.url,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Stripe error'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
