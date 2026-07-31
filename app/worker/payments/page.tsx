'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type PaymentRow = {
  id: string
  title: string | null
  pay_rate: number | null
  worker_payout_cents: number | null
  platform_fee_cents: number | null
  payout_released_at: string | null
  stripe_transfer_id: string | null
}

export default function WorkerPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)

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
        .select('id')
        .eq('id', user.id)
        .single()

      if (!profile) {
        setLoading(false)
        return
      }

      const { data } = await supabase
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

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">

        <h1 className="text-4xl font-black">
          Worker Payments
        </h1>

        <p className="mt-2 text-slate-300">
          Track your CrewCall earnings and payouts.
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm text-slate-400">
            Total Paid
          </p>

          <p className="mt-2 text-5xl font-black">
            ${(total / 100).toFixed(2)}
          </p>
        </div>


        <div className="mt-8 space-y-5">

          {loading ? (
            <div className="rounded-2xl bg-white/10 p-6">
              Loading payments...
            </div>
          ) : payments.length === 0 ? (
            <div className="rounded-2xl bg-white/10 p-6">
              No payouts yet.
            </div>
          ) : (
            payments.map((payment) => (
              <div
                key={payment.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
              >

                <h2 className="text-2xl font-black">
                  {payment.title || 'CrewCall Job'}
                </h2>

                <div className="mt-4 grid gap-4 md:grid-cols-3">

                  <div>
                    <p className="text-sm text-slate-400">
                      Paid
                    </p>
                    <p className="font-bold">
                      $
                      {(
                        (payment.worker_payout_cents || 0) /
                        100
                      ).toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400">
                      Platform Fee
                    </p>
                    <p className="font-bold">
                      $
                      {(
                        (payment.platform_fee_cents || 0) /
                        100
                      ).toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400">
                      Date
                    </p>
                    <p className="font-bold">
                      {payment.payout_released_at
                        ? new Date(
                            payment.payout_released_at
                          ).toLocaleDateString()
                        : '-'}
                    </p>
                  </div>

                </div>

                {payment.stripe_transfer_id && (
                  <p className="mt-5 break-all text-xs text-slate-400">
                    Transfer: {payment.stripe_transfer_id}
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
