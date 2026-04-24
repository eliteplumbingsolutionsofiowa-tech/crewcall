import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    // 🔥 Create Stripe account
    const account = await stripe.accounts.create({
      type: 'express',
    })

    // 🔥 SAVE to Supabase
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        stripe_account_id: account.id,
      })
      .eq('id', userId)

    if (updateError) {
      console.error(updateError)
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
    }

    // 🔥 Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing`,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing?stripe_return=true`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json(
      { error: error.message || 'Stripe error' },
      { status: 500 }
    )
  }
}