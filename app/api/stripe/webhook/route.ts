import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY

function getCustomerId(
  customer:
    | string
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | null
) {
  if (!customer) return null

  return typeof customer === 'string'
    ? customer
    : customer.id
}

export async function POST(request: Request) {
  if (
    !stripeSecretKey ||
    !stripeWebhookSecret ||
    !supabaseUrl ||
    !supabaseServiceRoleKey
  ) {
    return NextResponse.json(
      {
        error:
          'Missing Stripe environment variables.',
      },
      { status: 500 }
    )
  }

  const signature =
    request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing signature.' },
      { status: 400 }
    )
  }

  const body = await request.text()

  const stripe = new Stripe(stripeSecretKey)

  let event: Stripe.Event

  try {
    event =
      stripe.webhooks.constructEvent(
        body,
        signature,
        stripeWebhookSecret
      )
  } catch (error) {
    console.error(
      'Stripe signature failed:',
      error
    )

    return NextResponse.json(
      { error: 'Invalid signature.' },
      { status: 400 }
    )
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session =
          event.data.object as Stripe.Checkout.Session

        console.log(
          'Stripe checkout completed:',
          session.id,
          session.mode
        )

        /*
          CrewCall JOB PAYMENTS
        */
        if (session.mode === 'payment') {
          const jobId =
            session.metadata?.jobId ||
            session.client_reference_id

          if (!jobId) {
            console.log(
              'Skipping payment checkout without CrewCall job ID:',
              session.id
            )

            break
          }

          const { error } =
            await supabase
              .from('jobs')
              .update({
                payment_status: 'paid',
                stripe_payment_intent_id:
                  typeof session.payment_intent ===
                  'string'
                    ? session.payment_intent
                    : null,
              })
              .eq('id', jobId)

          if (error) {
            throw new Error(error.message)
          }

          console.log(
            'CrewCall job marked paid:',
            jobId
          )

          break
        }


        /*
          CrewCall SUBSCRIPTIONS
        */
        if (session.mode === 'subscription') {
          const userId =
            session.metadata
              ?.crewcall_user_id ||
            session.client_reference_id ||
            null

          if (!userId) {
            console.log(
              'Skipping subscription without CrewCall user:',
              session.id
            )

            break
          }

          const customerId =
            getCustomerId(
              session.customer
            )

          const subscriptionId =
            typeof session.subscription ===
            'string'
              ? session.subscription
              : session.subscription?.id ||
                null

          const { error } =
            await supabase
              .from('subscriptions')
              .upsert(
                {
                  user_id: userId,
                  status: 'active',
                  stripe_customer_id:
                    customerId,
                  stripe_subscription_id:
                    subscriptionId,
                  plan:
                    session.metadata?.plan ||
                    'founding_member',
                  updated_at:
                    new Date().toISOString(),
                },
                {
                  onConflict:
                    'user_id',
                }
              )

          if (error) {
            throw new Error(error.message)
          }
        }

        break
      }


      case 'payment_intent.succeeded': {
        const intent =
          event.data.object as Stripe.PaymentIntent

        const jobId =
          intent.metadata?.jobId

        if (!jobId) {
          console.log(
            'Skipping payment intent without job ID:',
            intent.id
          )

          break
        }

        const { error } =
          await supabase
            .from('jobs')
            .update({
              payment_status: 'paid',
              stripe_payment_intent_id:
                intent.id,
            })
            .eq('id', jobId)

        if (error) {
          throw new Error(error.message)
        }

        console.log(
          'Payment intent marked job paid:',
          jobId
        )

        break
      }


      default:
        console.log(
          'Unhandled Stripe event:',
          event.type
        )
    }

    return NextResponse.json({
      received: true,
    })

  } catch (error) {
    console.error(
      'Webhook processing failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Webhook failed',
      },
      { status: 500 }
    )
  }
}
