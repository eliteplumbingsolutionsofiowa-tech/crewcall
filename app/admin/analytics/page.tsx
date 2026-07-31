'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  trade: string | null
  status: string | null
  payment_status: string | null
  pay_rate: string | number | null
  created_at: string | null
}

type Profile = {
  id: string
  role: string | null
  created_at: string | null
}

export default function AdminAnalyticsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [jobsResult, profilesResult] = await Promise.all([
        supabase
          .from('jobs')
          .select(
            'id,trade,status,payment_status,pay_rate,created_at'
          ),

        supabase
          .from('profiles')
          .select(
            'id,role,created_at'
          ),
      ])

      setJobs((jobsResult.data || []) as Job[])
      setProfiles((profilesResult.data || []) as Profile[])
      setLoading(false)
    }

    load()
  }, [])

  const stats = useMemo(() => {
    const volume = jobs.reduce(
      (sum, job) => {
        const cleaned = String(job.pay_rate || '')
          .replace(/[^0-9.]/g, '')

        return sum + (Number(cleaned) || 0)
      },
      0
    )

    const completed = jobs.filter(
      (job) => job.status === 'completed'
    ).length

    const paid = jobs.filter(
      (job) => job.payment_status === 'paid'
    ).length

    const trades = jobs.reduce<Record<string, number>>(
      (acc, job) => {
        const trade = job.trade || 'Other'
        acc[trade] = (acc[trade] || 0) + 1
        return acc
      },
      {}
    )

    return {
      volume,
      completed,
      paid,
      trades,
      workers: profiles.filter(
        (p) => p.role === 'worker'
      ).length,
      companies: profiles.filter(
        (p) => p.role === 'company'
      ).length,
    }
  }, [jobs, profiles])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        Loading analytics...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl">

        <h1 className="text-4xl font-black">
          CrewCall Analytics Center
        </h1>

        <p className="mt-2 text-slate-400">
          Marketplace growth, jobs, users, and revenue intelligence.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-4">

          <Card
            label="Marketplace Volume"
            value={`$${stats.volume.toLocaleString()}`}
          />

          <Card
            label="Completed Jobs"
            value={stats.completed}
          />

          <Card
            label="Paid Jobs"
            value={stats.paid}
          />

          <Card
            label="Workers"
            value={stats.workers}
          />

        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-black">
              User Growth
            </h2>

            <p className="mt-4 text-slate-300">
              Workers: {stats.workers}
            </p>

            <p className="text-slate-300">
              Companies: {stats.companies}
            </p>
          </section>


          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-black">
              Top Trades
            </h2>

            <div className="mt-4 space-y-2">
              {Object.entries(stats.trades).map(
                ([trade, count]) => (
                  <div
                    key={trade}
                    className="flex justify-between rounded-xl bg-black/20 px-4 py-3"
                  >
                    <span>{trade}</span>
                    <span>{count}</span>
                  </div>
                )
              )}
            </div>
          </section>

        </div>

      </div>
    </main>
  )
}


function Card({
  label,
  value,
}: {
  label:string
  value:string|number
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
