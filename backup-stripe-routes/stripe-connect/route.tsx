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
    const { userId, email } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'Missing user ID.' }, { status: 400 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    })

    await supabaseAdmin
      .from('profiles')
      .update({ stripe_account_id: account.id })
      .eq('id', userId)

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${siteUrl}/profile`,
      return_url: `${siteUrl}/profile?stripe_connected=true`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Stripe Connect failed.' },
      { status: 500 }
    )
  }
}