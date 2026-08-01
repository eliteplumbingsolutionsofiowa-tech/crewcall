import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!stripeSecretKey || !supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Missing server configuration.' },
        { status: 500 }
      )
    }

    const authHeader = request.headers.get('authorization')

    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null

    if (!token) {
      return NextResponse.json(
        { error: 'Missing authorization.' },
        { status: 401 }
      )
    }

    const supabase = createClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser(token)

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session.' },
        { status: 401 }
      )
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found.' },
        { status: 404 }
      )
    }

    const stripe = new Stripe(stripeSecretKey)

    const session =
      await stripe.billingPortal.sessions.create({
        customer: subscription.stripe_customer_id,
        return_url:
          `${process.env.NEXT_PUBLIC_SITE_URL || request.url}/billing`,
      })

    return NextResponse.json({
      url: session.url,
    })

  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to open billing portal.',
      },
      { status: 500 }
    )
  }
}
