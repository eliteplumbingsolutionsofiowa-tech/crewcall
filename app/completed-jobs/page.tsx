'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: 'worker' | 'company' | null
}

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
  completed_at: string | null
  paid_at: string | null
  company_id: string | null
  assigned_worker_id: string | null
  company?: {
    full_name: string | null
    company_name: string | null
  } | null
  worker?: {
    full_name: string | null
    company_name: string | null
  } | null
}

type Filter = 'all' | 'paid' | 'unpaid' | 'completed'

function parsePay(value: string | null) {
  if (!value) return 0
  return Number(value.replace(/[^0-9.]/g, '')) || 0
}

function money(value: number) {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function formatDate(value: string | null) {
  if (!value) return 'No date listed'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'No date listed'
  }

  return date.toLocaleDateString()
}

function badgeClasses(value: string) {
  const lower = value.toLowerCase()

  if (lower.includes('paid') || lower.includes('completed')) {
    return 'border-emerald-300/20 bg-emerald-400/15 text-emerald-100'
  }

  if (lower.includes('pending') || lower.includes('unpaid')) {
    return 'border-orange-300/20 bg-orange-400/15 text-orange-100'
  }

  return 'border-cyan-300/20 bg-cyan-400/15 text-cyan-100'
}

export default function CompletedJobsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const loadCompletedJobs = useCallback(async () => {
    setRefreshing(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to view completed jobs.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profileData) {
      setMessage(profileError?.message || 'Profile not found.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    const currentProfile = profileData as Profile
    setProfile(currentProfile)

    let query = supabase
      .from('jobs')
      .select(
        `
        id,
        title,
        trade,
        location,
        pay_rate,
        start_date,
        status,
        payment_status,
        payout_status,
        completed_at,
        paid_at,
        company_id,
        assigned_worker_id,
        company:profiles!jobs_company_id_fkey (
          full_name,
          company_name
        ),
        worker:profiles!jobs_assigned_worker_id_fkey (
          full_name,
          company_name
        )
      `
      )
      .eq('status', 'completed')
      .order('completed_at', {
        ascending: false,
      })

    if (currentProfile.role === 'company') {
      query = query.eq('company_id', user.id)
    } else {
      query = query.eq('assigned_worker_id', user.id)
    }

    const { data, error } = await query

    if (error) {
      setMessage(error.message)
      setJobs([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const cleaned = ((data || []) as any[]).map((job) => ({
      ...job,
      company: Array.isArray(job.company) ? job.company[0] : job.company,
      worker: Array.isArray(job.worker) ? job.worker[0] : job.worker,
    }))

    setJobs(cleaned as Job[])

    setLoading(false)
    setRefreshing(false)

    window.dispatchEvent(new Event('crewcall-refresh-nav'))
  }, [])

  useEffect(() => {
    let mounted = true

    async function boot() {
      if (!mounted) return
      await loadCompletedJobs()
    }

    boot()

    const refresh = async () => {
      if (!mounted) return

      await loadCompletedJobs()

      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    }

    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    const jobsChannel = supabase
      .channel('completed-jobs-live-sync')
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
      document.removeEventListener('visibilitychange', handleVisibility)

      supabase.removeChannel(jobsChannel)
    }
  }, [loadCompletedJobs])

  const stats = useMemo(() => {
    const paid = jobs.filter((job) => job.payment_status === 'paid')
    const unpaid = jobs.filter((job) => job.payment_status !== 'paid')

    return {
      completed: jobs.length,
      paid: paid.length,
      unpaid: unpaid.length,
      total: jobs.reduce((sum, job) => sum + parsePay(job.pay_rate), 0),
    }
  }, [jobs])

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase()

    return jobs.filter((job) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'paid' && job.payment_status === 'paid') ||
        (filter === 'unpaid' && job.payment_status !== 'paid') ||
        (filter === 'completed' && job.status === 'completed')

      const otherName =
        profile?.role === 'company'
          ? job.worker?.full_name || job.worker?.company_name
          : job.company?.company_name || job.company?.full_name

      const haystack = [
        job.title,
        job.trade,
        job.location,
        job.pay_rate,
        job.payment_status,
        job.payout_status,
        otherName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !term || haystack.includes(term)

      return matchesFilter && matchesSearch
    })
  }, [jobs, filter, search, profile])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black">Loading completed jobs...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-orange-300">
                CrewCall
              </p>

              <h1 className="mt-3 text-5xl font-black text-white">
                Completed Jobs
              </h1>

              <p className="mt-3 max-w-2xl text-slate-300">
                Review completed work, payment history, payout status, and
                completed project records.
              </p>
            </div>

            <button
              type="button"
              onClick={loadCompletedJobs}
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Completed" value={String(stats.completed)} />
            <StatCard label="Paid" value={String(stats.paid)} />
            <StatCard label="Unpaid" value={String(stats.unpaid)} />
            <StatCard label="Total Value" value={money(stats.total)} />
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                Search
              </label>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search company, worker, trade, location..."
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                Filter
              </label>

              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as Filter)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none"
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        )}

        {filteredJobs.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
            <h2 className="text-2xl font-black text-white">
              No completed jobs found
            </h2>

            <p className="mt-2 text-slate-300">Completed jobs will appear here.</p>

            <Link
              href={profile?.role === 'company' ? '/my-jobs' : '/jobs'}
              className="mt-6 inline-flex rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
            >
              {profile?.role === 'company' ? 'View My Jobs' : 'Browse Jobs'}
            </Link>
          </div>
        ) : (
          <section className="grid gap-5">
            {filteredJobs.map((job) => {
              const otherName =
                profile?.role === 'company'
                  ? job.worker?.full_name || job.worker?.company_name || 'Worker'
                  : job.company?.company_name || job.company?.full_name || 'Company'

              const reviewTargetId =
                profile?.role === 'company'
                  ? job.assigned_worker_id
                  : job.company_id

              const canLeaveReview = Boolean(reviewTargetId)

              return (
                <div
                  key={job.id}
                  className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur transition hover:border-cyan-300/20"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2">
                        <Badge value={job.status || 'completed'} />
                        <Badge value={job.payment_status || 'unpaid'} />
                        <Badge value={job.payout_status || 'not released'} />
                      </div>

                      <h2 className="mt-4 text-3xl font-black text-white">
                        {job.title || 'Untitled Job'}
                      </h2>

                      <p className="mt-2 text-sm font-semibold text-slate-300">
                        {profile?.role === 'company' ? 'Worker' : 'Company'}:{' '}
                        <span className="font-black text-white">{otherName}</span>
                      </p>

                      <p className="mt-2 text-sm font-semibold text-slate-400">
                        {[job.trade, job.location].filter(Boolean).join(' • ') ||
                          'No trade/location listed'}
                      </p>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Info label="Pay" value={job.pay_rate || 'Not listed'} />
                        <Info label="Start" value={formatDate(job.start_date)} />
                        <Info
                          label="Completed"
                          value={formatDate(job.completed_at)}
                        />
                        <Info label="Paid" value={formatDate(job.paid_at)} />
                      </div>

                      {job.payment_status !== 'paid' && (
                        <div className="mt-5 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4 text-sm font-bold text-orange-100">
                          Payment has not been marked paid yet.
                        </div>
                      )}

                      {job.payment_status === 'paid' && (
                        <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">
                          Payment completed.
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 lg:w-[230px] lg:flex-col">
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
                        Open Messages
                      </Link>

                      {profile?.role === 'company' && (
                        <Link
                          href={`/my-jobs/${job.id}/applicants`}
                          className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-black text-white hover:bg-white/15"
                        >
                          View Applicants
                        </Link>
                      )}

                      {canLeaveReview && (
                        <Link
                          href={`/jobs/${job.id}/review?to=${reviewTargetId}`}
                          className="rounded-2xl bg-orange-500 px-5 py-3 text-center text-sm font-black text-slate-950 hover:bg-orange-400"
                        >
                          Leave Review
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  )
}

function Badge({ value }: { value: string }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${badgeClasses(
        value
      )}`}
    >
      {value.replaceAll('_', ' ')}
    </span>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  )
}