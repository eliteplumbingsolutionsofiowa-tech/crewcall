import { NextResponse } from 'next/server'
import { sendApnsPush } from '@/lib/push/apns'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET

const foundingMemberPriceId =
  process.env.STRIPE_FOUNDING_MEMBER_PRICE_ID

const workerProPriceId =
  process.env.STRIPE_WORKER_PRO_PRICE_ID

const workerMembershipPriceId =
  process.env.STRIPE_WORKER_MEMBERSHIP_PRICE_ID

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

function unixToIso(value: number | null | undefined) {
  return typeof value === 'number'
    ? new Date(value * 1000).toISOString()
    : null
}

function isSubscriptionScheduledToCancel(
  subscription: Stripe.Subscription
) {
  return (
    subscription.cancel_at_period_end ||
    typeof subscription.cancel_at === 'number'
  )
}

function getSubscriptionPeriods(
  subscription: Stripe.Subscription
) {
  const items = subscription.items?.data ?? []

  const starts = items
    .map((item) => item.current_period_start)
    .filter(
      (value): value is number =>
        typeof value === 'number'
    )

  const ends = items
    .map((item) => item.current_period_end)
    .filter(
      (value): value is number =>
        typeof value === 'number'
    )

  return {
    currentPeriodStartsAt:
      starts.length > 0
        ? unixToIso(Math.min(...starts))
        : null,
    currentPeriodEndsAt:
      ends.length > 0
        ? unixToIso(Math.max(...ends))
        : null,
  }
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

          const {
            data: currentPaymentJob,
            error: currentPaymentJobError,
          } = await supabase
            .from('jobs')
            .select(
              'id, payment_status, payout_status, escrow_status'
            )
            .eq('id', jobId)
            .maybeSingle()

          if (currentPaymentJobError) {
            throw new Error(
              currentPaymentJobError.message
            )
          }

          if (
            currentPaymentJob?.payout_status ===
              'refund_processing' ||
            currentPaymentJob?.payout_status ===
              'refunded' ||
            currentPaymentJob?.payment_status ===
              'refunded' ||
            currentPaymentJob?.escrow_status ===
              'refunded'
          ) {
            console.log(
              'Ignoring checkout payment event for refunded/refunding CrewCall job:',
              jobId
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
                escrow_amount_cents:
                  session.amount_total,
                escrow_status: 'funded',
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

          if (!subscriptionId) {
            throw new Error(
              'Subscription checkout completed without a Stripe subscription ID.'
            )
          }

          const stripeSubscription =
            await stripe.subscriptions.retrieve(
              subscriptionId
            )

          const periods =
            getSubscriptionPeriods(
              stripeSubscription
            )

          const { error } =
            await supabase
              .from('subscriptions')
              .upsert(
                {
                  user_id: userId,
                  status:
                    stripeSubscription.status ===
                    'trialing'
                      ? 'trialing'
                      : 'active',
                  stripe_customer_id:
                    customerId,
                  stripe_subscription_id:
                    subscriptionId,
                  plan:
                    session.metadata?.plan ||
                    'founding_member',
                  stripe_price_id:
                    stripeSubscription.items
                      ?.data?.[0]?.price?.id ??
                    null,
                  current_period_starts_at:
                    periods.currentPeriodStartsAt,
                  current_period_ends_at:
                    periods.currentPeriodEndsAt,
                  trial_starts_at:
                    unixToIso(
                      stripeSubscription.trial_start
                    ),
                  trial_ends_at:
                    unixToIso(
                      stripeSubscription.trial_end
                    ),
                  cancel_at_period_end:
                    isSubscriptionScheduledToCancel(
                      stripeSubscription
                    ),
                  canceled_at:
                    unixToIso(
                      stripeSubscription.canceled_at
                    ),
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
          data: currentIntentJob,
          error: currentIntentJobError,
        } = await supabase
          .from('jobs')
          .select(
            'id, payment_status, payout_status, escrow_status'
          )
          .eq('id', jobId)
          .maybeSingle()

        if (currentIntentJobError) {
          throw new Error(
            currentIntentJobError.message
          )
        }

        if (
          currentIntentJob?.payout_status ===
            'refund_processing' ||
          currentIntentJob?.payout_status ===
            'refunded' ||
          currentIntentJob?.payment_status ===
            'refunded' ||
          currentIntentJob?.escrow_status ===
            'refunded'
        ) {
          console.log(
            'Ignoring payment intent event for refunded/refunding CrewCall job:',
            jobId
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
            escrow_amount_cents:
              intent.amount_received,
            escrow_status: 'funded',
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

        const periods =
          getSubscriptionPeriods(subscription)

        const { error } =
          await supabase
            .from('subscriptions')
            .update({
              status,
              plan:
                subscription.items?.data?.[0]?.price?.id ===
                workerMembershipPriceId
                  ? 'worker_membership'
                  : subscription.items?.data?.[0]?.price?.id ===
                      workerProPriceId
                    ? 'worker_pro'
                    : subscription.items?.data?.[0]?.price?.id ===
                        foundingMemberPriceId
                      ? 'founding_member'
                      : subscription.metadata?.plan ||
                        undefined,
              stripe_subscription_id:
                subscription.id,
              stripe_price_id:
                subscription.items
                  ?.data?.[0]?.price?.id ??
                null,
              current_period_starts_at:
                periods.currentPeriodStartsAt,
              current_period_ends_at:
                periods.currentPeriodEndsAt,
              trial_starts_at:
                unixToIso(
                  subscription.trial_start
                ),
              trial_ends_at:
                unixToIso(
                  subscription.trial_end
                ),
              cancel_at_period_end:
                isSubscriptionScheduledToCancel(
                  subscription
                ),
              canceled_at:
                unixToIso(
                  subscription.canceled_at
                ),
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
