import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null

const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null

const PLATFORM_FEE_PERCENT = 10

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

function centsFromPayRate(value: string | null) {
  if (!value) return 0

  const cleaned = String(value).replace(/[^0-9.]/g, '')
  const dollars = Number(cleaned)

  if (!Number.isFinite(dollars) || dollars <= 0) return 0

  return Math.round(dollars * 100)
}

export async function POST(req: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Missing STRIPE_SECRET_KEY.' },
        { status: 500 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Missing Supabase server environment variables.' },
        { status: 500 }
      )
    }

    const body = await req.json().catch(() => null)
    const jobId = body?.jobId

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId.' }, { status: 400 })
    }

    const { data: jobData, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select(`
        id,
        title,
        status,
        pay_rate,
        payment_status,
        payout_status,
        company_id,
        assigned_worker_id,
        stripe_transfer_id
      `)
      .eq('id', jobId)
      .maybeSingle()

    if (jobError || !jobData) {
      return NextResponse.json(
        { error: jobError?.message || 'Job not found.' },
        { status: 404 }
      )
    }

    const job = jobData as JobRow

    if (job.status !== 'completed') {
      return NextResponse.json(
        { error: 'Job must be completed before releasing payment.' },
        { status: 400 }
      )
    }

    if (job.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Job must be paid before releasing payout.' },
        { status: 400 }
      )
    }

    if (!job.assigned_worker_id) {
      return NextResponse.json(
        { error: 'No worker assigned to this job.' },
        { status: 400 }
      )
    }

    if (job.stripe_transfer_id || job.payout_status === 'released') {
      return NextResponse.json({
        success: true,
        alreadyReleased: true,
        message: 'Payout already released.',
        transferId: job.stripe_transfer_id,
      })
    }

    const { data: workerData, error: workerError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        stripe_account_id,
        stripe_charges_enabled,
        stripe_payouts_enabled,
        stripe_details_submitted
      `)
      .eq('id', job.assigned_worker_id)
      .maybeSingle()

    if (workerError || !workerData) {
      return NextResponse.json(
        { error: workerError?.message || 'Worker profile not found.' },
        { status: 404 }
      )
    }

    const worker = workerData as WorkerRow

    if (!worker.stripe_account_id) {
      return NextResponse.json(
        { error: 'Worker has not connected Stripe.' },
        { status: 400 }
      )
    }

    if (!worker.stripe_details_submitted) {
      return NextResponse.json(
        { error: 'Worker has not completed Stripe onboarding.' },
        { status: 400 }
      )
    }

    if (!worker.stripe_charges_enabled || !worker.stripe_payouts_enabled) {
      return NextResponse.json(
        { error: 'Worker Stripe account is not fully enabled yet.' },
        { status: 400 }
      )
    }

    const grossAmount = centsFromPayRate(job.pay_rate)

    if (grossAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid job pay amount.' },
        { status: 400 }
      )
    }

    const platformFee = Math.round(grossAmount * (PLATFORM_FEE_PERCENT / 100))
    const workerAmount = grossAmount - platformFee

    if (workerAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid payout amount.' },
        { status: 400 }
      )
    }

    const { data: lockedJob, error: lockError } = await supabaseAdmin
      .from('jobs')
      .update({
        payout_status: 'processing',
      })
      .eq('id', job.id)
      .neq('payout_status', 'released')
      .is('stripe_transfer_id', null)
      .select('id')
      .maybeSingle()

    if (lockError) {
      return NextResponse.json({ error: lockError.message }, { status: 400 })
    }

    if (!lockedJob) {
      return NextResponse.json({
        success: true,
        alreadyReleased: true,
        message: 'Payout is already processing or released.',
      })
    }

    const transfer = await stripe.transfers.create({
      amount: workerAmount,
      currency: 'usd',
      destination: worker.stripe_account_id,
      description: `CrewCall payout for ${job.title || 'job'}`,
      metadata: {
        job_id: job.id,
        worker_id: job.assigned_worker_id,
        gross_amount_cents: String(grossAmount),
        platform_fee_cents: String(platformFee),
        worker_amount_cents: String(workerAmount),
      },
    })

    const releasedAt = new Date().toISOString()

    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({
        payout_status: 'released',
        stripe_transfer_id: transfer.id,
        platform_fee_cents: platformFee,
        worker_payout_cents: workerAmount,
        payout_released_at: releasedAt,
      })
      .eq('id', job.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    await supabaseAdmin.from('notifications').insert({
      user_id: job.assigned_worker_id,
      type: 'payout',
      title: 'Payout released',
      body: `Your payout for ${job.title || 'this job'} has been released.`,
      is_read: false,
    })

    return NextResponse.json({
      success: true,
      transferId: transfer.id,
      grossAmount,
      platformFee,
      workerAmount,
      releasedAt,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to release payment.' },
      { status: 500 }
    )
  }
}