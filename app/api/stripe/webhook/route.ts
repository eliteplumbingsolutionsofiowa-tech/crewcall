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

type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'

type SubscriptionPeriods = {
  currentPeriodStartsAt: string | null
  currentPeriodEndsAt: string | null
}

function unixToIso(value: number | null | undefined) {
  return typeof value === 'number'
    ? new Date(value * 1000).toISOString()
    : null
}

function getSubscriptionPeriods(
  subscription: Stripe.Subscription
): SubscriptionPeriods {
  const items = subscription.items?.data ?? []

  const starts = items
    .map((item) => item.current_period_start)
    .filter((value): value is number => typeof value === 'number')

  const ends = items
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === 'number')

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

function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
) {
  if (!customer) return null
  return typeof customer === 'string' ? customer : customer.id
}

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice) {
  const invoiceWithParent = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null
    parent?: {
      subscription_details?: {
        subscription?: string | Stripe.Subscription | null
      } | null
    } | null
  }

  const subscription =
    invoiceWithParent.parent?.subscription_details?.subscription ??
    invoiceWithParent.subscription ??
    null

  if (!subscription) return null

  return typeof subscription === 'string'
    ? subscription
    : subscription.id
}

function normalizeStatus(
  status: Stripe.Subscription.Status
): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'unpaid':
    case 'canceled':
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return status
    default:
      return 'incomplete'
  }
}

function getPriceId(subscription: Stripe.Subscription) {
  return subscription.items?.data?.[0]?.price?.id ?? null
}

function getPlan(subscription: Stripe.Subscription) {
  return subscription.metadata?.plan || 'founding_member'
}

export async function POST(request: Request) {
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: 'Missing STRIPE_SECRET_KEY.' },
      { status: 500 }
    )
  }

  if (!stripeWebhookSecret) {
    return NextResponse.json(
      { error: 'Missing STRIPE_WEBHOOK_SECRET.' },
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

  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing Stripe signature.' },
      { status: 400 }
    )
  }

  const rawBody = await request.text()
  const stripe = new Stripe(stripeSecretKey)

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      stripeWebhookSecret
    )
  } catch (error) {
    console.error('Stripe webhook signature error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Invalid Stripe webhook signature.',
      },
      { status: 400 }
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

  async function findUserId({
    metadataUserId,
    customerId,
    subscriptionId,
  }: {
    metadataUserId?: string | null
    customerId?: string | null
    subscriptionId?: string | null
  }) {
    if (metadataUserId) return metadataUserId

    if (subscriptionId) {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscriptionId)
        .maybeSingle()

      if (error) {
        throw new Error(error.message)
      }

      if (data?.user_id) return data.user_id
    }

    if (customerId) {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle()

      if (error) {
        throw new Error(error.message)
      }

      if (data?.user_id) return data.user_id
    }

    return null
  }

  async function syncSubscription(
    subscription: Stripe.Subscription,
    fallbackUserId?: string | null
  ) {
    const customerId = getCustomerId(subscription.customer)
    const metadataUserId =
      subscription.metadata?.crewcall_user_id || fallbackUserId || null

    const userId = await findUserId({
      metadataUserId,
      customerId,
      subscriptionId: subscription.id,
    })

    if (!userId) {
      throw new Error(
        `Unable to match Stripe subscription ${subscription.id} to a CrewCall user.`
      )
    }

    const periods = getSubscriptionPeriods(subscription)
    const status = normalizeStatus(subscription.status)

    const { error } = await supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          plan: getPlan(subscription),
          status,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          stripe_price_id: getPriceId(subscription),
          current_period_starts_at:
            periods.currentPeriodStartsAt,
          current_period_ends_at:
            periods.currentPeriodEndsAt,
          trial_starts_at: unixToIso(
            subscription.trial_start
          ),
          trial_ends_at: unixToIso(subscription.trial_end),
          cancel_at_period_end:
            subscription.cancel_at_period_end,
          canceled_at:
            status === 'canceled'
              ? unixToIso(subscription.canceled_at) ||
                new Date().toISOString()
              : unixToIso(subscription.canceled_at),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )

    if (error) {
      throw new Error(error.message)
    }
  }

  async function syncSubscriptionById(
    subscriptionId: string,
    fallbackUserId?: string | null
  ) {
    const subscription =
      await stripe.subscriptions.retrieve(subscriptionId)

    await syncSubscription(subscription, fallbackUserId)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object

        // This webhook syncs CrewCall subscriptions only.
        // Job payments, boosts, and other one-time Checkout Sessions
        // must not be treated as subscriptions.
        if (session.mode !== 'subscription') {
          console.log(
            `Skipping non-subscription Checkout Session: ${session.id} (${session.mode})`
          )
          break
        }

        const userId =
          session.metadata?.crewcall_user_id ||
          session.client_reference_id ||
          null

        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id ?? null

        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id ?? null

        if (!userId) {
          throw new Error(
            `Checkout Session ${session.id} is missing a CrewCall user ID.`
          )
        }

        const { error } = await supabase
          .from('subscriptions')
          .upsert(
            {
              user_id: userId,
              plan:
                session.metadata?.plan ||
                'founding_member',
              status: 'active',
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'user_id',
            }
          )

        if (error) {
          throw new Error(error.message)
        }

        if (subscriptionId) {
          await syncSubscriptionById(
            subscriptionId,
            userId
          )
        }

        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed': {
        await syncSubscription(event.data.object)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        const subscriptionId =
          getSubscriptionIdFromInvoice(invoice)

        if (subscriptionId) {
          await syncSubscriptionById(subscriptionId)
        } else {
          const customerId = getCustomerId(invoice.customer)

          if (customerId) {
            const { error } = await supabase
              .from('subscriptions')
              .update({
                status: 'active',
                updated_at: new Date().toISOString(),
              })
              .eq('stripe_customer_id', customerId)

            if (error) {
              throw new Error(error.message)
            }
          }
        }

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subscriptionId =
          getSubscriptionIdFromInvoice(invoice)

        if (subscriptionId) {
          const subscription =
            await stripe.subscriptions.retrieve(
              subscriptionId
            )

          await syncSubscription(subscription)
        } else {
          const customerId = getCustomerId(invoice.customer)

          if (customerId) {
            const { error } = await supabase
              .from('subscriptions')
              .update({
                status: 'past_due',
                updated_at: new Date().toISOString(),
              })
              .eq('stripe_customer_id', customerId)

            if (error) {
              throw new Error(error.message)
            }
          }
        }

        break
      }

      default:
        console.log(
          `Unhandled Stripe event: ${event.type}`
        )
    }

    console.log(
      `Stripe webhook processed: ${event.type} (${event.id})`
    )

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(
      `Stripe webhook processing failed for ${event.type}:`,
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Stripe webhook processing failed.',
      },
      { status: 500 }
    )
  }
}