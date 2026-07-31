'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type PaymentRow = {
  id: string
  title: string | null
  company_id: string | null
  worker_payout_cents: number | null
  payout_status: string | null
  payout_released_at: string | null
  completed_at: string | null
  stripe_transfer_id: string | null
}

export default function WorkerPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPayments()
  }, [])

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

    const {
      data,
      error,
    } = await supabase
      .from('jobs')
      .select(
        `
        id,
        title,
        company_id,
        worker_payout_cents,
        payout_status,
        payout_released_at,
        completed_at,
        stripe_transfer_id
        `
      )
      .eq('assigned_worker_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', {
        ascending: false,
      })

    if (!error) {
      setPayments(data || [])
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-8">
        Loading payments...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">

      <div className="mx-auto max-w-5xl">

        <h1 className="text-4xl font-black mb-8">
          Payment History
        </h1>

        {payments.length === 0 ? (
          <div className="rounded-2xl bg-white/10 p-8">
            No completed payments yet.
          </div>
        ) : (

          <div className="space-y-5">

            {payments.map((payment) => (

              <div
                key={payment.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
              >

                <div className="flex justify-between gap-5">

                  <div>
                    <h2 className="text-xl font-bold">
                      {payment.title || 'CrewCall Job'}
                    </h2>

                    <p className="text-slate-400 mt-2">
                      Completed:
                      {' '}
                      {payment.completed_at
                        ? new Date(
                            payment.completed_at
                          ).toLocaleDateString()
                        : 'Pending'}
                    </p>
                  </div>

                  <div className="text-right">

                    <div className="text-3xl font-black text-green-400">
                      $
                      {(
                        (payment.worker_payout_cents || 0) /
                        100
                      ).toFixed(2)}
                    </div>

                    <div className="text-sm mt-2">
                      {payment.payout_status === 'released'
                        ? 'Released ✅'
                        : 'Processing'}
                    </div>

                  </div>

                </div>


                {payment.payout_released_at && (
                  <p className="mt-5 text-sm text-slate-400">
                    Paid:
                    {' '}
                    {new Date(
                      payment.payout_released_at
                    ).toLocaleString()}
                  </p>
                )}

                {payment.stripe_transfer_id && (
                  <p className="mt-2 text-xs text-slate-500">
                    Stripe Transfer:
                    {' '}
                    {payment.stripe_transfer_id}
                  </p>
                )}

              </div>

            ))}

          </div>

        )}

      </div>

    </main>
  )
}
