import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
console.log('STRIPE KEY START:', stripeSecretKey?.slice(0, 10))
console.log('STRIPE KEY LENGTH:', stripeSecretKey?.length)
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null

const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null

function parseDollarAmount(value: any) {
  const cleaned = String(value || '0').replace(/[^0-9.]/g, '')
  return Number(cleaned) || 0
}

export async function POST(req: Request) {
  try {
    if (!stripeSecretKey || !stripe) {
      return NextResponse.json(
        { error: 'Missing STRIPE_SECRET_KEY in .env.local.' },
        { status: 500 }
      )
    }

    if (!stripeSecretKey.startsWith('sk_test_') && !stripeSecretKey.startsWith('sk_live_')) {
      return NextResponse.json(
        { error: 'Invalid STRIPE_SECRET_KEY. It must start with sk_test_ or sk_live_.' },
        { status: 500 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Missing Supabase server environment variables.' },
        { status: 500 }
      )
    }

    const { jobId, amount } = await req.json()
    const grossAmount = parseDollarAmount(amount)

    if (!jobId) {
      return NextResponse.json({ error: 'Missing job ID.' }, { status: 400 })
    }

    if (grossAmount <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount.' }, { status: 400 })
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('id, title, assigned_worker_id, status, pay_rate, payment_status')
      .eq('id', jobId)
      .maybeSingle()

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 })
    }

    if (!job) {
      return NextResponse.json({ error: `Job not found: ${jobId}` }, { status: 404 })
    }

    if (!job.assigned_worker_id) {
      return NextResponse.json(
        { error: 'No worker assigned to this job yet.' },
        { status: 400 }
      )
    }

    const amountInCents = Math.round(grossAmount * 100)

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: job.title || 'CrewCall Job Payment',
              description: `Payment for CrewCall job ${job.id}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        jobId: job.id,
      },
      success_url: `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/jobs/${job.id}/pay`,
    })

    await supabaseAdmin
      .from('jobs')
      .update({
        payment_status: 'pending',
        price_cents: amountInCents,
        stripe_session_id: session.id,
      })
      .eq('id', job.id)

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Checkout error:', error)

    return NextResponse.json(
      { error: error.message || 'Checkout failed.' },
      { status: 500 }
    )
  }
}
