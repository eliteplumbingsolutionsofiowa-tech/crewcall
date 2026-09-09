import { NextResponse } from 'next/server'
import { sendApnsPush } from '@/lib/push/apns'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { resolveCompanyContext } from '@/lib/company-context'

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

const PAYMENT_RELEASE_ACK_VERSION = '2026-09-09-v1'

const PAYMENT_RELEASE_ACK_TEXT =
  'I confirm that the work for this CrewCall job has been completed and authorize CrewCall to release the agreed payment to the worker. I understand that once payment is released, the job will be recorded as paid and completed.'

type ReleasePaymentRequest = {
  jobId?: string
  paymentReleaseAcknowledged?: boolean
  acknowledgmentVersion?: string
}

type JobRow = {
  id: string
  title: string | null
  status: string | null
  pay_rate: string | null
  escrow_amount_cents: number | null
  escrow_status: string | null
  payment_status: string | null
  payout_status: string | null
  company_id: string | null
  assigned_worker_id: string | null
  stripe_transfer_id: string | null
  job_type: string | null
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

    if (
      body?.paymentReleaseAcknowledged !== true ||
      body?.acknowledgmentVersion !== PAYMENT_RELEASE_ACK_VERSION
    ) {
      return NextResponse.json(
        {
          error:
            'Payment authorization acknowledgment is required before payout can be released.',
          code: 'PAYMENT_RELEASE_ACK_REQUIRED',
        },
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
          escrow_amount_cents,
          escrow_status,
          payment_status,
          payout_status,
          company_id,
          assigned_worker_id,
          stripe_transfer_id,
          job_type
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

    if (job.job_type !== 'worker_job') {
      return NextResponse.json(
        {
          error:
            'Contractor bid requests cannot use the worker payout flow.',
          code: 'BID_REQUEST_JOB',
        },
        { status: 409 }
      )
    }

    const companyContext =
      await resolveCompanyContext(
        adminClient,
        user.id
      )

    const canReleasePayment =
      companyContext.isPlatformAdmin ||
      companyContext.isCompanyOwner ||
      (
        companyContext.isTeamMember &&
        companyContext.companyId === job.company_id &&
        companyContext.teamRole === 'admin'
      )

    if (
      !canReleasePayment ||
      (
        !companyContext.isPlatformAdmin &&
        companyContext.companyId !== job.company_id
      )
    ) {
      return NextResponse.json(
        {
          error:
            'You do not have permission to release payment for this job.',
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
      job.stripe_transfer_id &&
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

    let stripeAccount: Stripe.Account

    try {
      stripeAccount = await stripe.accounts.retrieve(
        worker.stripe_account_id
      )
    } catch (retrieveError) {
      console.error(
        'Unable to access worker Stripe account during payout release.',
        retrieveError
      )

      return NextResponse.json(
        {
          error:
            'The worker Stripe account is no longer accessible. The worker must reconnect Stripe before this payout can be released.',
          reconnect_required: true,
        },
        { status: 409 }
      )
    }

    if (
      !stripeAccount.details_submitted ||
      !stripeAccount.payouts_enabled
    ) {
      return NextResponse.json(
        {
          error:
            'Worker Stripe onboarding or payouts are not complete.',
        },
        { status: 400 }
      )
    }

    await adminClient
      .from('profiles')
      .update({
        stripe_charges_enabled:
          stripeAccount.charges_enabled || false,
        stripe_payouts_enabled:
          stripeAccount.payouts_enabled || false,
        stripe_details_submitted:
          stripeAccount.details_submitted || false,
      })
      .eq('id', worker.id)

    const grossAmount =
      job.escrow_amount_cents || 0

    if (
      grossAmount <= 0 ||
      job.escrow_status !== 'funded'
    ) {
      return NextResponse.json(
        {
          error:
            'No confirmed funded amount is available for this payout.',
        },
        { status: 409 }
      )
    }

    const platformFee = Math.round(
      grossAmount *
        (PLATFORM_FEE_PERCENT / 100)
    )

    const workerAmount =
      grossAmount - platformFee

    const authorizedAt = new Date().toISOString()

    const {
      error: acknowledgmentError,
    } = await adminClient
      .from('payment_release_acknowledgments')
      .upsert(
        {
          job_id: job.id,
          company_id: job.company_id,
          authorized_by: user.id,
          worker_id: job.assigned_worker_id,
          gross_amount_cents: grossAmount,
          platform_fee_cents: platformFee,
          worker_payout_cents: workerAmount,
          acknowledgment_version:
            PAYMENT_RELEASE_ACK_VERSION,
          acknowledgment_text:
            PAYMENT_RELEASE_ACK_TEXT,
          authorized_at: authorizedAt,
        },
        {
          onConflict: 'job_id',
          ignoreDuplicates: true,
        }
      )

    if (acknowledgmentError) {
      console.error(
        'Unable to save payment release acknowledgment:',
        acknowledgmentError
      )

      return NextResponse.json(
        {
          error:
            'CrewCall could not record the payment authorization. Payout was not released.',
        },
        { status: 500 }
      )
    }

    if (workerAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid payout amount.' },
        { status: 400 }
      )
    }

    const {
      data: payoutClaimed,
      error: lockError,
    } = await adminClient.rpc(
      'claim_job_payout',
      {
        p_job_id: job.id,
        p_company_id: job.company_id,
      }
    )

    if (lockError) {
      return NextResponse.json(
        { error: lockError.message },
        { status: 400 }
      )
    }

    if (!payoutClaimed) {
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

      if (
        currentJob?.payout_status ===
          'refund_processing' ||
        currentJob?.payout_status ===
          'refunded' ||
        currentJob?.payment_status ===
          'refunded' ||
        currentJob?.escrow_status ===
          'refunded'
      ) {
        return NextResponse.json(
          {
            success: false,
            refunded: true,
            message:
              'This payment is being refunded or has already been refunded. Worker payout cannot be released.',
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          processing: true,
          message:
            'Payout is already processing or is no longer eligible for release.',
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
            company_id: job.company_id || user.id,
            actor_user_id: user.id,
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
      error: acknowledgmentTransferError,
    } = await adminClient
      .from('payment_release_acknowledgments')
      .update({
        stripe_transfer_id: transfer.id,
      })
      .eq('job_id', job.id)
      .is('stripe_transfer_id', null)

    if (acknowledgmentTransferError) {
      console.error(
        'Unable to attach Stripe transfer to payment acknowledgment:',
        acknowledgmentTransferError
      )
    }

    console.log('CREWCALL PAYOUT SAVE', {
      jobId: job.id,
      transferId: transfer.id,
      platformFee,
      workerAmount,
    })

    const {
      data: releasedJob,
      error: updateError,
    } = await adminClient
      .from('jobs')
      .update({
        payout_status: 'released',
        stripe_transfer_id: transfer.id,
        platform_fee_cents: Number(platformFee),
        worker_payout_cents: Number(workerAmount),
        payout_released_at: releasedAt,
      })
      .eq('id', job.id)
      .eq('company_id', job.company_id)
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

    try {
      const {
        data: workerDevices,
        error: workerDevicesError,
      } = await adminClient
        .from('device_tokens')
        .select('id, token')
        .eq('user_id', job.assigned_worker_id)
        .eq('platform', 'ios')

      if (workerDevicesError) {
        console.error(
          'Unable to load payout push devices:',
          workerDevicesError
        )
      } else {
        const pushBody = `Your payout for ${
          job.title || 'your CrewCall job'
        } has been released.`

        for (const device of workerDevices || []) {
          try {
            const result = await sendApnsPush({
              deviceToken: device.token,
              title: 'Payout Released',
              body: pushBody,
              url: `/jobs/${job.id}`,
              badge: 1,
            })

            if (result.status !== 200) {
              console.error(
                'Payout push failed:',
                {
                  deviceId: device.id,
                  status: result.status,
                  response: result.body,
                }
              )
            }
          } catch (pushError) {
            console.error(
              'Unable to send payout push:',
              pushError
            )
          }
        }
      }
    } catch (pushError) {
      console.error(
        'Payout push delivery failed:',
        pushError
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