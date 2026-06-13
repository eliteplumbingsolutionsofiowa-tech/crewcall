'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  start_date: string | null
  status: string | null
  payment_status: string | null
  payout_status: string | null
  paid_at: string | null
  company_id: string | null
  company?: {
    full_name: string | null
    company_name: string | null
  } | null
}

type Stats = {
  active: number
  inProgress: number
  completed: number
  paid: number
}

type Filter =
  | 'all'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'paid'

function formatDate(value: string | null) {
  if (!value) return 'No date set'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'No date set'

  return date.toLocaleDateString()
}

function cleanStatus(value: string | null) {
  return (value || 'unknown').replaceAll('_', ' ')
}

function statusTone(value: string | null) {
  const status = value || 'unknown'

  if (status === 'paid' || status === 'completed') {
    return 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
  }

  if (status === 'in_progress') {
    return 'border-orange-300/30 bg-orange-400/10 text-orange-100'
  }

  if (status === 'assigned') {
    return 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100'
  }

  if (status === 'cancelled' || status === 'rejected') {
    return 'border-red-300/30 bg-red-400/10 text-red-100'
  }

  return 'border-white/10 bg-white/10 text-slate-200'
}

function paymentTone(value: string | null) {
  const status = value || 'unpaid'

  if (status.includes('paid')) {
    return 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
  }

  if (status.includes('pending')) {
    return 'border-orange-300/30 bg-orange-400/10 text-orange-100'
  }

  return 'border-white/10 bg-white/10 text-slate-200'
}

export default function MyWorkPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const loadMyWork = useCallback(async () => {
    setRefreshing(true)
    setError('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError('You must be logged in to view your work.')
      setJobs([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data, error } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        trade,
        location,
        pay_rate,
        start_date,
        status,
        payment_status,
        payout_status,
        paid_at,
        company_id,
        company:profiles!jobs_company_id_fkey (
          full_name,
          company_name
        )
      `)
      .eq('assigned_worker_id', user.id)
      .order('start_date', { ascending: false })

    if (error) {
      setError(error.message)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const cleaned = ((data || []) as any[]).map((job) => ({
      ...job,
      company: Array.isArray(job.company)
        ? job.company[0]
        : job.company,
    }))

    setJobs(cleaned)

    setLoading(false)
    setRefreshing(false)

    window.dispatchEvent(new Event('crewcall-refresh-nav'))
  }, [])

  useEffect(() => {
    let mounted = true

    async function boot() {
      if (!mounted) return
      await loadMyWork()
    }

    boot()

    const refresh = async () => {
      if (!mounted) return

      await loadMyWork()

      window.dispatchEvent(
        new Event('crewcall-refresh-nav')
      )
    }

    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibility
    )

    const jobsChannel = supabase
      .channel('worker-my-work-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
        },
        refresh
      )
      .subscribe()

    return () => {
      mounted = false

      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)

      document.removeEventListener(
        'visibilitychange',
        handleVisibility
      )

      supabase.removeChannel(jobsChannel)
    }
  }, [loadMyWork])

  const stats = useMemo<Stats>(() => {
    return {
      active: jobs.filter((job) =>
        ['assigned', 'in_progress'].includes(job.status || '')
      ).length,

      inProgress: jobs.filter(
        (job) => job.status === 'in_progress'
      ).length,

      completed: jobs.filter(
        (job) => job.status === 'completed'
      ).length,

      paid: jobs.filter(
        (job) => job.payment_status === 'paid'
      ).length,
    }
  }, [jobs])

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase()

    return jobs.filter((job) => {
      const matchesFilter =
        filter === 'all' ||
        job.status === filter ||
        (filter === 'paid' &&
          job.payment_status === 'paid')

      const haystack = [
        job.title,
        job.trade,
        job.location,
        job.pay_rate,
        job.status,
        job.payment_status,
        job.payout_status,
        job.company?.company_name,
        job.company?.full_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch =
        !term || haystack.includes(term)

      return matchesFilter && matchesSearch
    })
  }, [jobs, filter, search])

  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      const order = [
        'in_progress',
        'assigned',
        'completed',
        'paid',
      ]

      const aIndex =
        order.indexOf(a.status || '') === -1
          ? 999
          : order.indexOf(a.status || '')

      const bIndex =
        order.indexOf(b.status || '') === -1
          ? 999
          : order.indexOf(b.status || '')

      if (aIndex !== bIndex) return aIndex - bIndex

      return (
        new Date(b.start_date || '').getTime() -
        new Date(a.start_date || '').getTime()
      )
    })
  }, [filteredJobs])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black">
            Loading your work...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/20 backdrop-blur md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                Worker
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
                My Work
              </h1>

              <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-300">
                Track assigned jobs, work status,
                completed jobs, payout status, and
                payment.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/jobs"
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
              >
                Browse Jobs
              </Link>

              <Link
                href="/completed-jobs"
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
              >
                Completed Jobs
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Active"
              value={stats.active}
            />

            <StatCard
              label="In Progress"
              value={stats.inProgress}
            />

            <StatCard
              label="Completed"
              value={stats.completed}
            />

            <StatCard
              label="Paid"
              value={stats.paid}
            />
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm font-bold text-red-100">
            {error}
          </div>
        )}

        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                Search
              </label>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search jobs, company, trade, location..."
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                Status
              </label>

              <select
                value={filter}
                onChange={(event) =>
                  setFilter(
                    event.target.value as Filter
                  )
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none"
              >
                <option value="all">All</option>
                <option value="assigned">
                  Assigned
                </option>
                <option value="in_progress">
                  In Progress
                </option>
                <option value="completed">
                  Completed
                </option>
                <option value="paid">Paid</option>
              </select>
            </div>

            <button
              type="button"
              onClick={loadMyWork}
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/20"
            >
              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </div>
        </section>

        {sortedJobs.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
            <h2 className="text-2xl font-black text-white">
              No assigned work yet
            </h2>

            <p className="mt-2 text-slate-300">
              Once a company hires you for a job,
              it will show up here.
            </p>

            <Link
              href="/jobs"
              className="mt-6 inline-flex rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
            >
              Find Work
            </Link>
          </div>
        ) : (
          <div className="grid gap-5">
            {sortedJobs.map((job) => {
              const companyName =
                job.company?.company_name ||
                job.company?.full_name ||
                'Company'

              return (
                <article
                  key={job.id}
                  className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/20 backdrop-blur transition hover:border-cyan-300/30"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          value={
                            job.status || 'assigned'
                          }
                        />

                        <Badge
                          value={`payment: ${
                            job.payment_status ||
                            'unpaid'
                          }`}
                          payment
                        />

                        <Badge
                          value={`payout: ${
                            job.payout_status ||
                            'not released'
                          }`}
                          payment
                        />
                      </div>

                      <h2 className="mt-4 text-2xl font-black text-white">
                        {job.title || 'Untitled Job'}
                      </h2>

                      <p className="mt-2 text-sm font-semibold text-slate-300">
                        Company: {companyName}
                      </p>

                      <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
                        <Info
                          label="Trade"
                          value={
                            job.trade ||
                            'Not listed'
                          }
                        />

                        <Info
                          label="Location"
                          value={
                            job.location ||
                            'Not listed'
                          }
                        />

                        <Info
                          label="Pay"
                          value={
                            job.pay_rate ||
                            'Not listed'
                          }
                        />

                        <Info
                          label="Start"
                          value={formatDate(
                            job.start_date
                          )}
                        />
                      </div>

                      {job.status ===
                        'completed' &&
                        job.payment_status !==
                          'paid' && (
                          <div className="mt-5 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4 text-sm font-bold text-orange-100">
                            Work is complete.
                            Waiting for company
                            payment.
                          </div>
                        )}

                      {job.payment_status ===
                        'paid' && (
                        <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">
                          Paid
                          {job.paid_at
                            ? ` on ${new Date(
                                job.paid_at
                              ).toLocaleDateString()}`
                            : ''}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 lg:w-[220px] lg:flex-col">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-black text-white hover:bg-white/15"
                      >
                        View Job
                      </Link>

                      <Link
                        href={`/messages?jobId=${job.id}`}
                        className="rounded-2xl bg-blue-500 px-5 py-3 text-center text-sm font-black text-white hover:bg-blue-400"
                      >
                        Message Company
                      </Link>

                      {job.status ===
                        'completed' &&
                        job.company_id && (
                          <Link
                            href={`/jobs/${job.id}/review?to=${job.company_id}`}
                            className="rounded-2xl bg-orange-500 px-5 py-3 text-center text-sm font-black text-white hover:bg-orange-400"
                          >
                            Leave Review
                          </Link>
                        )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black text-white">
        {value}
      </p>
    </div>
  )
}

function Badge({
  value,
  payment = false,
}: {
  value: string
  payment?: boolean
}) {
  const lower = value.toLowerCase()

  const classes = payment
    ? paymentTone(lower)
    : statusTone(lower)

  return (
    <span
      className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide ${classes}`}
    >
      {cleanStatus(value)}
    </span>
  )
}

function Info({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-bold text-white">
        {value}
      </p>
    </div>
  )
}