import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const foundingMemberPriceId =
  process.env.STRIPE_FOUNDING_MEMBER_PRICE_ID
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY

function getBaseUrl(request: Request) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL

  if (configuredUrl) {
    const normalized = configuredUrl.startsWith('http')
      ? configuredUrl
      : `https://${configuredUrl}`

    return normalized.replace(/\/$/, '')
  }

  return new URL(request.url).origin
}

export async function POST(request: Request) {
  try {
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Missing STRIPE_SECRET_KEY.' },
        { status: 500 }
      )
    }

    if (!foundingMemberPriceId) {
      return NextResponse.json(
        {
          error:
            'Missing STRIPE_FOUNDING_MEMBER_PRICE_ID.',
        },
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

    const authorization =
      request.headers.get('authorization')

    const accessToken = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : null

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authorization token required.' },
        { status: 401 }
      )
    }

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
        { error: 'Invalid or expired session.' },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } =
      await supabase
        .from('profiles')
        .select('id, role, company_name, full_name')
        .eq('id', user.id)
        .maybeSingle()

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'CrewCall profile not found.' },
        { status: 404 }
      )
    }

    if (
      profile.role !== 'company' &&
      profile.role !== 'admin'
    ) {
      return NextResponse.json(
        {
          error:
            'Only company and admin accounts can purchase this membership.',
        },
        { status: 403 }
      )
    }

    const {
      data: existingSubscription,
      error: subscriptionError,
    } = await supabase
      .from('subscriptions')
      .select(
        'user_id, stripe_customer_id, stripe_subscription_id, status'
      )
      .eq('user_id', user.id)
      .maybeSingle()

    if (subscriptionError) {
      return NextResponse.json(
        { error: subscriptionError.message },
        { status: 500 }
      )
    }

    if (
      existingSubscription?.stripe_subscription_id &&
      ['active', 'trialing', 'past_due'].includes(
        existingSubscription.status
      )
    ) {
      return NextResponse.json(
        {
          error:
            'This account already has a Stripe subscription.',
          code: 'SUBSCRIPTION_ALREADY_EXISTS',
        },
        { status: 409 }
      )
    }

    const stripe = new Stripe(stripeSecretKey)

    let stripeCustomerId =
      existingSubscription?.stripe_customer_id ?? null

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name:
          profile.company_name ||
          profile.full_name ||
          undefined,
        metadata: {
          crewcall_user_id: user.id,
          crewcall_role: profile.role,
        },
      })

      stripeCustomerId = customer.id

      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert(
          {
            user_id: user.id,
            plan: 'founding_member',
            status:
              existingSubscription?.status || 'trialing',
            stripe_customer_id: stripeCustomerId,
            stripe_price_id: foundingMemberPriceId,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        )

      if (upsertError) {
        return NextResponse.json(
          { error: upsertError.message },
          { status: 500 }
        )
      }
    }

    const baseUrl = getBaseUrl(request)

    const checkoutSession =
      await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: stripeCustomerId,
        line_items: [
          {
            price: foundingMemberPriceId,
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/billing?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/billing?subscription=canceled`,
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        client_reference_id: user.id,
        metadata: {
          crewcall_user_id: user.id,
          plan: 'founding_member',
        },
        subscription_data: {
          metadata: {
            crewcall_user_id: user.id,
            plan: 'founding_member',
          },
        },
      })

    if (!checkoutSession.url) {
      return NextResponse.json(
        {
          error:
            'Stripe did not return a Checkout URL.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      url: checkoutSession.url,
    })
  } catch (error) {
    console.error('================================')
    console.error('Subscription checkout error:')
    console.error(error)
    console.error('================================')

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create Stripe Checkout session.',
      },
      { status: 500 }
    )
  }
}