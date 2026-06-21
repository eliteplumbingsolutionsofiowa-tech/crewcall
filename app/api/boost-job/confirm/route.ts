import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type BoostConfirmBody = {
  sessionId?: string
}

function getStripeClient() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY

  if (!stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable.')
  }

  return new Stripe(stripeSecretKey)
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.')
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BoostConfirmBody
    const sessionId = body.sessionId

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      )
    }

    const stripe = getStripeClient()
    const supabaseAdmin = getSupabaseAdminClient()

    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      )
    }

    const jobId = session.metadata?.jobId

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId' },
        { status: 400 }
      )
    }

    const featuredUntil = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString()

    const { error } = await supabaseAdmin
      .from('jobs')
      .update({
        is_featured: true,
        featured_until: featuredUntil,
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
      featured_until: featuredUntil,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Could not confirm boost'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}