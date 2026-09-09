import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { resolveCompanyContext } from '@/lib/company-context'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getEnv(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Missing ${name}`)
  }

  return value
}

const stripeSecretKey = getEnv('STRIPE_SECRET_KEY')
const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseAnonKey = getEnv(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
)
const supabaseServiceRoleKey = getEnv(
  'SUPABASE_SERVICE_ROLE_KEY'
)

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

type RefundJobRequest = {
  jobId?: string
  reason?: string
  confirmed?: boolean
}

type JobRow = {
  id: string
  title: string | null
  company_id: string | null
  assigned_worker_id: string | null
  job_type: string | null
  status: string | null
  payment_status: string | null
  payout_status: string | null
  escrow_status: string | null
  escrow_amount_cents: number | null
  stripe_payment_intent_id: string | null
  stripe_transfer_id: string | null
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

  return (
    authorization
      .slice('Bearer '.length)
      .trim() || null
  )
}

function normalizeString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const clean = value.trim()
  return clean || null
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

    const body =
      (await request.json().catch(() => null)) as
        | RefundJobRequest
        | null

    const jobId = normalizeString(body?.jobId)
    const reason = normalizeString(body?.reason)

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing job ID.' },
        { status: 400 }
      )
    }

    if (body?.confirmed !== true) {
      return NextResponse.json(
        {
          error:
            'Refund confirmation is required.',
          code: 'REFUND_CONFIRMATION_REQUIRED',
        },
        { status: 400 }
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
          assigned_worker_id,
          job_type,
          status,
          payment_status,
          payout_status,
          escrow_status,
          escrow_amount_cents,
          stripe_payment_intent_id,
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
            'Contractor bid requests cannot use the worker refund flow.',
        },
        { status: 409 }
      )
    }

    const companyContext =
      await resolveCompanyContext(
        adminClient,
        user.id
      )

    const canManagePayments =
      companyContext.isPlatformAdmin ||
      companyContext.isCompanyOwner ||
      (
        companyContext.isTeamMember &&
        companyContext.companyId ===
          job.company_id &&
        companyContext.teamRole === 'admin'
      )

    if (
      !canManagePayments ||
      (
        !companyContext.isPlatformAdmin &&
        companyContext.companyId !==
          job.company_id
      )
    ) {
      return NextResponse.json(
        {
          error:
            'You do not have permission to refund this job.',
        },
        { status: 403 }
      )
    }

    /*
      Never allow the simple refund flow after
      worker payout has begun or completed.
    */
    if (
      job.stripe_transfer_id ||
      job.payout_status === 'released' ||
      job.payout_status === 'processing'
    ) {
      return NextResponse.json(
        {
          error:
            'This payment cannot be automatically refunded because the worker payout has already started or been released.',
          code: 'PAYOUT_ALREADY_STARTED',
        },
        { status: 409 }
      )
    }

    if (
      job.payment_status !== 'paid' ||
      job.escrow_status !== 'funded'
    ) {
      return NextResponse.json(
        {
          error:
            'This job does not have secured funds available for refund.',
          code: 'FUNDS_NOT_AVAILABLE',
        },
        { status: 409 }
      )
    }

    const amountCents =
      job.escrow_amount_cents || 0

    if (amountCents <= 0) {
      return NextResponse.json(
        {
          error:
            'CrewCall could not determine the secured payment amount.',
        },
        { status: 409 }
      )
    }

    if (!job.stripe_payment_intent_id) {
      return NextResponse.json(
        {
          error:
            'CrewCall could not locate the original Stripe payment.',
          code: 'PAYMENT_INTENT_MISSING',
        },
        { status: 409 }
      )
    }

    /*
      Check our own audit record first.
    */
    const {
      data: existingRefund,
      error: existingRefundError,
    } = await adminClient
      .from('job_refunds')
      .select(
        'id, status, stripe_refund_id, amount_cents'
      )
      .eq('job_id', job.id)
      .maybeSingle()

    if (existingRefundError) {
      return NextResponse.json(
        { error: existingRefundError.message },
        { status: 500 }
      )
    }

    if (
      existingRefund?.status === 'succeeded'
    ) {
      return NextResponse.json({
        success: true,
        alreadyRefunded: true,
        refundId:
          existingRefund.stripe_refund_id,
        amountCents:
          existingRefund.amount_cents,
      })
    }

    if (
      existingRefund?.status === 'processing'
    ) {
      return NextResponse.json(
        {
          error:
            'A refund for this job is already being processed.',
          code: 'REFUND_PROCESSING',
        },
        { status: 409 }
      )
    }

    const requestedAt =
      new Date().toISOString()

    /*
      Atomically claim the secured funds for refund.
      claim_job_refund and claim_job_payout both lock
      the same jobs row, so refund and payout cannot
      win at the same time.
    */
    const {
      data: refundClaimed,
      error: refundClaimError,
    } = await adminClient.rpc(
      'claim_job_refund',
      {
        p_job_id: job.id,
      }
    )

    if (refundClaimError) {
      return NextResponse.json(
        {
          error:
            'CrewCall could not safely lock this payment for refund.',
        },
        { status: 500 }
      )
    }

    if (!refundClaimed) {
      const {
        data: currentJob,
      } = await adminClient
        .from('jobs')
        .select(
          'payout_status, stripe_transfer_id, payment_status, escrow_status'
        )
        .eq('id', job.id)
        .maybeSingle()

      if (
        currentJob?.stripe_transfer_id ||
        currentJob?.payout_status ===
          'released' ||
        currentJob?.payout_status ===
          'processing'
      ) {
        return NextResponse.json(
          {
            error:
              'This payment cannot be refunded because worker payout has already started or been released.',
            code: 'PAYOUT_ALREADY_STARTED',
          },
          { status: 409 }
        )
      }

      if (
        currentJob?.payout_status ===
          'refund_processing'
      ) {
        return NextResponse.json(
          {
            error:
              'A refund for this job is already being processed.',
            code: 'REFUND_PROCESSING',
          },
          { status: 409 }
        )
      }

      if (
        currentJob?.payout_status ===
          'refunded' ||
        currentJob?.payment_status ===
          'refunded' ||
        currentJob?.escrow_status ===
          'refunded'
      ) {
        return NextResponse.json({
          success: true,
          alreadyRefunded: true,
        })
      }

      return NextResponse.json(
        {
          error:
            'This payment is no longer eligible for an automatic refund.',
          code: 'REFUND_NOT_AVAILABLE',
        },
        { status: 409 }
      )
    }

    /*
      Create the refund audit record on the first attempt.
      A previously failed attempt reuses the same job audit
      row so unique(job_id) remains our one-refund-per-job
      protection while still allowing a safe retry.
    */
    const refundRecordPayload = {
      company_id: job.company_id,
      requested_by: user.id,
      worker_id:
        job.assigned_worker_id,
      amount_cents: amountCents,
      stripe_payment_intent_id:
        job.stripe_payment_intent_id,
      reason,
      status: 'processing',
      requested_at: requestedAt,
      refunded_at: null,
      failure_message: null,
      updated_at: requestedAt,
    }

    const refundRecordResult =
      existingRefund?.status === 'failed'
        ? await adminClient
            .from('job_refunds')
            .update(refundRecordPayload)
            .eq('job_id', job.id)
            .eq('status', 'failed')
            .select('id')
            .maybeSingle()
        : await adminClient
            .from('job_refunds')
            .insert({
              job_id: job.id,
              ...refundRecordPayload,
            })
            .select('id')
            .maybeSingle()

    const refundRecordError =
      refundRecordResult.error

    if (
      !refundRecordError &&
      !refundRecordResult.data
    ) {
      await adminClient
        .from('jobs')
        .update({
          payout_status: 'not_released',
        })
        .eq('id', job.id)
        .eq(
          'payout_status',
          'refund_processing'
        )

      return NextResponse.json(
        {
          error:
            'CrewCall could not safely claim the refund audit record.',
          code: 'REFUND_AUDIT_NOT_CLAIMED',
        },
        { status: 409 }
      )
    }

    if (refundRecordError) {
      if (refundRecordError.code === '23505') {
        await adminClient
          .from('jobs')
          .update({
            payout_status: 'not_released',
          })
          .eq('id', job.id)
          .eq(
            'payout_status',
            'refund_processing'
          )

        return NextResponse.json(
          {
            error:
              'A refund for this job is already being processed or has already been recorded.',
            code: 'REFUND_ALREADY_STARTED',
          },
          { status: 409 }
        )
      }

      console.error(
        'Unable to create refund audit record:',
        refundRecordError
      )

      await adminClient
        .from('jobs')
        .update({
          payout_status: 'not_released',
        })
        .eq('id', job.id)
        .eq(
          'payout_status',
          'refund_processing'
        )

      return NextResponse.json(
        {
          error:
            'CrewCall could not start the refund safely.',
        },
        { status: 500 }
      )
    }

    let refund: Stripe.Refund

    try {
      refund = await stripe.refunds.create(
        {
          payment_intent:
            job.stripe_payment_intent_id,
          reason: 'requested_by_customer',
          metadata: {
            crewcall_job_id: job.id,
            crewcall_company_id:
              job.company_id || '',
            crewcall_requested_by:
              user.id,
          },
        },
        {
          idempotencyKey:
            `crewcall-job-refund-${job.id}`,
        }
      )
    } catch (stripeError) {
      const failureMessage =
        stripeError instanceof Error
          ? stripeError.message
          : 'Stripe refund failed.'

      await adminClient
        .from('job_refunds')
        .update({
          status: 'failed',
          failure_message:
            failureMessage.slice(0, 1000),
          updated_at:
            new Date().toISOString(),
        })
        .eq('job_id', job.id)

      await adminClient
        .from('jobs')
        .update({
          payout_status: 'not_released',
        })
        .eq('id', job.id)
        .eq(
          'payout_status',
          'refund_processing'
        )

      console.error(
        'CrewCall Stripe refund failed:',
        stripeError
      )

      return NextResponse.json(
        {
          error:
            'Stripe could not complete the refund.',
        },
        { status: 502 }
      )
    }

    const refundedAt =
      new Date().toISOString()

    const refundSucceeded =
      refund.status === 'succeeded'

    /*
      Save the Stripe refund immediately so the
      audit record survives even if the following
      job update encounters a database problem.
    */
    const {
      error: auditUpdateError,
    } = await adminClient
      .from('job_refunds')
      .update({
        stripe_refund_id: refund.id,
        status: refundSucceeded
          ? 'succeeded'
          : 'processing',
        refunded_at: refundSucceeded
          ? refundedAt
          : null,
        updated_at: refundedAt,
      })
      .eq('job_id', job.id)

    if (auditUpdateError) {
      console.error(
        'Refund succeeded at Stripe but CrewCall audit update failed:',
        auditUpdateError
      )
    }

    if (!refundSucceeded) {
      return NextResponse.json({
        success: true,
        processing: true,
        refundId: refund.id,
        amountCents,
        status: refund.status,
      })
    }

    const {
      error: jobUpdateError,
    } = await adminClient
      .from('jobs')
      .update({
        status: 'cancelled',
        payment_status: 'refunded',
        escrow_status: 'refunded',
        payout_status: 'refunded',
      })
      .eq('id', job.id)
      .eq(
        'payout_status',
        'refund_processing'
      )
      .is('stripe_transfer_id', null)

    if (jobUpdateError) {
      console.error(
        'Stripe refund succeeded but CrewCall job update failed:',
        jobUpdateError
      )

      return NextResponse.json(
        {
          success: true,
          refundId: refund.id,
          amountCents,
          warning:
            'Stripe completed the refund, but CrewCall could not finish updating the job record.',
        },
        { status: 200 }
      )
    }

    if (job.assigned_worker_id) {
      const {
        error: notificationError,
      } = await adminClient
        .from('notifications')
        .insert({
          user_id:
            job.assigned_worker_id,
          type: 'payment',
          title: 'Job Cancelled',
          body: `${
            job.title || 'A CrewCall job'
          } was cancelled and the secured payment was refunded to the company.`,
          link_url:
            `/jobs/${job.id}`,
          read: false,
          is_read: false,
          created_at: refundedAt,
        })

      if (notificationError) {
        console.error(
          'Unable to create refund notification:',
          notificationError
        )
      }
    }

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      amountCents,
      status: refund.status,
    })
  } catch (error) {
    console.error(
      'CrewCall refund route failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to refund job.',
      },
      { status: 500 }
    )
  }
}
