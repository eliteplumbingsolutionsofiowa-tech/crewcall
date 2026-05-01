import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

function parseDollarAmount(value: any) {
  return Number(String(value || '0').replace(/[^0-9.]/g, '')) || 0
}

export async function POST(req: Request) {
  try {
    const { jobId, amount } = await req.json()

    const grossAmount = parseDollarAmount(amount)

    if (!jobId || grossAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid job or amount.' },
        { status: 400 }
      )
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'CrewCall Job Payment',
              description: `Payment for job ${jobId}`,
            },
            unit_amount: Math.round(grossAmount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        jobId,
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/stripe/success?session_id={CHECKOUT_SESSION_ID}&jobId=${jobId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/jobs/${jobId}/pay`,
    })

    await supabaseAdmin
      .from('jobs')
      .update({
        payment_status: 'pending',
        stripe_session_id: session.id,
      })
      .eq('id', jobId)

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('CHECKOUT ERROR:', error)

    return NextResponse.json(
      { error: error.message || 'Stripe checkout failed.' },
      { status: 500 }
    )
  }
}