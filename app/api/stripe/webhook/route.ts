import { NextResponse } from 'next/server'
import { sendApnsPush } from '@/lib/push/apns'
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
        error: 'Missing Stripe environment variables.',
      },
      { status: 500 }
    )
  }

  const signature =
    request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      {
        error: 'Missing Stripe signature.',
      },
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
      'Stripe webhook signature failed:',
      error
    )

    return NextResponse.json(
      {
        error: 'Invalid webhook signature.',
      },
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
          CREWCALL JOB PAYMENT
        */

        if (session.mode === 'payment') {
          const jobId =
            session.metadata?.jobId ||
            session.client_reference_id ||
            null

          if (!jobId) {
            console.log(
              'Payment completed without CrewCall job ID:',
              session.id
            )

            break
          }

          if (session.payment_status !== 'paid') {
            console.log(
              'CrewCall checkout completed but payment is not yet secured:',
              {
                jobId,
                sessionId: session.id,
                paymentStatus: session.payment_status,
              }
            )

            break
          }

          const { error } =
            await supabase
              .from('jobs')
              .update({
                payment_status: 'paid',
                paid: true,
                paid_at:
                  new Date().toISOString(),
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
            'CrewCall job funds secured:',
            jobId
          )

          break
        }


        /*
          CREWCALL SUBSCRIPTIONS
        */

        if (session.mode === 'subscription') {
          const userId =
            session.metadata
              ?.crewcall_user_id ||
            session.client_reference_id ||
            null

          if (!userId) {
            console.log(
              'Subscription missing CrewCall user:',
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
          intent.metadata?.jobId ||
          null

        if (!jobId) {
          console.log(
            'Payment intent missing job ID:',
            intent.id
          )

          break
        }

        const {
          data: paidJob,
          error,
        } = await supabase
          .from('jobs')
          .update({
            payment_status: 'paid',
            paid: true,
            paid_at:
              new Date().toISOString(),
            stripe_payment_intent_id:
              intent.id,
          })
          .eq('id', jobId)
          .select(
            'id, title, assigned_worker_id'
          )
          .maybeSingle()

        if (error) {
          throw new Error(error.message)
        }

        console.log(
          'Payment intent updated job:',
          jobId
        )

        if (paidJob?.assigned_worker_id) {
          const notificationBody =
            `Payment for ${
              paidJob.title ||
              'your CrewCall job'
            } has been secured.`

          const {
            error: notificationError,
          } = await supabase
            .from('notifications')
            .insert({
              user_id:
                paidJob.assigned_worker_id,
              type: 'payment',
              title: 'Payment Secured',
              body: notificationBody,
              link_url:
                `/jobs/${paidJob.id}`,
              read: false,
              is_read: false,
              created_at:
                new Date().toISOString(),
            })

          if (notificationError) {
            console.error(
              'Unable to create payment notification:',
              notificationError
            )
          }

          try {
            const {
              data: workerDevices,
              error: workerDevicesError,
            } = await supabase
              .from('device_tokens')
              .select('id, token')
              .eq(
                'user_id',
                paidJob.assigned_worker_id
              )
              .eq('platform', 'ios')

            if (workerDevicesError) {
              console.error(
                'Unable to load payment push devices:',
                workerDevicesError
              )
            } else {
              for (
                const device of
                workerDevices || []
              ) {
                try {
                  const result =
                    await sendApnsPush({
                      deviceToken:
                        device.token,
                      title:
                        'Payment Secured',
                      body:
                        notificationBody,
                      url:
                        `/jobs/${paidJob.id}`,
                      badge: 1,
                    })

                  if (
                    result.status !== 200
                  ) {
                    console.error(
                      'Payment push failed:',
                      {
                        deviceId:
                          device.id,
                        status:
                          result.status,
                        response:
                          result.body,
                      }
                    )
                  }
                } catch (pushError) {
                  console.error(
                    'Unable to send payment push:',
                    pushError
                  )
                }
              }
            }
          } catch (pushError) {
            console.error(
              'Payment push delivery failed:',
              pushError
            )
          }
        }

        break
      }


      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription =
          event.data.object as Stripe.Subscription

        const customerId =
          getCustomerId(subscription.customer)

        if (!customerId) {
          console.log(
            'Subscription event missing customer:',
            subscription.id
          )

          break
        }

        const status =
          event.type === 'customer.subscription.deleted'
            ? 'canceled'
            : subscription.status

        const { error } =
          await supabase
            .from('subscriptions')
            .update({
              status,
              stripe_subscription_id:
                subscription.id,
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              'stripe_customer_id',
              customerId
            )

        if (error) {
          throw new Error(error.message)
        }

        console.log(
          'CrewCall subscription updated:',
          subscription.id,
          status
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
      'Stripe webhook processing failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Webhook processing failed.',
      },
      { status: 500 }
    )
  }
}
