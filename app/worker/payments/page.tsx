'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/formatMoney'

type WorkerProfile = {
  id: string
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean | null
}

type PaymentRow = {
  id: string
  title: string | null
  pay_rate: string | null
  worker_payout_cents: number | null
  platform_fee_cents: number | null
  payout_released_at: string | null
  stripe_transfer_id: string | null
}

export default function WorkerPaymentsPage() {

  const t = useTranslations('WorkerPayments')
  const locale = useLocale()
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [profile, setProfile] = useState<WorkerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectingStripe, setConnectingStripe] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadPayments() {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select(
          'id, stripe_account_id, stripe_onboarding_complete'
        )
        .eq('id', user.id)
        .single<WorkerProfile>()

      if (!profile) {
        setLoading(false)
        return
      }

      setProfile(profile)

      const { data, error } = await supabase
        .from('jobs')
        .select(
          `
          id,
          title,
          pay_rate,
          worker_payout_cents,
          platform_fee_cents,
          payout_released_at,
          stripe_transfer_id
          `
        )
        .eq('assigned_worker_id', profile.id)
        .eq('payout_status', 'released')
        .order('payout_released_at', {
          ascending: false,
        })

      if (error) {
        console.error('Worker payments error:', error.message)
        setPayments([])
        setLoading(false)
        return
      }

      setPayments((data || []) as PaymentRow[])
      setLoading(false)
    }

    loadPayments()
  }, [])

  const total = payments.reduce(
    (sum, payment) =>
      sum + (payment.worker_payout_cents || 0),
    0
  )

  const stripeConnected = Boolean(
    profile?.stripe_account_id &&
      profile?.stripe_onboarding_complete
  )

  async function connectStripe() {
    setConnectingStripe(true)
    setMessage(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setMessage(
          t('sessionExpired')
        )
        return
      }

      const response = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const data = await response.json()

      if (!response.ok || !data.url) {
        setMessage(
          data.error || t('stripeConnectFailed')
        )
        return
      }

      window.location.href = data.url
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t('stripeConnectFailed')
      )
    } finally {
      setConnectingStripe(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">

        <h1 className="text-4xl font-black">
          {t('title')}
        </h1>

        <p className="mt-2 text-slate-300">
          {t('description')}
        </p>

        <div className="mt-8 rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                {t('payoutAccount')}
              </p>

              <h2 className="mt-2 text-2xl font-black text-white">
                {stripeConnected
                  ? t('stripeConnected')
                  : t('setUpWorkerPayouts')}
              </h2>

              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                {stripeConnected
                  ? t('stripeReadyDescription')
                  : t('stripeSetupDescription')}
              </p>

              {message ? (
                <p className="mt-3 text-sm font-bold text-orange-300">
                  {message}
                </p>
              ) : null}
            </div>

            {stripeConnected ? (
              <div className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-6 py-3 text-sm font-black text-emerald-200">
                ✓ {t('readyForPayouts')}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void connectStripe()}
                disabled={connectingStripe}
                className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {connectingStripe
                  ? t('openingStripe')
                  : t('setUpPayouts')}
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm text-slate-400">
            {t('totalPaid')}
          </p>

          <p className="mt-2 text-5xl font-black">
            ${(total / 100).toFixed(2)}
          </p>
        </div>


        <div className="mt-8 space-y-5">

          {loading ? (
            <div className="rounded-2xl bg-white/10 p-6">
              {t('loadingPayments')}
            </div>
          ) : payments.length === 0 ? (
            <div className="rounded-2xl bg-white/10 p-6">
              {t('noPayouts')}
            </div>
          ) : (
            payments.map((payment) => (
              <div
                key={payment.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
              >

                <h2 className="text-2xl font-black">
                  {payment.title || t('crewCallJob')}
                </h2>

                <div className="mt-4 grid gap-4 md:grid-cols-3">

                  <div>
                    <p className="text-sm text-slate-400">
                      {t('paid')}
                    </p>
                    <p className="font-bold">
                      {formatMoney(
                        (payment.worker_payout_cents || 0) / 100
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400">
                      {t('platformFee')}
                    </p>
                    <p className="font-bold">
                      {formatMoney(
                        (payment.platform_fee_cents || 0) / 100
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400">
                      {t('date')}
                    </p>
                    <p className="font-bold">
                      {payment.payout_released_at
                        ? new Date(
                            payment.payout_released_at
                          ).toLocaleDateString(locale)
                        : '-'}
                    </p>
                  </div>

                </div>

                {payment.stripe_transfer_id && (
                  <p className="mt-5 break-all text-xs text-slate-400">
                    {t('transfer')}: {payment.stripe_transfer_id}
                  </p>
                )}

              </div>
            ))
          )}

        </div>

      </div>
    </main>
  )
}
