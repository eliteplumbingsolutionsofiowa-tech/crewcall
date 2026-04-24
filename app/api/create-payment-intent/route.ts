import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { jobId } = await req.json()

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })
    }

    const { data: job, error } = await supabaseAdmin
      .from('jobs')
      .select(`
        id,
        title,
        price_cents,
        company_id,
        payment_status,
        stripe_payment_intent_id,
        profiles:company_id (
          stripe_account_id
        )
      `)
      .eq('id', jobId)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const amount = job.price_cents
    const connectedAccountId = (job.profiles as any)?.stripe_account_id

    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: 'Invalid job price' },
        { status: 400 }
      )
    }

    if (!connectedAccountId) {
      return NextResponse.json(
        { error: 'Company has not connected Stripe' },
        { status: 400 }
      )
    }

    if (job.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'This job is already paid.' },
        { status: 400 }
      )
    }

    const fee = Math.round(amount * 0.1)

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      application_fee_amount: fee,
      transfer_data: {
        destination: connectedAccountId,
      },
      metadata: {
        job_id: job.id,
        company_id: job.company_id,
      },
    })

    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        payment_status: 'pending',
      })
      .eq('id', job.id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    })
  } catch (error: any) {
    console.error(error)

    return NextResponse.json(
      { error: error.message || 'Payment failed' },
      { status: 500 }
    )
  }
}