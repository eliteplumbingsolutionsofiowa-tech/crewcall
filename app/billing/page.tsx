'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isNativeIOS } from '@/app/lib/nativePlatform'

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
  const t = useTranslations('Billing')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const nativeIOS = isNativeIOS()

  const [profile, setProfile] = useState<BillingProfile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)

  const [loading, setLoading] = useState(true)
  const [startingCheckout, setStartingCheckout] = useState(false)
  const [connectingStripe, setConnectingStripe] = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<
    'info' | 'success' | 'error'
  >('info')


  useEffect(() => {
    let active = true

    function withTimeout<T>(
      promise: PromiseLike<T>,
      label: string,
      milliseconds = 10000
    ): Promise<T> {
      return Promise.race([
        Promise.resolve(promise),
        new Promise<T>((_, reject) => {
          window.setTimeout(() => {
            reject(new Error(`${label} timed out.`))
          }, milliseconds)
        }),
      ])
    }

    async function loadBillingData() {
      setLoading(true)
      setMessage('')

      try {
        const authResult = await withTimeout(
          supabase.auth.getUser(),
          'Authentication'
        )

        if (authResult.error) {
          throw new Error(authResult.error.message)
        }

        const authUser = authResult.data.user

        if (!authUser) {
          throw new Error('You must be logged in to view billing.')
        }

        if (!active) return

        setUser({
          id: authUser.id,
          email: authUser.email ?? null,
        })

        const profileResult = await withTimeout(
          supabase
            .from('profiles')
            .select(
              `
                id,
                role,
                full_name,
                company_name,
                stripe_account_id,
                stripe_charges_enabled,
                stripe_payouts_enabled,
                stripe_details_submitted
              `
            )
            .eq('id', authUser.id)
            .maybeSingle(),
          'Profile request'
        )

        if (profileResult.error) {
          throw new Error(`Profile error: ${profileResult.error.message}`)
        }

        if (!active) return

        setProfile(profileResult.data as BillingProfile | null)

        const subscriptionResult = await withTimeout(
          supabase
            .from('subscriptions')
            .select(
              `
                id,
                user_id,
                plan,
                status,
                stripe_customer_id,
                stripe_subscription_id,
                trial_ends_at,
                current_period_ends_at,
                cancel_at_period_end
              `
            )
            .eq('user_id', authUser.id)
            .maybeSingle(),
          'Subscription request'
        )

        if (subscriptionResult.error) {
          throw new Error(
            `Subscription error: ${subscriptionResult.error.message}`
          )
        }

        if (!active) return

        setSubscription(
          subscriptionResult.data as Subscription | null
        )
      } catch (error) {
        console.warn('Billing page load failed')

        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load billing information.'
          )
          setMessageTone('error')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadBillingData()

    return () => {
      active = false
    }
  }, [])


  async function handleStartSubscription() {
    if (nativeIOS) {
      setMessage(
        'Membership purchasing is not available in the iOS app.'
      )
      setMessageTone('info')
      return
    }

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
    if (
      subscription?.status !== 'trialing' ||
      !subscription.trial_ends_at
    ) {
      return false
    }

    return (
      new Date(subscription.trial_ends_at).getTime() >
      Date.now()
    )
  }, [subscription])

  const trialDaysRemaining = useMemo(() => {
    if (!trialActive || !subscription?.trial_ends_at) {
      return 0
    }

    const milliseconds =
      new Date(subscription.trial_ends_at).getTime() -
      Date.now()

    return Math.max(
      0,
      Math.ceil(
        milliseconds /
          (1000 * 60 * 60 * 24)
      )
    )
  }, [subscription, trialActive])

  const accountName = useMemo(() => {
    return profile?.company_name || profile?.full_name || 'CrewCall account'
  }, [profile])



  async function openCustomerPortal() {
    setOpeningPortal(true)
    setMessage('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('You must be logged in.')
      }

      const response = await fetch(
        '/api/stripe/customer-portal',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || 'Unable to open billing portal.'
        )
      }

      if (!data.url) {
        throw new Error('Stripe did not return a portal URL.')
      }

      window.location.href = data.url

    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to open billing portal.'
      )
      setMessageTone('error')
    } finally {
      setOpeningPortal(false)
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
                  {t('eyebrow')}
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                  {t('title')}
                </h1>

                <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-300 md:text-base">
                  {t('description')}
                </p>

                <p className="mt-4 text-sm font-black text-cyan-200">
                  {user?.email || 'No email loaded'}
                </p>
              </div>

              <Link
                href="/profile"
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-black transition hover:bg-white/15"
              >
                {t('backToProfile')}
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
                  {t('profileNotFound')}
                </h2>

                <p className="mt-3 text-sm font-semibold text-red-100/80">
                  {t('profileNotFoundDescription')}
                </p>
              </div>
            ) : (
              <>
                <section className="grid gap-5 md:grid-cols-3">
                  <BillingStatCard
                    label={t('account')}
                    value={accountName}
                  />

                  <BillingStatCard
                    label={t('role')}
                    value={
                      profile.role === 'admin'
                        ? t('companyAdmin')
                        : profile.role
                          ? capitalize(profile.role)
                          : t('roleMissing')
                    }
                  />

                  <BillingStatCard
                    label={isCompany ? t('membership') : t('stripePayouts')}
                    value={
                      isCompany
                        ? formatSubscriptionStatus(subscription, t)
                        : stripeConnected
                          ? t('connected')
                          : t('notConnected')
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
                    openingPortal={openingPortal}
                    onOpenCustomerPortal={() =>
                      void openCustomerPortal()
                    }
                    nativeIOS={nativeIOS}
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
                      {t('accountRoleRequired')}
                    </h2>

                    <p className="mt-3 text-sm font-semibold text-amber-100/80">
                      {t('finishProfileBeforeBilling')}
                    </p>

                    <Link
                      href="/profile"
                      className="mt-5 inline-flex rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950"
                    >
                      {t('completeProfile')}
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
  openingPortal,
  onOpenCustomerPortal,
  nativeIOS,
}: {
  subscription: Subscription | null
  membershipActive: boolean
  trialActive: boolean
  trialDaysRemaining: number
  startingCheckout: boolean
  onStartSubscription: () => void
  openingPortal: boolean
  onOpenCustomerPortal: () => void
  nativeIOS: boolean
}) {
  const t = useTranslations('Billing')
  const locale = useLocale()

  const hasPaidStripeSubscription = Boolean(
    subscription?.stripe_subscription_id
  )

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="rounded-[2rem] border-2 border-cyan-400 bg-cyan-400/10 p-7 shadow-2xl shadow-cyan-500/10 md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex rounded-full bg-cyan-400 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-950">
              {t('foundingMember')}
            </div>

            <h2 className="mt-5 text-3xl font-black">
              {t('companyMembership')}
            </h2>

            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
              {t('companyMembershipDescription')}
            </p>
          </div>

          {!nativeIOS ? (
            <div className="text-left sm:text-right">
              <p className="text-5xl font-black text-cyan-300">
                $29
              </p>
              <p className="mt-1 font-bold text-slate-300">
                {t('perMonth')}
              </p>
            </div>
          ) : null}
        </div>

        {trialActive && !hasPaidStripeSubscription && (
          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <p className="font-black text-emerald-200">
              {t('yourFreeTrialActive')}
            </p>

            <p className="mt-2 text-sm font-semibold text-emerald-100/80">
              {t('trialRemaining', {
                count: trialDaysRemaining,
              })}
              {!nativeIOS
                ? ` ${t('subscribeAfterTrial')}`
                : ''}
            </p>
          </div>
        )}

        {membershipActive && hasPaidStripeSubscription && (
          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <p className="font-black text-emerald-200">
              {t('yourMembershipActive')}
            </p>

            {!nativeIOS ? (
              <button
                type="button"
                onClick={onOpenCustomerPortal}
                disabled={openingPortal}
                className="mt-4 rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/20 disabled:opacity-50"
              >
                {openingPortal
                  ? t('opening')
                  : t('manageSubscription')}
              </button>
            ) : null}

            {subscription?.current_period_ends_at && (
              <p className="mt-2 text-sm font-semibold text-emerald-100/80">
                {t('currentBillingPeriodEnds', {
                  date: new Date(
                    subscription.current_period_ends_at
                  ).toLocaleDateString(locale),
                })}
              </p>
            )}

            {subscription?.cancel_at_period_end && (
              <p className="mt-2 text-sm font-black text-amber-200">
                {t('scheduledToCancel')}
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

        {nativeIOS ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center">
            <p className="text-lg font-black text-white">
              {membershipActive
                ? t('membershipActive')
                : trialActive
                  ? t('freeTrialActive')
                  : t('membershipStatus')}
            </p>

            <p className="mt-2 text-sm font-semibold text-slate-400">
              {t('viewMembershipStatus')}
            </p>
          </div>
        ) : !hasPaidStripeSubscription ? (
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
              ? t('openingCheckout')
              : trialActive
                ? t('activateMembership')
                : t('startMonthlyMembership')}
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="mt-8 w-full cursor-not-allowed rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-6 py-4 text-lg font-black text-emerald-200"
          >
            {t('membershipActive')}
          </button>
        )}

        {!nativeIOS ? (
          <p className="mt-4 text-center text-sm font-bold text-slate-400">
            {t('foundingMemberPricing')}
          </p>
        ) : null}
      </div>

      <aside className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-7">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          {t('membershipDetails')}
        </p>

        <div className="mt-6 space-y-5">
          <DetailRow
            label={t('plan')}
            value={
              subscription?.plan
                ? formatPlan(subscription.plan, t)
                : t('starterTrial')
            }
          />

          <DetailRow
            label={t('status')}
            value={formatSubscriptionStatus(subscription, t)}
          />

          <DetailRow
            label={t('trialEnds')}
            value={
              subscription?.trial_ends_at
                ? formatDate(subscription.trial_ends_at, locale)
                : t('notAvailable')
            }
          />

          <DetailRow
            label={t('billingPeriodEnds')}
            value={
              subscription?.current_period_ends_at
                ? formatDate(subscription.current_period_ends_at, locale)
                : t('notStarted')
            }
          />

          <DetailRow
            label={t('cancelAtPeriodEnd')}
            value={
              subscription?.cancel_at_period_end ? t('yes') : t('no')
            }
          />
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold leading-6 text-slate-400">
            {t('customerPortalDescription')}
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
  const t = useTranslations('Billing')

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-7 md:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            {t('workerPayouts')}
          </p>

          <h2 className="mt-3 text-3xl font-black">
            {t('stripeConnect')}
          </h2>

          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
            {t('stripeDescription')}
          </p>
        </div>

        <StatusPill
          active={stripeConnected}
          activeText={t('connected')}
          inactiveText={t('notConnected')}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
          {t('stripeAccountId')}
        </p>

        <p className="mt-3 break-all text-sm font-black text-white md:text-base">
          {profile.stripe_account_id || t('notConnected')}
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ConnectionStat
          label={t('detailsSubmitted')}
          active={Boolean(profile.stripe_details_submitted)}
        />

        <ConnectionStat
          label={t('chargesEnabled')}
          active={Boolean(profile.stripe_charges_enabled)}
        />

        <ConnectionStat
          label={t('payoutsEnabled')}
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
            ? t('openingStripe')
            : profile.stripe_account_id
              ? t('continueStripeSetup')
              : t('connectStripe')}
        </button>
      )}
    </section>
  )
}

function BillingLoading() {
  const t = useTranslations('Billing')

  return (
    <main className="min-h-screen px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/10 p-8 backdrop-blur">
        <p className="text-sm font-bold text-slate-300">
          {t('loading')}
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
  const t = useTranslations('Billing')

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
        {active ? t('yes') : t('no')}
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
  subscription: Subscription | null,
  t: ReturnType<typeof useTranslations>
) {
  if (!subscription) return t('noMembership')

  const labels: Record<string, string> = {
    trialing: t('freeTrial'),
    active: t('active'),
    past_due: t('pastDue'),
    unpaid: t('unpaid'),
    canceled: t('canceled'),
    incomplete: t('incomplete'),
    incomplete_expired: t('expired'),
    paused: t('paused'),
  }

  return labels[subscription.status] || capitalize(subscription.status)
}

function formatPlan(
  plan: string,
  t: ReturnType<typeof useTranslations>
) {
  const labels: Record<string, string> = {
    starter: t('starter'),
    professional: t('professional'),
    enterprise: t('enterprise'),
    monthly: t('monthly'),
    annual: t('annual'),
  }

  return (
    labels[plan] ||
    plan
      .split('_')
      .map((part) => labels[part] || capitalize(part))
      .join(' ')
  )
}

function capitalize(value: string) {
  if (!value) return value

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDate(
  value: string,
  locale: string
) {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}
