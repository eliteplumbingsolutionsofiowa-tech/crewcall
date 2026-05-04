import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    )
  } catch (error: any) {
    console.error('WEBHOOK SIGNATURE ERROR:', error.message)
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const jobId = session.metadata?.jobId

      if (!jobId) {
        return NextResponse.json({ error: 'Missing jobId metadata' }, { status: 400 })
      }

      await supabaseAdmin
        .from('jobs')
        .update({
          paid: true,
          payment_status: 'paid',
          status: 'completed',
          paid_at: new Date().toISOString(),
          stripe_session_id: session.id,
        })
        .eq('id', jobId)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('WEBHOOK ERROR:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}