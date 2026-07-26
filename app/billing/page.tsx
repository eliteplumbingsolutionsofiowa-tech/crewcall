'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type BillingProfile = {
  id: string
  role: 'worker' | 'company' | 'admin' | null
  full_name: string | null
  company_name: string | null
  stripe_account_id: string | null
  stripe_charges_enabled: boolean | null
  stripe_payouts_enabled: boolean | null
  stripe_details_submitted: boolean | null
}

type Subscription = {
  user_id: string
  plan: string
  status: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  trial_starts_at: string | null
  trial_ends_at: string | null
  current_period_starts_at: string | null
  current_period_ends_at: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
}

type AuthUser = {
  id: string
  email: string | null
}

const foundingMemberFeatures = [
  'Unlimited job postings',
  'Unlimited applicants',
  'Worker search',
  'Direct messaging',
  'Invite workers',
  'Job management',
  'Analytics dashboard',
  'Reviews and ratings',
  'File uploads',
  'Mobile access',
]

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingLoading />}>
      <BillingContent />
    </Suspense>
  )
}

function BillingContent() {
  const searchParams = useSearchParams()

  const [profile, setProfile] = useState<BillingProfile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)

  const [loading, setLoading] = useState(true)
  const [startingCheckout, setStartingCheckout] = useState(false)
  const [connectingStripe, setConnectingStripe] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<
    'info' | 'success' | 'error'
  >('info')

  const loadBilling = useCallback(async () => {
    setLoading(true)

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      setMessage(authError.message)
      setMessageTone('error')
      setLoading(false)
      return
    }

    if (!authUser) {
      setUser(null)
      setProfile(null)
      setSubscription(null)
      setMessage('You must be logged in to view billing.')
      setMessageTone('error')
      setLoading(false)
      return
    }

    setUser({
      id: authUser.id,
      email: authUser.email ?? null,
    })

    const [
      { data: profileData, error: profileError },
      { data: subscriptionData, error: subscriptionError },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          [
            'id',
            'role',
            'full_name',
            'company_name',
            'stripe_account_id',
            'stripe_charges_enabled',
            'stripe_payouts_enabled',
            'stripe_details_submitted',
          ].join(', ')
        )
        .eq('id', authUser.id)
        .maybeSingle<BillingProfile>(),

      supabase
        .from('subscriptions')
        .select(
          [
            'user_id',
            'plan',
            'status',
            'stripe_customer_id',
            'stripe_subscription_id',
            'trial_starts_at',
            'trial_ends_at',
            'current_period_starts_at',
            'current_period_ends_at',
            'cancel_at_period_end',
            'canceled_at',
          ].join(', ')
        )
        .eq('user_id', authUser.id)
        .maybeSingle<Subscription>(),
    ])

    if (profileError) {
      setMessage(`Profile error: ${profileError.message}`)
      setMessageTone('error')
      setLoading(false)
      return
    }

    if (subscriptionError) {
      setMessage(`Subscription error: ${subscriptionError.message}`)
      setMessageTone('error')
      setLoading(false)
      return
    }

    setProfile(profileData ?? null)
    setSubscription(subscriptionData ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadBilling()
  }, [loadBilling])

  useEffect(() => {
    const result = searchParams.get('subscription')

    if (result === 'success') {
      setMessage(
        'Stripe Checkout completed. Your membership is being activated.'
      )
      setMessageTone('success')
      void loadBilling()
      window.history.replaceState({}, '', '/billing')
    }

    if (result === 'canceled') {
      setMessage('Stripe Checkout was canceled. No charge was made.')
      setMessageTone('info')
      window.history.replaceState({}, '', '/billing')
    }
  }, [loadBilling, searchParams])

  const accountName = useMemo(() => {
    return profile?.company_name || profile?.full_name || 'CrewCall account'
  }, [profile])

  const isCompany =
    profile?.role === 'company' || profile?.role === 'admin'

  const isWorker = profile?.role === 'worker'

  const stripeConnected = Boolean(
    profile?.stripe_account_id &&
      profile?.stripe_details_submitted &&
      profile?.stripe_payouts_enabled
  )

  const membershipActive = Boolean(
    subscription?.stripe_subscription_id &&
      ['active', 'trialing', 'past_due'].includes(subscription.status)
  )

  const trialActive = useMemo(() => {
    if (subscription?.status !== 'trialing' || !subscription.trial_ends_at) {
      return false
    }

    return new Date(subscription.trial_ends_at).getTime() > Date.now()
  }, [subscription])

  const trialDaysRemaining = useMemo(() => {
    if (!trialActive || !subscription?.trial_ends_at) return 0

    const milliseconds =
      new Date(subscription.trial_ends_at).getTime() - Date.now()

    return Math.max(
      0,
      Math.ceil(milliseconds / (1000 * 60 * 60 * 24))
    )
  }, [subscription, trialActive])

  async function handleStartSubscription() {
    setStartingCheckout(true)
    setMessage('')

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        throw new Error(sessionError.message)
      }

      if (!session?.access_token) {
        throw new Error('You must be logged in to start a membership.')
      }

      const response = await fetch(
        '/api/stripe/subscription-checkout',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const data = (await response.json()) as {
        url?: string
        error?: string
        code?: string
      }

      if (!response.ok) {
        throw new Error(
          data.error || 'Unable to open Stripe Checkout.'
        )
      }

      if (!data.url) {
        throw new Error('Stripe did not return a Checkout URL.')
      }

      window.location.href = data.url
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to start membership.'
      )
      setMessageTone('error')
      setStartingCheckout(false)
    }
  }

  async function handleConnectStripe() {
    setConnectingStripe(true)
    setMessage('')

    try {
      if (!user?.id || !user.email) {
        throw new Error(
          'Your account must have an email address to connect Stripe.'
        )
      }

      const response = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
        }),
      })

      const data = (await response.json()) as {
        url?: string
        error?: string
      }

      if (!response.ok) {
        throw new Error(data.error || 'Stripe Connect failed.')
      }

      if (!data.url) {
        throw new Error('Stripe did not return an onboarding link.')
      }

      window.location.href = data.url
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to connect Stripe.'
      )
      setMessageTone('error')
      setConnectingStripe(false)
    }
  }

  if (loading) {
    return <BillingLoading />
  }

  return (
    <main className="min-h-screen px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 px-6 py-10 md:px-8 md:py-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  CrewCall Billing
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                  Billing & Membership
                </h1>

                <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-300 md:text-base">
                  Manage your CrewCall membership and worker payout
                  account.
                </p>

                <p className="mt-4 text-sm font-black text-cyan-200">
                  {user?.email || 'No email loaded'}
                </p>
              </div>

              <Link
                href="/profile"
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-black transition hover:bg-white/15"
              >
                Back to Profile
              </Link>
            </div>
          </div>

          <div className="space-y-6 p-6 md:p-8">
            {message && (
              <MessageBox tone={messageTone}>
                {message}
              </MessageBox>
            )}

            {!profile ? (
              <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6">
                <h2 className="text-xl font-black text-red-100">
                  Profile not found
                </h2>

                <p className="mt-3 text-sm font-semibold text-red-100/80">
                  CrewCall could not find a profile for this account.
                </p>
              </div>
            ) : (
              <>
                <section className="grid gap-5 md:grid-cols-3">
                  <BillingStatCard
                    label="Account"
                    value={accountName}
                  />

                  <BillingStatCard
                    label="Role"
                    value={
                      profile.role === 'admin'
                        ? 'Company Admin'
                        : profile.role
                          ? capitalize(profile.role)
                          : 'Role missing'
                    }
                  />

                  <BillingStatCard
                    label={isCompany ? 'Membership' : 'Stripe Payouts'}
                    value={
                      isCompany
                        ? formatSubscriptionStatus(subscription)
                        : stripeConnected
                          ? 'Connected'
                          : 'Not Connected'
                    }
                    good={
                      isCompany
                        ? membershipActive || trialActive
                        : stripeConnected
                    }
                  />
                </section>

                {isCompany && (
                  <CompanyMembershipSection
                    subscription={subscription}
                    membershipActive={membershipActive}
                    trialActive={trialActive}
                    trialDaysRemaining={trialDaysRemaining}
                    startingCheckout={startingCheckout}
                    onStartSubscription={() =>
                      void handleStartSubscription()
                    }
                  />
                )}

                {isWorker && (
                  <WorkerStripeSection
                    profile={profile}
                    stripeConnected={stripeConnected}
                    connectingStripe={connectingStripe}
                    onConnect={() => void handleConnectStripe()}
                  />
                )}

                {!isCompany && !isWorker && (
                  <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-6">
                    <h2 className="text-2xl font-black text-amber-100">
                      Account role required
                    </h2>

                    <p className="mt-3 text-sm font-semibold text-amber-100/80">
                      Finish setting up your CrewCall profile before
                      managing billing.
                    </p>

                    <Link
                      href="/profile"
                      className="mt-5 inline-flex rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950"
                    >
                      Complete Profile
                    </Link>
                  </section>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function CompanyMembershipSection({
  subscription,
  membershipActive,
  trialActive,
  trialDaysRemaining,
  startingCheckout,
  onStartSubscription,
}: {
  subscription: Subscription | null
  membershipActive: boolean
  trialActive: boolean
  trialDaysRemaining: number
  startingCheckout: boolean
  onStartSubscription: () => void
}) {
  const hasPaidStripeSubscription = Boolean(
    subscription?.stripe_subscription_id
  )

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="rounded-[2rem] border-2 border-cyan-400 bg-cyan-400/10 p-7 shadow-2xl shadow-cyan-500/10 md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex rounded-full bg-cyan-400 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-950">
              Founding Member
            </div>

            <h2 className="mt-5 text-3xl font-black">
              CrewCall Company Membership
            </h2>

            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
              Everything your company needs to find workers, manage
              jobs, communicate, and hire through CrewCall.
            </p>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-5xl font-black text-cyan-300">
              $29
            </p>
            <p className="mt-1 font-bold text-slate-300">
              per month
            </p>
          </div>
        </div>

        {trialActive && !hasPaidStripeSubscription && (
          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <p className="font-black text-emerald-200">
              Your free trial is active
            </p>

            <p className="mt-2 text-sm font-semibold text-emerald-100/80">
              {trialDaysRemaining}{' '}
              {trialDaysRemaining === 1 ? 'day' : 'days'} remaining.
              Subscribe now to keep CrewCall active after your trial.
            </p>
          </div>
        )}

        {membershipActive && hasPaidStripeSubscription && (
          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <p className="font-black text-emerald-200">
              Your CrewCall membership is active
            </p>

            {subscription?.current_period_ends_at && (
              <p className="mt-2 text-sm font-semibold text-emerald-100/80">
                Current billing period ends{' '}
                {formatDate(subscription.current_period_ends_at)}.
              </p>
            )}

            {subscription?.cancel_at_period_end && (
              <p className="mt-2 text-sm font-black text-amber-200">
                Your membership is scheduled to cancel at the end of
                the current billing period.
              </p>
            )}
          </div>
        )}

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {foundingMemberFeatures.map((feature) => (
            <div
              key={feature}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-xs font-black text-slate-950">
                ✓
              </span>

              <p className="text-sm font-bold text-slate-200">
                {feature}
              </p>
            </div>
          ))}
        </div>

        {!hasPaidStripeSubscription ? (
          <button
            type="button"
            onClick={onStartSubscription}
            disabled={startingCheckout}
            className={`mt-8 w-full rounded-2xl px-6 py-4 text-lg font-black transition ${
              startingCheckout
                ? 'cursor-not-allowed bg-slate-600 text-slate-300'
                : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
            }`}
          >
            {startingCheckout
              ? 'Opening Stripe Checkout...'
              : trialActive
                ? 'Activate $29/Month Membership'
                : 'Start $29/Month Membership'}
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="mt-8 w-full cursor-not-allowed rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-6 py-4 text-lg font-black text-emerald-200"
          >
            Membership Active
          </button>
        )}

        <p className="mt-4 text-center text-sm font-bold text-slate-400">
          Founding Member pricing. Cancel anytime. No contracts.
        </p>
      </div>

      <aside className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-7">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          Membership Details
        </p>

        <div className="mt-6 space-y-5">
          <DetailRow
            label="Plan"
            value={
              subscription?.plan
                ? formatPlan(subscription.plan)
                : 'Starter Trial'
            }
          />

          <DetailRow
            label="Status"
            value={formatSubscriptionStatus(subscription)}
          />

          <DetailRow
            label="Trial Ends"
            value={
              subscription?.trial_ends_at
                ? formatDate(subscription.trial_ends_at)
                : 'Not available'
            }
          />

          <DetailRow
            label="Billing Period Ends"
            value={
              subscription?.current_period_ends_at
                ? formatDate(subscription.current_period_ends_at)
                : 'Not started'
            }
          />

          <DetailRow
            label="Cancel at Period End"
            value={
              subscription?.cancel_at_period_end ? 'Yes' : 'No'
            }
          />
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold leading-6 text-slate-400">
            The customer portal will be added next so members can
            update payment methods, view invoices, and cancel their
            membership.
          </p>
        </div>
      </aside>
    </section>
  )
}

function WorkerStripeSection({
  profile,
  stripeConnected,
  connectingStripe,
  onConnect,
}: {
  profile: BillingProfile
  stripeConnected: boolean
  connectingStripe: boolean
  onConnect: () => void
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-7 md:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            Worker Payouts
          </p>

          <h2 className="mt-3 text-3xl font-black">
            Stripe Connect
          </h2>

          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
            Connect Stripe so companies can pay you securely through
            CrewCall.
          </p>
        </div>

        <StatusPill
          active={stripeConnected}
          activeText="Connected"
          inactiveText="Not Connected"
        />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
          Stripe Account ID
        </p>

        <p className="mt-3 break-all text-sm font-black text-white md:text-base">
          {profile.stripe_account_id || 'Not connected'}
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ConnectionStat
          label="Details Submitted"
          active={Boolean(profile.stripe_details_submitted)}
        />

        <ConnectionStat
          label="Charges Enabled"
          active={Boolean(profile.stripe_charges_enabled)}
        />

        <ConnectionStat
          label="Payouts Enabled"
          active={Boolean(profile.stripe_payouts_enabled)}
        />
      </div>

      {!stripeConnected && (
        <button
          type="button"
          onClick={onConnect}
          disabled={connectingStripe}
          className={`mt-7 rounded-2xl px-6 py-4 text-sm font-black transition ${
            connectingStripe
              ? 'cursor-not-allowed bg-slate-600 text-slate-300'
              : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
          }`}
        >
          {connectingStripe
            ? 'Opening Stripe...'
            : profile.stripe_account_id
              ? 'Continue Stripe Setup'
              : 'Connect Stripe'}
        </button>
      )}
    </section>
  )
}

function BillingLoading() {
  return (
    <main className="min-h-screen px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/10 p-8 backdrop-blur">
        <p className="text-sm font-bold text-slate-300">
          Loading billing...
        </p>
      </div>
    </main>
  )
}

function BillingStatCard({
  label,
  value,
  good,
}: {
  label: string
  value: string
  good?: boolean
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-3 break-words text-2xl font-black ${
          good ? 'text-emerald-300' : 'text-white'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function StatusPill({
  active,
  activeText,
  inactiveText,
}: {
  active: boolean
  activeText: string
  inactiveText: string
}) {
  return (
    <span
      className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide ${
        active
          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
          : 'border-red-400/30 bg-red-400/10 text-red-100'
      }`}
    >
      {active ? activeText : inactiveText}
    </span>
  )
}

function ConnectionStat({
  label,
  active,
}: {
  label: string
  active: boolean
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-2 font-black ${
          active ? 'text-emerald-300' : 'text-slate-400'
        }`}
      >
        {active ? 'Yes' : 'No'}
      </p>
    </div>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words font-black text-white">
        {value}
      </p>
    </div>
  )
}

function MessageBox({
  tone,
  children,
}: {
  tone: 'info' | 'success' | 'error'
  children: React.ReactNode
}) {
  const styles = {
    info: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
    success:
      'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
    error: 'border-red-400/30 bg-red-400/10 text-red-100',
  }

  return (
    <div
      className={`rounded-2xl border px-5 py-4 text-sm font-bold ${styles[tone]}`}
    >
      {children}
    </div>
  )
}

function formatSubscriptionStatus(
  subscription: Subscription | null
) {
  if (!subscription) return 'No membership'

  const labels: Record<string, string> = {
    trialing: 'Free Trial',
    active: 'Active',
    past_due: 'Past Due',
    unpaid: 'Unpaid',
    canceled: 'Canceled',
    incomplete: 'Incomplete',
    incomplete_expired: 'Expired',
    paused: 'Paused',
  }

  return labels[subscription.status] || capitalize(subscription.status)
}

function formatPlan(plan: string) {
  return plan
    .split('_')
    .map(capitalize)
    .join(' ')
}

function capitalize(value: string) {
  if (!value) return value

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}