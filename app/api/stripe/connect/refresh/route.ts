import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY as string
)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SUPABASE_URL as string
    : '',
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: Request) {
  try {
    const authorization = req.headers.get('authorization')

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required.' },
        { status: 401 }
      )
    }

    const accessToken = authorization
      .slice('Bearer '.length)
      .trim()

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authorization token required.' },
        { status: 401 }
      )
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired authorization token.' },
        { status: 401 }
      )
    }

    const userId = user.id

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', userId)
      .single()

    if (error || !profile?.stripe_account_id) {
      return NextResponse.json(
        { error: 'Stripe account not found' },
        { status: 400 }
      )
    }

    let account: Stripe.Account

    try {
      account = await stripe.accounts.retrieve(
        profile.stripe_account_id
      )
    } catch (retrieveError) {
      console.warn(
        'Existing Stripe account is inaccessible during refresh.',
        retrieveError
      )

      return NextResponse.json(
        {
          error:
            'Your previous Stripe connection is no longer available. Please reconnect Stripe from your CrewCall profile.',
          reconnect_required: true,
        },
        { status: 409 }
      )
    }

    const onboardingComplete =
      Boolean(account.details_submitted) &&
      Boolean(account.payouts_enabled)

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        stripe_charges_enabled: Boolean(account.charges_enabled),
        stripe_payouts_enabled: Boolean(account.payouts_enabled),
        stripe_details_submitted: Boolean(account.details_submitted),
        stripe_onboarding_complete: onboardingComplete,
      })
      .eq('id', userId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      onboarding_complete: onboardingComplete,
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Stripe refresh failed' },
      { status: 500 }
    )
  }
}
