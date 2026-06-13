'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
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
  const companyDisplayName =
    profile?.company_name || profile?.full_name || 'Company account'

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 px-6 py-10 md:px-8 md:py-12">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
            CrewCall Billing
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
            Stripe Setup
          </h1>

          <p className="mt-4 text-sm font-semibold text-slate-300 md:text-base">
            {user?.email || 'No email loaded'}
          </p>
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
          ) : !isCompany ? (
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
              <h2 className="text-xl font-black text-white">
                Workers do not need Stripe billing setup yet
              </h2>

              <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
                Billing setup is currently for company accounts.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-5 md:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Company
                  </p>

                  <p className="mt-3 text-2xl font-black text-white">
                    {companyDisplayName}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 md:col-span-2">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Stripe Account ID
                  </p>

                  <p className="mt-3 break-all text-lg font-black text-white">
                    {profile.stripe_account_id || 'Not connected'}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Onboarding Status
                </p>

                <p className="mt-3 text-2xl font-black">
                  {profile.stripe_onboarded ? (
                    <span className="text-emerald-300">Connected</span>
                  ) : (
                    <span className="text-red-300">Not Connected</span>
                  )}
                </p>
              </div>

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
            </div>
          )}
        </div>
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