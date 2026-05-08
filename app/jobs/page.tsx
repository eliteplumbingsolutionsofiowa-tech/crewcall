'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  description: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  start_date: string | null
  status: string | null
  payment_status: string | null
  company_id: string | null
  assigned_worker_id: string | null
  created_at: string
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('all')

  useEffect(() => {
    loadJobs()
  }, [])

  const trades = useMemo(() => {
    const unique = new Set(
      jobs
        .map((job) => job.trade)
        .filter((trade): trade is string => Boolean(trade))
    )

    return Array.from(unique).sort()
  }, [jobs])

  const filteredJobs = useMemo(() => {
    const term = search.toLowerCase().trim()

    return jobs.filter((job) => {
      const matchesSearch =
        !term ||
        job.title?.toLowerCase().includes(term) ||
        job.description?.toLowerCase().includes(term) ||
        job.trade?.toLowerCase().includes(term) ||
        job.location?.toLowerCase().includes(term)

      const matchesTrade =
        tradeFilter === 'all' || job.trade === tradeFilter

      return matchesSearch && matchesTrade
    })
  }, [jobs, search, tradeFilter])

  async function loadJobs() {
    setLoading(true)
    setMessage(null)

    const { data, error } = await supabase
      .from('jobs')
      .select(
        'id, title, description, trade, location, pay_rate, start_date, status, payment_status, company_id, assigned_worker_id, created_at'
      )
      .eq('status', 'open')
      .is('assigned_worker_id', null)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setJobs([])
      setLoading(false)
      return
    }

    setJobs((data || []) as Job[])
    setLoading(false)
  }

  function formatDate(date: string | null) {
    if (!date) return 'Start date not set'

    return new Date(date).toLocaleDateString()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-100 p-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-lg font-semibold text-slate-600">
            Loading open jobs...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-orange-100 p-4 md:p-6">
      <div className="absolute left-[-120px] top-10 h-80 w-80 rounded-full bg-blue-300/30 blur-3xl" />
      <div className="absolute right-[-100px] top-32 h-80 w-80 rounded-full bg-orange-300/30 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-2xl shadow-slate-900/5 backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-600">
                Browse Work
              </p>

              <h1 className="mt-3 text-5xl font-black tracking-tight text-slate-950">
                Open CrewCall Jobs
              </h1>

              <p className="mt-3 max-w-2xl text-lg text-slate-600">
                Find open trade work posted by local companies.
              </p>
            </div>

            <Link
              href="/profile"
              className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-sm font-black text-white shadow-xl shadow-blue-500/20 transition hover:scale-[1.02]"
            >
              Complete Profile
            </Link>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-xl backdrop-blur">
          <div className="grid gap-4 md:grid-cols-[1fr_240px_auto]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs, trades, or locations..."
              className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500"
            />

            <select
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500"
            >
              <option value="all">All trades</option>

              {trades.map((trade) => (
                <option key={trade} value={trade}>
                  {trade}
                </option>
              ))}
            </select>

            <button
              onClick={loadJobs}
              className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black text-slate-900 shadow-sm transition hover:scale-[1.02] hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </section>

        {message && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700 shadow-sm">
            {message}
          </div>
        )}

        {filteredJobs.length === 0 && (
          <div className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-10 shadow-xl">
            <h2 className="text-2xl font-black text-yellow-900">
              No open jobs yet
            </h2>

            <p className="mt-3 text-lg text-yellow-800">
              There are no available jobs posted right now. Check back soon.
            </p>
          </div>
        )}

        <div className="grid gap-6">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-2xl shadow-slate-900/5 backdrop-blur"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-3xl font-black tracking-tight text-slate-950">
                      {job.title || 'Untitled Job'}
                    </h2>

                    <span className="rounded-full bg-emerald-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-700">
                      Open
                    </span>
                  </div>

                  <p className="mt-3 text-lg text-slate-600">
                    {job.trade || 'Trade not set'} •{' '}
                    {job.location || 'Location not set'}
                  </p>

                  {job.description && (
                    <p className="mt-5 max-w-4xl text-base leading-relaxed text-slate-700">
                      {job.description}
                    </p>
                  )}

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                        Pay Rate
                      </p>

                      <p className="mt-2 text-2xl font-black text-slate-950">
                        {job.pay_rate || 'Not set'}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                        Start Date
                      </p>

                      <p className="mt-2 text-2xl font-black text-slate-950">
                        {formatDate(job.start_date)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 lg:w-[260px] lg:flex-col">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center text-sm font-black text-slate-900 shadow-sm transition hover:scale-[1.02] hover:bg-slate-50"
                  >
                    View Details
                  </Link>

                  <Link
                    href={`/jobs/${job.id}/apply`}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-4 text-center text-sm font-black text-white shadow-xl shadow-orange-500/20 transition hover:scale-[1.02]"
                  >
                    Apply Now
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}