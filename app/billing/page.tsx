'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type BillingProfile = {
  id: string
  role: 'worker' | 'company' | null
  full_name: string | null
  company_name: string | null
  stripe_account_id: string | null
  stripe_onboarded: boolean | null
}

type UserState = {
  id: string
  email: string | null
}

type PlanCard = {
  name: string
  price: string
  description: string
  features: string[]
  cta: string
  highlighted?: boolean
}

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
  const [user, setUser] = useState<UserState | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [message, setMessage] = useState('')

  const loadBilling = useCallback(async () => {
    setLoading(true)
    setMessage('')

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      setMessage(`Auth error: ${authError.message}`)
      setLoading(false)
      return
    }

    if (!authUser) {
      setMessage('You must be logged in to view billing.')
      setProfile(null)
      setUser(null)
      setLoading(false)
      return
    }

    setUser({
      id: authUser.id,
      email: authUser.email ?? null,
    })

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, role, full_name, company_name, stripe_account_id, stripe_onboarded'
      )
      .eq('id', authUser.id)
      .maybeSingle<BillingProfile>()

    if (error) {
      setMessage(`Profile error: ${error.message}`)
      setProfile(null)
      setLoading(false)
      return
    }

    setProfile(data ?? null)
    setLoading(false)
  }, [])

  const markStripeOnboarded = useCallback(async () => {
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      setMessage(`Auth error: ${authError.message}`)
      return
    }

    if (!authUser) return

    const { error } = await supabase
      .from('profiles')
      .update({
        stripe_onboarded: true,
      })
      .eq('id', authUser.id)

    if (error) {
      setMessage(`Stripe update error: ${error.message}`)
      return
    }

    await loadBilling()
    setMessage('Stripe onboarding complete.')
    window.history.replaceState({}, '', '/billing')
  }, [loadBilling])

  useEffect(() => {
    void loadBilling()
  }, [loadBilling])

  useEffect(() => {
    const returnedFromStripe = searchParams.get('stripe_return')

    if (returnedFromStripe === 'true') {
      void markStripeOnboarded()
    }
  }, [markStripeOnboarded, searchParams])

  const accountName = useMemo(() => {
    return profile?.company_name || profile?.full_name || 'CrewCall account'
  }, [profile])

  const companyPlans: PlanCard[] = [
    {
      name: 'Company Starter',
      price: '$99/mo',
      description: 'For companies that need extra help a few times a month.',
      features: [
        'Post jobs',
        'Receive worker applications',
        'Message workers',
        'Hire through CrewCall',
        'Pay workers through Stripe',
      ],
      cta: 'Coming Soon',
    },
    {
      name: 'Company Pro',
      price: '$199/mo',
      description: 'Best for shops that regularly need reliable trade help.',
      highlighted: true,
      features: [
        'Everything in Starter',
        'Featured company placement',
        'Featured jobs included',
        'Priority worker recommendations',
        'Better visibility in search',
      ],
      cta: 'Coming Soon',
    },
    {
      name: 'Company Elite',
      price: '$399/mo',
      description: 'For contractors that want CrewCall as a serious hiring tool.',
      features: [
        'Everything in Pro',
        'Priority support',
        'Advanced hiring analytics',
        'Multiple managers',
        'Premium placement',
      ],
      cta: 'Coming Soon',
    },
  ]

  const workerPlans: PlanCard[] = [
    {
      name: 'Worker Free',
      price: '$0',
      description: 'Get hired and build your CrewCall reputation.',
      features: [
        'Create worker profile',
        'Apply to jobs',
        'Receive invites',
        'Message companies',
        'Get paid through Stripe',
      ],
      cta: 'Current Base Plan',
    },
    {
      name: 'Worker Pro',
      price: '$29/mo',
      description: 'Get more visibility and stand out to companies.',
      highlighted: true,
      features: [
        'Featured worker profile',
        'Higher search placement',
        'Pro badge',
        'More company visibility',
        'Priority job alerts',
      ],
      cta: 'Coming Soon',
    },
  ]

  async function handleConnectStripe() {
    if (!user?.id) {
      setMessage('You must be logged in to connect Stripe.')
      return
    }

    setConnecting(true)
    setMessage('')

    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      })

      const data = (await res.json()) as {
        url?: string
        error?: string
      }

      if (!res.ok) {
        setMessage(data.error || 'Stripe connect failed.')
        setConnecting(false)
        return
      }

      if (!data.url || typeof data.url !== 'string') {
        setMessage('Stripe did not return a valid onboarding link.')
        setConnecting(false)
        return
      }

      window.location.href = data.url
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Something went wrong.')
      setConnecting(false)
    }
  }

  if (loading) return <BillingLoading />

  const isCompany = profile?.role === 'company'
  const isWorker = profile?.role === 'worker'
  const plans = isWorker ? workerPlans : companyPlans

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 px-6 py-10 md:px-8 md:py-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  CrewCall Billing
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Billing & Stripe
                </h1>

                <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-300 md:text-base">
                  Manage payment setup, Stripe connection, future subscriptions,
                  and CrewCall account upgrades.
                </p>

                <p className="mt-4 text-sm font-black text-cyan-200">
                  {user?.email || 'No email loaded'}
                </p>
              </div>

              <Link
                href="/profile"
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white/15"
              >
                Back to Profile
              </Link>
            </div>
          </div>

          <div className="space-y-6 p-6 md:p-8">
            {message && (
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-sm font-bold text-cyan-100">
                {message}
              </div>
            )}

            {!profile ? (
              <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6">
                <h2 className="text-xl font-black text-red-100">
                  Profile not found
                </h2>

                <p className="mt-3 text-sm font-semibold leading-6 text-red-100/80">
                  CrewCall could not find a billing profile for this account.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-5 md:grid-cols-3">
                  <BillingStatCard label="Account" value={accountName} />
                  <BillingStatCard
                    label="Role"
                    value={profile.role || 'Role missing'}
                  />
                  <BillingStatCard
                    label="Stripe"
                    value={
                      profile.stripe_onboarded ? 'Connected' : 'Not Connected'
                    }
                    good={Boolean(profile.stripe_onboarded)}
                  />
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
                  <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                          Stripe Connect
                        </p>

                        <h2 className="mt-3 text-2xl font-black text-white">
                          Payment Setup
                        </h2>

                        <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
                          Stripe is used so companies can pay through CrewCall and
                          workers can receive payouts. Your current setup is kept
                          exactly how it already works.
                        </p>
                      </div>

                      <StatusPill
                        active={Boolean(profile.stripe_onboarded)}
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

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      {profile.stripe_onboarded ? (
                        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 text-sm font-black text-emerald-100">
                          Stripe Connected
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleConnectStripe()}
                          disabled={connecting}
                          className={`rounded-2xl px-6 py-3 text-sm font-black transition ${
                            connecting
                              ? 'cursor-not-allowed bg-slate-600 text-slate-300'
                              : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                          }`}
                        >
                          {connecting ? 'Opening Stripe...' : 'Connect Stripe'}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled
                        className="cursor-not-allowed rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-black text-slate-500"
                      >
                        Customer Portal Coming Soon
                      </button>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
                    <p className="text-xs font-black uppercase tracking-wide text-cyan-200">
                      Revenue Features
                    </p>

                    <h2 className="mt-3 text-2xl font-black text-white">
                      Next Money Features
                    </h2>

                    <div className="mt-5 space-y-3">
                      <FeatureRow text="Company subscriptions" />
                      <FeatureRow text="Worker Pro subscriptions" />
                      <FeatureRow text="Featured jobs billing" />
                      <FeatureRow text="Featured worker billing" />
                      <FeatureRow text="Stripe customer portal" />
                    </div>

                    <p className="mt-5 text-sm font-semibold leading-6 text-cyan-100/80">
                      This page is now ready for paid plans once the Stripe
                      subscription routes are added.
                    </p>
                  </section>
                </div>

                <section className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-cyan-300">
                        Plans
                      </p>

                      <h2 className="mt-3 text-3xl font-black text-white">
                        {isCompany
                          ? 'Company Plans'
                          : isWorker
                            ? 'Worker Plans'
                            : 'CrewCall Plans'}
                      </h2>

                      <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-400">
                        These cards are ready for subscription checkout routes.
                        For now, the buttons are safely disabled so nothing breaks.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-5 lg:grid-cols-3">
                    {plans.map((plan) => (
                      <PlanCardView key={plan.name} plan={plan} />
                    ))}
                  </div>
                </section>

                <section className="grid gap-5 lg:grid-cols-3">
                  <UpsellCard
                    title="Featured Job"
                    price="$25"
                    description="Boost one job for 7 days and place it higher in worker search."
                  />

                  <UpsellCard
                    title="Featured Worker"
                    price="$19"
                    description="Boost a worker profile and show companies this worker is available."
                  />

                  <UpsellCard
                    title="CrewCall Pro"
                    price="$199/mo"
                    description="Recurring company plan for shops that need consistent trade help."
                  />
                </section>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function BillingLoading() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl shadow-black/20 backdrop-blur">
        <p className="text-sm font-bold text-slate-300">Loading billing...</p>
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

function FeatureRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-cyan-400/10 bg-slate-950/30 px-4 py-3">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-xs font-black text-slate-950">
        ✓
      </span>
      <p className="text-sm font-bold text-cyan-50">{text}</p>
    </div>
  )
}

function PlanCardView({ plan }: { plan: PlanCard }) {
  return (
    <div
      className={`rounded-3xl border p-6 ${
        plan.highlighted
          ? 'border-cyan-300/40 bg-cyan-400/10'
          : 'border-white/10 bg-slate-950/50'
      }`}
    >
      {plan.highlighted && (
        <p className="mb-4 inline-flex rounded-full bg-cyan-400 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-950">
          Recommended
        </p>
      )}

      <h3 className="text-2xl font-black text-white">{plan.name}</h3>

      <p className="mt-3 text-4xl font-black text-white">{plan.price}</p>

      <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
        {plan.description}
      </p>

      <div className="mt-5 space-y-3">
        {plan.features.map((feature) => (
          <div key={feature} className="flex gap-3">
            <span className="text-cyan-300">✓</span>
            <p className="text-sm font-semibold text-slate-300">{feature}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled
        className={`mt-6 w-full cursor-not-allowed rounded-2xl px-5 py-3 text-sm font-black ${
          plan.highlighted
            ? 'bg-cyan-400/50 text-slate-950'
            : 'border border-white/10 bg-white/5 text-slate-500'
        }`}
      >
        {plan.cta}
      </button>
    </div>
  )
}

function UpsellCard({
  title,
  price,
  description,
}: {
  title: string
  price: string
  description: string
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
      <p className="text-xs font-black uppercase tracking-wide text-cyan-300">
        Add-On
      </p>

      <h3 className="mt-3 text-2xl font-black text-white">{title}</h3>

      <p className="mt-3 text-4xl font-black text-white">{price}</p>

      <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
        {description}
      </p>

      <button
        type="button"
        disabled
        className="mt-6 w-full cursor-not-allowed rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-500"
      >
        Checkout Coming Soon
      </button>
    </div>
  )
}