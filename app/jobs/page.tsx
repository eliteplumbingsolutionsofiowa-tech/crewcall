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
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-gray-600">Loading open jobs...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
                Browse Work
              </p>

              <h1 className="mt-2 text-4xl font-bold text-gray-900">
                Open CrewCall Jobs
              </h1>

              <p className="mt-2 text-gray-600">
                Find open trade work posted by local companies.
              </p>
            </div>

            <Link
              href="/profile"
              className="w-fit rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Complete Profile
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by job, trade, or location..."
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />

            <select
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value)}
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
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
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {message}
          </div>
        )}

        {filteredJobs.length === 0 && (
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-yellow-900">
              No open jobs yet
            </h2>

            <p className="mt-2 text-yellow-800">
              There are no available jobs posted right now. Check back soon.
            </p>
          </div>
        )}

        <div className="grid gap-4">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-gray-900">
                        {job.title || 'Untitled Job'}
                      </h2>

                      <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                        Open
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-gray-600">
                      {job.trade || 'Trade not set'} ·{' '}
                      {job.location || 'Location not set'}
                    </p>
                  </div>

                  {job.description && (
                    <p className="max-w-3xl text-sm text-gray-700">
                      {job.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                    <span>
                      Pay:{' '}
                      <strong className="text-gray-900">
                        {job.pay_rate || 'Not set'}
                      </strong>
                    </span>

                    <span>
                      Start:{' '}
                      <strong className="text-gray-900">
                        {formatDate(job.start_date)}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    View Details
                  </Link>

                  <Link
                    href={`/jobs/${job.id}/apply`}
                    className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                  >
                    Apply
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