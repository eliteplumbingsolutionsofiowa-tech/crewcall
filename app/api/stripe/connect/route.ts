import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Missing STRIPE_SECRET_KEY.' },
        { status: 500 }
      )
    }

    if (!siteUrl) {
      return NextResponse.json(
        { error: 'Missing NEXT_PUBLIC_SITE_URL.' },
        { status: 500 }
      )
    }

    const { userId, email } = await req.json()

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing userId or email.' },
        { status: 400 }
      )
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(
        'id, role, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted'
      )
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: profileError?.message || 'Profile not found.' },
        { status: 400 }
      )
    }

    if (profile.role !== 'worker') {
      return NextResponse.json(
        { error: 'Only workers can connect payout accounts.' },
        { status: 403 }
      )
    }

    let accountId = profile.stripe_account_id

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email,
        capabilities: {
          transfers: { requested: true },
        },
      })

      accountId = account.id

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          stripe_account_id: accountId,
          stripe_charges_enabled: account.charges_enabled || false,
          stripe_payouts_enabled: account.payouts_enabled || false,
          stripe_details_submitted: account.details_submitted || false,
        })
        .eq('id', userId)

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 400 }
        )
      }
    } else {
      const account = await stripe.accounts.retrieve(accountId)

      const { error: syncError } = await supabaseAdmin
        .from('profiles')
        .update({
          stripe_charges_enabled: account.charges_enabled || false,
          stripe_payouts_enabled: account.payouts_enabled || false,
          stripe_details_submitted: account.details_submitted || false,
        })
        .eq('id', userId)

      if (syncError) {
        return NextResponse.json(
          { error: syncError.message },
          { status: 400 }
        )
      }
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl}/profile`,
      return_url: `${siteUrl}/profile`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Stripe Connect failed.' },
      { status: 500 }
    )
  }
}