import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null

const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null

function parseDollarAmount(value: unknown) {
  const cleaned = String(value || '0').replace(/[^0-9.]/g, '')
  return Number(cleaned) || 0
}

export async function POST(req: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe secret key is missing.' },
        { status: 500 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase admin keys are missing.' },
        { status: 500 }
      )
    }

    if (!siteUrl) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_SITE_URL is missing.' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const jobId = body.jobId

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing job ID.' },
        { status: 400 }
      )
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

    const amountInCents = Math.round(grossAmount * 100)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountInCents,
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
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Unable to create Stripe checkout session.' },
      { status: 500 }
    )
  }
}