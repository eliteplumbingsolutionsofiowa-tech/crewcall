'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type RevenueJob = {
  id: string
  title: string | null
  pay_rate: number | null
  worker_payout_cents: number | null
  platform_fee_cents: number | null
  payout_status: string | null
  payment_status: string | null
  payout_released_at: string | null
}

export default function AdminRevenuePage() {
  const [jobs, setJobs] = useState<RevenueJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadRevenue() {
      const { data } = await supabase
        .from('jobs')
        .select(
          `
          id,
          title,
          pay_rate,
          worker_payout_cents,
          platform_fee_cents,
          payout_status,
          payment_status,
          payout_released_at
          `
        )
        .eq('payment_status', 'paid')
        .order('payout_released_at', {
          ascending: false,
        })

      setJobs((data || []) as RevenueJob[])
      setLoading(false)
    }

    loadRevenue()
  }, [])

  const volume = jobs.reduce(
    (sum, job) => sum + Number(job.pay_rate || 0),
    0
  )

  const revenue = jobs.reduce(
    (sum, job) =>
      sum + (job.platform_fee_cents || 0),
    0
  )

  const workerPaid = jobs.reduce(
    (sum, job) =>
      sum + (job.worker_payout_cents || 0),
    0
  )

  const paidJobs = jobs.length

  const releasedPayouts = jobs.filter(
    (job) => job.payout_status === 'released'
  ).length

  const pendingPayouts = jobs.filter(
    (job) => job.payout_status !== 'released'
  ).length

  const averageFee =
    jobs.length > 0
      ? revenue / jobs.length / 100
      : 0

  const averageJob =
    jobs.length > 0
      ? volume / jobs.length
      : 0

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">

      <div className="mx-auto max-w-6xl">

        <h1 className="text-4xl font-black">
          CrewCall Revenue Dashboard
        </h1>

        <p className="mt-2 text-slate-300">
          Marketplace performance and financial overview.
        </p>


        <div className="mt-8 grid gap-5 md:grid-cols-4">

          <Stat
            label="Marketplace Volume"
            value={`$${volume.toLocaleString()}`}
          />

          <Stat
            label="CrewCall Revenue"
            value={`$${(revenue / 100).toFixed(2)}`}
          />

          <Stat
            label="Worker Earnings"
            value={`$${(workerPaid / 100).toFixed(2)}`}
          />

          <Stat
            label="Average Job"
            value={`$${averageJob.toFixed(2)}`}
          />

        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-4">

          <Stat
            label="Paid Jobs"
            value={paidJobs.toString()}
          />

          <Stat
            label="Released Payouts"
            value={releasedPayouts.toString()}
          />

          <Stat
            label="Pending Payouts"
            value={pendingPayouts.toString()}
          />

          <Stat
            label="Average Platform Fee"
            value={`$${averageFee.toFixed(2)}`}
          />

        </div>


        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">

          <h2 className="text-2xl font-black">
            Recent Transactions
          </h2>


          {loading ? (
            <p className="mt-5">
              Loading...
            </p>
          ) : jobs.length === 0 ? (
            <p className="mt-5 text-slate-400">
              No transactions yet.
            </p>
          ) : (

            <div className="mt-5 space-y-4">

              {jobs.slice(0,10).map((job) => (

                <div
                  key={job.id}
                  className="rounded-2xl border border-white/10 bg-slate-900 p-5"
                >

                  <div className="flex justify-between gap-4">

                    <div>
                      <h3 className="font-black">
                        {job.title || 'CrewCall Job'}
                      </h3>

                      <p className="text-sm text-slate-400">
                        {job.payout_released_at
                          ? new Date(
                              job.payout_released_at
                            ).toLocaleDateString()
                          : 'Pending'}
                      </p>
                    </div>

                    <div className="text-right">

                      <p className="font-black text-green-400">
                        ${Number(job.pay_rate || 0).toLocaleString()}
                      </p>

                      <p className="text-xs text-slate-400">
                        Fee:
                        {' '}
                        ${(
                          (job.platform_fee_cents || 0) /
                          100
                        ).toFixed(2)}
                      </p>

                    </div>

                  </div>

                </div>

              ))}

            </div>

          )}

        </div>

      </div>

    </main>
  )
}


function Stat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-sm text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black">
        {value}
      </p>
    </div>
  )
}
