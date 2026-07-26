import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: Request) {
  try {
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Missing STRIPE_SECRET_KEY.' },
        { status: 500 }
      )
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        {
          error:
            'Missing Supabase server environment variables.',
        },
        { status: 500 }
      )
    }

    const authorization = request.headers.get('authorization')

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization token.' },
        { status: 401 }
      )
    }

    const accessToken = authorization.replace('Bearer ', '').trim()

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            userError?.message || 'Unable to verify user.',
        },
        { status: 401 }
      )
    }

    const { data: subscription, error: subscriptionError } =
      await supabase
        .from('subscriptions')
        .select(
          'stripe_customer_id, stripe_subscription_id, status'
        )
        .eq('user_id', user.id)
        .maybeSingle()

    if (subscriptionError) {
      return NextResponse.json(
        {
          error: `Subscription lookup failed: ${subscriptionError.message}`,
        },
        { status: 500 }
      )
    }

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        {
          error:
            'No Stripe billing account was found for this membership.',
        },
        { status: 404 }
      )
    }

    const stripe = new Stripe(stripeSecretKey)

    const requestUrl = new URL(request.url)

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      requestUrl.origin

    const portalSession =
      await stripe.billingPortal.sessions.create({
        customer: subscription.stripe_customer_id,
        return_url: `${siteUrl}/billing?portal=returned`,
      })

    if (!portalSession.url) {
      return NextResponse.json(
        {
          error:
            'Stripe did not return a customer portal URL.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      url: portalSession.url,
    })
  } catch (error) {
    console.error('Stripe customer portal error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to open the Stripe customer portal.',
      },
      { status: 500 }
    )
  }
}