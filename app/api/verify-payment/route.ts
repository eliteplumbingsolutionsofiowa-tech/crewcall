import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      )
    }

    // 🔥 Get Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      )
    }

    // 🔥 Pull jobId directly from metadata (NOT DB lookup)
    const jobId = session.metadata?.jobId

    if (!jobId) {
      return NextResponse.json(
        { error: 'No jobId found in Stripe metadata' },
        { status: 400 }
      )
    }

    // 🔥 Update job
    const { error } = await supabaseAdmin
      .from('jobs')
      .update({
        payment_status: 'paid',
        status: 'completed',
        paid_at: new Date().toISOString(),
        stripe_session_id: sessionId,
      })
      .eq('id', jobId)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      jobId,
    })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    )
  }
}