import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getEnv(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Missing ${name}`)
  }

  return value
}

function parseDollarAmount(value: unknown) {
  const cleaned = String(value || '0').replace(/[^0-9.]/g, '')
  return Number(cleaned) || 0
}

export async function POST(req: Request) {
  try {
    const stripeSecretKey = getEnv('STRIPE_SECRET_KEY')
    const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
    const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    const siteUrl = getEnv('NEXT_PUBLIC_SITE_URL').replace(/\/$/, '')

    console.log('STRIPE KEY START:', stripeSecretKey.slice(0, 8))
    console.log('STRIPE KEY LENGTH:', stripeSecretKey.length)

    const stripe = new Stripe(stripeSecretKey)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    const jobId = body.jobId

    if (!jobId) {
      return NextResponse.json({ error: 'Missing job ID.' }, { status: 400 })
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('id, title, pay_rate, payment_status')
      .eq('id', jobId)
      .maybeSingle()

    if (jobError || !job) {
      return NextResponse.json(
        { error: jobError?.message || 'Job not found.' },
        { status: 404 }
      )
    }

    const grossAmount = parseDollarAmount(job.pay_rate)

    if (grossAmount <= 0) {
      return NextResponse.json(
        { error: 'This job does not have a valid pay amount.' },
        { status: 400 }
      )
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(grossAmount * 100),
            product_data: {
              name: job.title || 'CrewCall Job Payment',
              description: `Payment for CrewCall job ${job.id}`,
            },
          },
        },
      ],
      metadata: {
        jobId: job.id,
      },
      success_url: `${siteUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/jobs/${job.id}/pay`,
    })

    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({
        payment_status: 'pending',
        stripe_checkout_session_id: session.id,
      })
      .eq('id', job.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('STRIPE CHECKOUT ERROR:', error)

    return NextResponse.json(
      { error: error?.message || 'Unable to create Stripe checkout session.' },
      { status: 500 }
    )
  }
}