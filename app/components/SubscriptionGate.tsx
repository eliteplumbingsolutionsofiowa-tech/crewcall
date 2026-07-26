'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'

type ProfileRow = {
  role: string | null
}

type SubscriptionRow = {
  id: string
  user_id: string
  plan: string
  status: SubscriptionStatus
  trial_starts_at: string | null
  trial_ends_at: string | null
  current_period_starts_at: string | null
  current_period_ends_at: string | null
  cancel_at_period_end: boolean
}

type SubscriptionGateProps = {
  children: React.ReactNode
}

function isDateInFuture(value: string | null) {
  if (!value) {
    return false
  }

  const timestamp = new Date(value).getTime()

  if (Number.isNaN(timestamp)) {
    return false
  }

  return timestamp > Date.now()
}

function subscriptionAllowsAccess(
  subscription: SubscriptionRow
) {
  if (subscription.status === 'active') {
    return true
  }

  if (
    subscription.status === 'trialing' &&
    isDateInFuture(subscription.trial_ends_at)
  ) {
    return true
  }

  return false
}

function getSubscriptionReason(
  subscription: SubscriptionRow
) {
  if (
    subscription.status === 'trialing' &&
    !isDateInFuture(subscription.trial_ends_at)
  ) {
    return 'trial-expired'
  }

  return subscription.status
}

export default function SubscriptionGate({
  children,
}: SubscriptionGateProps) {
  const pathname = usePathname()

  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [message, setMessage] = useState<string | null>(
    null
  )

  useEffect(() => {
    let active = true

    async function checkSubscription() {
      setChecking(true)
      setAllowed(false)
      setMessage(null)

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          throw userError
        }

        if (!user) {
          window.location.assign(
            `/login?redirect=${encodeURIComponent(pathname)}`
          )
          return
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle<ProfileRow>()

        if (profileError) {
          throw profileError
        }

        /*
         * Administrators always retain access to protected
         * company pages, regardless of subscription status.
         */
        if (profile?.role === 'admin') {
          if (!active) {
            return
          }

          setAllowed(true)
          setChecking(false)
          return
        }

        const {
          data: existingSubscription,
          error: subscriptionError,
        } = await supabase
          .from('subscriptions')
          .select(
            [
              'id',
              'user_id',
              'plan',
              'status',
              'trial_starts_at',
              'trial_ends_at',
              'current_period_starts_at',
              'current_period_ends_at',
              'cancel_at_period_end',
            ].join(', ')
          )
          .eq('user_id', user.id)
          .maybeSingle<SubscriptionRow>()

        if (subscriptionError) {
          throw subscriptionError
        }

        let subscription = existingSubscription

        /*
         * Older accounts may have been created before the
         * subscriptions trigger existed. Create a 14-day trial
         * the first time one of those accounts enters a protected
         * area.
         */
        if (!subscription) {
          const trialStartsAt = new Date()
          const trialEndsAt = new Date(
            trialStartsAt.getTime() +
              14 * 24 * 60 * 60 * 1000
          )

          const {
            data: createdSubscription,
            error: createError,
          } = await supabase
            .from('subscriptions')
            .insert({
              user_id: user.id,
              plan: 'starter',
              status: 'trialing',
              trial_starts_at:
                trialStartsAt.toISOString(),
              trial_ends_at: trialEndsAt.toISOString(),
            })
            .select(
              [
                'id',
                'user_id',
                'plan',
                'status',
                'trial_starts_at',
                'trial_ends_at',
                'current_period_starts_at',
                'current_period_ends_at',
                'cancel_at_period_end',
              ].join(', ')
            )
            .single<SubscriptionRow>()

          if (createError) {
            throw createError
          }

          subscription = createdSubscription
        }

        if (subscriptionAllowsAccess(subscription)) {
          if (!active) {
            return
          }

          setAllowed(true)
          setChecking(false)
          return
        }

        const reason =
          getSubscriptionReason(subscription)

        window.location.assign(
          `/billing?reason=${encodeURIComponent(reason)}`
        )
      } catch (error) {
        console.error(
          'CrewCall subscription check failed:',
          error
        )

        if (!active) {
          return
        }

        setMessage(
          error instanceof Error
            ? error.message
            : 'CrewCall could not verify your subscription.'
        )

        setChecking(false)
      }
    }

    void checkSubscription()

    return () => {
      active = false
    }
  }, [pathname])

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-white">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-cyan-400" />

          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            CrewCall
          </p>

          <h1 className="mt-3 text-xl font-black">
            Checking your access
          </h1>

          <p className="mt-2 text-sm font-semibold text-slate-400">
            Verifying your trial or subscription.
          </p>
        </div>
      </main>
    )
  }

  if (message) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-white">
        <div className="w-full max-w-md rounded-[2rem] border border-red-400/20 bg-red-500/10 p-8 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-red-300">
            Access check failed
          </p>

          <h1 className="mt-3 text-2xl font-black">
            We couldn&apos;t verify your account
          </h1>

          <p className="mt-3 text-sm font-semibold leading-6 text-red-100/80">
            {message}
          </p>

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100"
            >
              Try Again
            </button>

            <button
              type="button"
              onClick={() =>
                window.location.assign('/billing')
              }
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
            >
              Go to Billing
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (!allowed) {
    return null
  }

  return <>{children}</>
}