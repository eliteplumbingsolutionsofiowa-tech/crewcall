'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type BillingProfile = {
  id: string
  role: 'worker' | 'company'
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
  const searchParams = useSearchParams()

  const [profile, setProfile] = useState<BillingProfile | null>(null)
  const [user, setUser] = useState<UserState | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void loadBilling()
  }, [])

  useEffect(() => {
    const returnedFromStripe = searchParams.get('stripe_return')

    if (returnedFromStripe === 'true') {
      void markStripeOnboarded()
    }
  }, [searchParams])

  async function loadBilling() {
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
      .single()

    if (error) {
      setMessage(`Profile error: ${error.message}`)
      setLoading(false)
      return
    }

    setProfile(data as BillingProfile)
    setLoading(false)
  }

  async function markStripeOnboarded() {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) return

    const { error } = await supabase
      .from('profiles')
      .update({ stripe_onboarded: true })
      .eq('id', authUser.id)

    if (!error) {
      await loadBilling()
      setMessage('Stripe onboarding complete.')
      window.history.replaceState({}, '', '/billing')
    }
  }

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

      const data = await res.json()

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
    } catch (err: any) {
      setMessage(err.message || 'Something went wrong.')
      setConnecting(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 px-6 py-10">
        <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-gray-600">Loading billing...</p>
        </div>
      </main>
    )
  }

  const isCompany = profile?.role === 'company'

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-10">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="bg-gradient-to-r from-gray-900 to-slate-700 px-8 py-12 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-300">
            Billing
          </p>
          <h1 className="mt-3 text-5xl font-bold">Stripe Setup</h1>
          <p className="mt-4 text-lg text-gray-200">{user?.email || '-'}</p>
        </div>

        <div className="p-8">
          {message && (
            <div className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-red-700">
              {message}
            </div>
          )}

          {!isCompany ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Workers do not need Stripe yet
              </h2>
              <p className="mt-3 text-gray-600">
                Billing setup is currently for company accounts.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <p className="text-sm font-medium text-gray-500">Company</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {profile?.company_name || profile?.full_name || '-'}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <p className="text-sm font-medium text-gray-500">
                  Stripe Account ID
                </p>
                <p className="mt-2 text-lg font-semibold text-gray-900">
                  {profile?.stripe_account_id || 'Not connected'}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <p className="text-sm font-medium text-gray-500">
                  Onboarding Status
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {profile?.stripe_onboarded ? (
                    <span className="text-green-600">Connected</span>
                  ) : (
                    <span className="text-red-600">Not Connected</span>
                  )}
                </p>
              </div>

              {profile?.stripe_onboarded ? (
                <div className="rounded-xl bg-green-100 px-5 py-3 font-semibold text-green-700">
                  ✅ Stripe Connected
                </div>
              ) : (
                <button
                  onClick={() => void handleConnectStripe()}
                  disabled={connecting}
                  className={`rounded-xl px-6 py-3 font-semibold text-white ${
                    connecting
                      ? 'cursor-not-allowed bg-gray-400'
                      : 'bg-black hover:bg-gray-800'
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