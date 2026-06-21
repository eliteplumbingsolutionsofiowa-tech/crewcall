import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

type UrgentCheckoutBody = {
  jobId?: string
  plan?: string
}

function getStripeClient() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY

  if (!stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable.')
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: '2026-04-22.dahlia',
  })
}

function getBaseUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL

  if (!baseUrl) {
    throw new Error('Missing NEXT_PUBLIC_BASE_URL environment variable.')
  }

  if (baseUrl.startsWith('http')) {
    return baseUrl
  }

  return `https://${baseUrl}`
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as UrgentCheckoutBody

    const jobId = body.jobId
    const plan = body.plan || 'standard'

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId' },
        { status: 400 }
      )
    }

    const stripe = getStripeClient()
    const baseUrl = getBaseUrl()

    const isPremium = plan === 'premium'
    const amount = isPremium ? 4900 : 2500

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: isPremium
                ? 'Urgent Job Boost (Premium 24h + SMS)'
                : 'Urgent Job Boost (24h)',
              description:
                'Boost your job to the top of search and mark it as urgent.',
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        jobId,
        plan,
      },
      success_url: `${baseUrl}/jobs?urgent_success=true&jobId=${jobId}&plan=${plan}`,
      cancel_url: `${baseUrl}/billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Stripe error'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}