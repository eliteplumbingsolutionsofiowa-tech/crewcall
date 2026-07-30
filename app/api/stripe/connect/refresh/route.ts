import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY as string
)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: Request) {
  try {
    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      )
    }

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

    const account = await stripe.accounts.retrieve(
      profile.stripe_account_id
    )

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        stripe_charges_enabled:
          account.charges_enabled || false,
        stripe_payouts_enabled:
          account.payouts_enabled || false,
        stripe_details_submitted:
          account.details_submitted || false,
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
    })

  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Refresh failed',
      },
      { status: 500 }
    )
  }
}
