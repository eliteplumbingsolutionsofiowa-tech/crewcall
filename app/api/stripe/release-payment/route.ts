import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY

if (
  !stripeSecretKey ||
  !supabaseUrl ||
  !supabaseAnonKey ||
  !supabaseServiceRoleKey
) {
  throw new Error(
    'Missing required Stripe or Supabase environment variables.'
  )
}

const stripe = new Stripe(stripeSecretKey)

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

const PLATFORM_FEE_PERCENT = 10

type ReleasePaymentRequest = {
  jobId?: string
}

type JobRow = {
  id: string
  title: string | null
  status: string | null
  pay_rate: string | null
  payment_status: string | null
  payout_status: string | null
  company_id: string | null
  assigned_worker_id: string | null
  stripe_transfer_id: string | null
}

type WorkerRow = {
  id: string
  stripe_account_id: string | null
  stripe_charges_enabled: boolean | null
  stripe_payouts_enabled: boolean | null
  stripe_details_submitted: boolean | null
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

function centsFromPayRate(value: string | null) {
  if (!value) {
    return 0
  }

  const cleaned = String(value).replace(
    /[^0-9.]/g,
    ''
  )

  const dollars = Number(cleaned)

  if (
    !Number.isFinite(dollars) ||
    dollars <= 0
  ) {
    return 0
  }

  return Math.round(dollars * 100)
}

async function resetProcessingStatus(jobId: string) {
  const { error } = await adminClient
    .from('jobs')
    .update({
      payout_status: 'pending',
    })
    .eq('id', jobId)
    .eq('payout_status', 'processing')
    .is('stripe_transfer_id', null)

  if (error) {
    console.error(
      'Unable to reset payout processing status:',
      error
    )
  }
}

export async function POST(req: Request) {
  let lockedJobId: string | null = null

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
        | ReleasePaymentRequest
        | null

    const jobId = normalizeString(body?.jobId)

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId.' },
        { status: 400 }
      )
    }

    const { data: jobData, error: jobError } =
      await adminClient
        .from('jobs')
        .select(
          `
          id,
          title,
          status,
          pay_rate,
          payment_status,
          payout_status,
          company_id,
          assigned_worker_id,
          stripe_transfer_id
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

    if (!jobData) {
      return NextResponse.json(
        { error: 'Job not found.' },
        { status: 404 }
      )
    }

    const job = jobData

    if (job.company_id !== user.id) {
      return NextResponse.json(
        {
          error:
            'You do not own this job.',
        },
        { status: 403 }
      )
    }

    if (job.status !== 'completed') {
      return NextResponse.json(
        {
          error:
            'Job must be completed before releasing payment.',
        },
        { status: 409 }
      )
    }

    if (job.payment_status !== 'paid') {
      return NextResponse.json(
        {
          error:
            'Job must be paid before releasing payout.',
        },
        { status: 409 }
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
      job.stripe_transfer_id ||
      job.payout_status === 'released'
    ) {
      return NextResponse.json({
        success: true,
        alreadyReleased: true,
        message: 'Payout already released.',
        transferId: job.stripe_transfer_id,
      })
    }

    if (job.payout_status === 'processing') {
      return NextResponse.json(
        {
          success: false,
          processing: true,
          message:
            'Payout is already being processed.',
        },
        { status: 409 }
      )
    }

    const {
      data: workerData,
      error: workerError,
    } = await adminClient
      .from('profiles')
      .select(
        `
        id,
        stripe_account_id,
        stripe_charges_enabled,
        stripe_payouts_enabled,
        stripe_details_submitted
      `
      )
      .eq('id', job.assigned_worker_id)
      .maybeSingle<WorkerRow>()

    if (workerError) {
      return NextResponse.json(
        { error: workerError.message },
        { status: 400 }
      )
    }

    if (!workerData) {
      return NextResponse.json(
        { error: 'Worker profile not found.' },
        { status: 404 }
      )
    }

    const worker = workerData

    if (!worker.stripe_account_id) {
      return NextResponse.json(
        {
          error:
            'Worker has not connected Stripe.',
        },
        { status: 400 }
      )
    }

    if (!worker.stripe_details_submitted) {
      return NextResponse.json(
        {
          error:
            'Worker has not completed Stripe onboarding.',
        },
        { status: 400 }
      )
    }

    if (
      !worker.stripe_charges_enabled ||
      !worker.stripe_payouts_enabled
    ) {
      return NextResponse.json(
        {
          error:
            'Worker Stripe account is not fully enabled yet.',
        },
        { status: 400 }
      )
    }

    const grossAmount = centsFromPayRate(
      job.pay_rate
    )

    if (grossAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid job pay amount.' },
        { status: 400 }
      )
    }

    const platformFee = Math.round(
      grossAmount *
        (PLATFORM_FEE_PERCENT / 100)
    )

    const workerAmount =
      grossAmount - platformFee

    if (workerAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid payout amount.' },
        { status: 400 }
      )
    }

    const {
      data: lockedJob,
      error: lockError,
    } = await adminClient
      .from('jobs')
      .update({
        payout_status: 'processing',
      })
      .eq('id', job.id)
      .eq('company_id', user.id)
      .eq('status', 'completed')
      .eq('payment_status', 'paid')
      .is('stripe_transfer_id', null)
      .neq('payout_status', 'released')
      .neq('payout_status', 'processing')
      .select('id')
      .maybeSingle()

    if (lockError) {
      return NextResponse.json(
        { error: lockError.message },
        { status: 400 }
      )
    }

    if (!lockedJob) {
      const {
        data: currentJob,
      } = await adminClient
        .from('jobs')
        .select(
          'payout_status, stripe_transfer_id'
        )
        .eq('id', job.id)
        .maybeSingle()

      if (
        currentJob?.stripe_transfer_id ||
        currentJob?.payout_status ===
          'released'
      ) {
        return NextResponse.json({
          success: true,
          alreadyReleased: true,
          message:
            'Payout already released.',
          transferId:
            currentJob.stripe_transfer_id,
        })
      }

      return NextResponse.json(
        {
          success: false,
          processing: true,
          message:
            'Payout is already processing.',
        },
        { status: 409 }
      )
    }

    lockedJobId = job.id

    let transfer: Stripe.Transfer

    try {
      transfer = await stripe.transfers.create(
        {
          amount: workerAmount,
          currency: 'usd',
          destination:
            worker.stripe_account_id,
          description: `CrewCall payout for ${
            job.title || 'job'
          }`,
          metadata: {
            job_id: job.id,
            company_id: user.id,
            worker_id:
              job.assigned_worker_id,
            gross_amount_cents: String(
              grossAmount
            ),
            platform_fee_cents: String(
              platformFee
            ),
            worker_amount_cents: String(
              workerAmount
            ),
          },
        },
        {
          idempotencyKey:
            `crewcall-job-payout-${job.id}`,
        }
      )
    } catch (stripeError) {
      await resetProcessingStatus(job.id)
      lockedJobId = null

      console.error(
        'Stripe payout transfer failed:',
        stripeError
      )

      return NextResponse.json(
        {
          error:
            stripeError instanceof Error
              ? stripeError.message
              : 'Stripe payout transfer failed.',
        },
        { status: 502 }
      )
    }

    const releasedAt =
      new Date().toISOString()

    const {
      data: releasedJob,
      error: updateError,
    } = await adminClient
      .from('jobs')
      .update({
        payout_status: 'released',
        stripe_transfer_id: transfer.id,
        platform_fee_cents: platformFee,
        worker_payout_cents: workerAmount,
        payout_released_at: releasedAt,
      })
      .eq('id', job.id)
      .eq('company_id', user.id)
      .eq('payout_status', 'processing')
      .is('stripe_transfer_id', null)
      .select(
        `
        id,
        payout_status,
        stripe_transfer_id,
        platform_fee_cents,
        worker_payout_cents,
        payout_released_at
      `
      )
      .maybeSingle()

    if (updateError) {
      console.error(
        'Stripe transfer succeeded but database update failed:',
        {
          jobId: job.id,
          transferId: transfer.id,
          error: updateError,
        }
      )

      return NextResponse.json(
        {
          error:
            'The payout was sent, but CrewCall could not save the payout record. Contact support before trying again.',
          transferId: transfer.id,
        },
        { status: 500 }
      )
    }

    if (!releasedJob) {
      console.error(
        'Stripe transfer succeeded but payout row was not finalized:',
        {
          jobId: job.id,
          transferId: transfer.id,
        }
      )

      return NextResponse.json(
        {
          error:
            'The payout was sent, but CrewCall could not finalize the payout record. Contact support before trying again.',
          transferId: transfer.id,
        },
        { status: 500 }
      )
    }

    lockedJobId = null

    const {
      error: notificationError,
    } = await adminClient
      .from('notifications')
      .insert({
        user_id:
          job.assigned_worker_id,
        type: 'payout',
        title: 'Payout released',
        body: `Your payout for ${
          job.title || 'this job'
        } has been released.`,
        message: `Your payout for ${
          job.title || 'this job'
        } has been released.`,
        link_url: `/jobs/${job.id}`,
        job_id: job.id,
        read: false,
        is_read: false,
        created_at: releasedAt,
      })

    if (notificationError) {
      console.error(
        'Unable to create payout notification:',
        notificationError
      )
    }

    return NextResponse.json({
      success: true,
      transferId: transfer.id,
      grossAmount,
      platformFee,
      workerAmount,
      releasedAt,
      payout: releasedJob,
    })
  } catch (error) {
    if (lockedJobId) {
      await resetProcessingStatus(lockedJobId)
    }

    console.error(
      'Release payment route failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to release payment.',
      },
      { status: 500 }
    )
  }
}