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
        { error: 'Missing session ID.' },
        { status: 400 }
      )
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment has not been completed yet.' },
        { status: 400 }
      )
    }

    const jobId = session.metadata?.jobId
    const workerId = session.metadata?.workerId

    if (!jobId || !workerId) {
      return NextResponse.json(
        { error: 'Missing job or worker metadata.' },
        { status: 400 }
      )
    }

    const { error: jobError } = await supabaseAdmin
      .from('jobs')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    if (jobError) {
      return NextResponse.json(
        { error: jobError.message },
        { status: 500 }
      )
    }

    const { error: appError } = await supabaseAdmin
      .from('applications')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('job_id', jobId)
      .eq('worker_id', workerId)

    if (appError) {
      return NextResponse.json(
        { error: appError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      jobId,
      workerId,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Something went wrong.' },
      { status: 500 }
    )
  }
}