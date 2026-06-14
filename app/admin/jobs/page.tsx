'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type AdminProfile = {
  id: string
  is_admin: boolean | null
}

type CompanyProfile = {
  id: string
  full_name: string | null
  company_name: string | null
  city: string | null
  state: string | null
}

type WorkerProfile = {
  id: string
  full_name: string | null
  trade: string | null
  city: string | null
  state: string | null
}

type Job = {
  id: string
  company_id: string | null
  assigned_worker_id: string | null
  title: string | null
  description: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  start_date: string | null
  status: string | null
  payment_status: string | null
  payout_status: string | null
  is_featured: boolean | null
  featured_until: string | null
  created_at: string | null
  company: CompanyProfile | CompanyProfile[] | null
  worker: WorkerProfile | WorkerProfile[] | null
}

type CleanJob = Omit<Job, 'company' | 'worker'> & {
  company: CompanyProfile | null
  worker: WorkerProfile | null
}

type JobUpdate = {
  status?: string
  is_featured?: boolean
  featured_until?: string | null
}

type JobCounts = {
  total: number
  open: number
  assigned: number
  inProgress: number
  completed: number
  paid: number
  featured: number
}

type JobFilter = 'all' | 'open' | 'assigned' | 'in_progress' | 'completed' | 'featured'

const emptyCounts: JobCounts = {
  total: 0,
  open: 0,
  assigned: 0,
  inProgress: 0,
  completed: 0,
  paid: 0,
  featured: 0,
}

function firstOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value
}

export default function AdminJobsPage() {
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [jobs, setJobs] = useState<CleanJob[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<JobFilter>('all')

  const loadJobs = useCallback(async () => {
    setRefreshing(true)
    setMessage('')
    setSuccessMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to access admin jobs.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data: adminData, error: adminError } = await supabase
      .from('profiles')
      .select('id, is_admin')
      .eq('id', user.id)
      .maybeSingle<AdminProfile>()

    if (adminError) {
      setMessage(adminError.message)
      setLoading(false)
      setRefreshing(false)
      return
    }

    setAdminProfile(adminData || null)

    if (!adminData?.is_admin) {
      setMessage('You do not have admin access.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data, error } = await supabase
      .from('jobs')
      .select(
        `
        id,
        company_id,
        assigned_worker_id,
        title,
        description,
        trade,
        location,
        pay_rate,
        start_date,
        status,
        payment_status,
        payout_status,
        is_featured,
        featured_until,
        created_at,
        company:profiles!jobs_company_id_fkey (
          id,
          full_name,
          company_name,
          city,
          state
        ),
        worker:profiles!jobs_assigned_worker_id_fkey (
          id,
          full_name,
          trade,
          city,
          state
        )
      `
      )
      .order('created_at', { ascending: false })
      .returns<Job[]>()

    if (error) {
      setMessage(error.message)
      setJobs([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const cleaned: CleanJob[] = (data ?? []).map((job) => ({
      id: job.id,
      company_id: job.company_id,
      assigned_worker_id: job.assigned_worker_id,
      title: job.title,
      description: job.description,
      trade: job.trade,
      location: job.location,
      pay_rate: job.pay_rate,
      start_date: job.start_date,
      status: job.status,
      payment_status: job.payment_status,
      payout_status: job.payout_status,
      is_featured: job.is_featured,
      featured_until: job.featured_until,
      created_at: job.created_at,
      company: firstOrNull(job.company),
      worker: firstOrNull(job.worker),
    }))

    setJobs(cleaned)
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  const counts = useMemo<JobCounts>(() => {
    return {
      total: jobs.length,
      open: jobs.filter((job) => !job.status || job.status === 'open').length,
      assigned: jobs.filter((job) => job.status === 'assigned').length,
      inProgress: jobs.filter((job) => job.status === 'in_progress').length,
      completed: jobs.filter((job) => job.status === 'completed').length,
      paid: jobs.filter((job) => job.payment_status === 'paid').length,
      featured: jobs.filter((job) => job.is_featured).length,
    }
  }, [jobs])

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase()

    return jobs.filter((job) => {
      const companyName =
        job.company?.company_name || job.company?.full_name || ''
      const workerName = job.worker?.full_name || ''

      const searchable = [
        job.title,
        job.description,
        job.trade,
        job.location,
        job.pay_rate,
        job.status,
        job.payment_status,
        job.payout_status,
        companyName,
        workerName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !term || searchable.includes(term)

      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'featured'
            ? Boolean(job.is_featured)
            : filter === 'open'
              ? !job.status || job.status === 'open'
              : job.status === filter

      return matchesSearch && matchesFilter
    })
  }, [jobs, search, filter])

  async function updateJob(jobId: string, update: JobUpdate) {
    setWorkingId(jobId)
    setMessage('')
    setSuccessMessage('')

    const { error } = await supabase.from('jobs').update(update).eq('id', jobId)

    if (error) {
      setMessage(error.message)
      setWorkingId(null)
      return
    }

    setJobs((current) =>
      current.map((job) =>
        job.id === jobId
          ? {
              ...job,
              ...update,
            }
          : job
      )
    )

    setSuccessMessage('Job updated.')
    setWorkingId(null)
  }

  async function deleteJob(job: CleanJob) {
    const confirmed = window.confirm(
      `Delete "${job.title || 'Untitled Job'}"? This cannot be undone.`
    )

    if (!confirmed) return

    setWorkingId(job.id)
    setMessage('')
    setSuccessMessage('')

    const { error } = await supabase.from('jobs').delete().eq('id', job.id)

    if (error) {
      setMessage(error.message)
      setWorkingId(null)
      return
    }

    setJobs((current) => current.filter((item) => item.id !== job.id))
    setSuccessMessage('Job deleted.')
    setWorkingId(null)
  }
    async function toggleFeatured(job: CleanJob) {
    const nextFeatured = !job.is_featured

    const update: JobUpdate = {
      is_featured: nextFeatured,
      featured_until: nextFeatured
        ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()
        : null,
    }

    await updateJob(job.id, update)
  }

  function companyName(job: CleanJob) {
    return job.company?.company_name || job.company?.full_name || 'Company'
  }

  function workerName(job: CleanJob) {
    return job.worker?.full_name || 'Unassigned'
  }

  function cleanStatus(value: string | null) {
    return (value || 'open').replaceAll('_', ' ')
  }

  function formatDate(value: string | null) {
    if (!value) return 'Not listed'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return 'Not listed'

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl shadow-black/20 backdrop-blur">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            CrewCall Admin
          </p>
          <h1 className="mt-3 text-3xl font-black">Loading jobs...</h1>
        </div>
      </main>
    )
  }

  if (!adminProfile?.is_admin) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-400/20 bg-red-500/10 p-8 shadow-2xl shadow-black/20">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-red-300">
            Access denied
          </p>
          <h1 className="mt-3 text-3xl font-black text-white">
            Admin access required
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-red-100/80">
            {message || 'This page is only available to CrewCall admins.'}
          </p>
          <Link
            href="/admin"
            className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
          >
            Back to Admin
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <Link
                  href="/admin"
                  className="text-sm font-black text-cyan-300 hover:text-cyan-200"
                >
                  ← Back to Admin
                </Link>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  CrewCall Admin
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Jobs
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Review jobs, feature important listings, close spam, monitor
                  payments, and manage job status from one place.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadJobs()}
                disabled={refreshing}
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? 'Refreshing...' : 'Refresh Jobs'}
              </button>
            </div>
          </div>

          <div className="space-y-6 p-6 md:p-8">
            {message && (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100">
                {message}
              </div>
            )}

            {successMessage && (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-4 text-sm font-bold text-emerald-100">
                {successMessage}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
              <AdminJobStat label="Total" value={counts.total} />
              <AdminJobStat label="Open" value={counts.open} />
              <AdminJobStat label="Assigned" value={counts.assigned} />
              <AdminJobStat label="In Progress" value={counts.inProgress} />
              <AdminJobStat label="Completed" value={counts.completed} />
              <AdminJobStat label="Paid" value={counts.paid} />
              <AdminJobStat label="Featured" value={counts.featured} />
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search job title, company, worker, trade, location, pay..."
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                />

                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as JobFilter)}
                  className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none focus:border-cyan-300/50"
                >
                  <option value="all">All Jobs</option>
                  <option value="open">Open</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="featured">Featured</option>
                </select>
              </div>
            </div>

            {filteredJobs.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-8 text-center">
                <p className="text-xl font-black text-white">No jobs found.</p>
                <p className="mt-2 text-sm font-semibold text-slate-400">
                  Try adjusting the search or status filter.
                </p>
              </div>
            ) : (
              <div className="grid gap-5">
                {filteredJobs.map((job) => {
                  const working = workingId === job.id

                  return (
                    <article
                      key={job.id}
                      className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-xl shadow-black/10 transition hover:border-cyan-300/30"
                    >
                      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-2xl font-black text-white">
                              {job.title || 'Untitled Job'}
                            </h2>

                            <Badge label={cleanStatus(job.status)} />

                            {job.is_featured && (
                              <Badge label="Featured" tone="cyan" />
                            )}

                            {job.payment_status === 'paid' && (
                              <Badge label="Paid" tone="emerald" />
                            )}
                          </div>

                          <p className="mt-3 text-sm font-semibold text-slate-300">
                            {job.trade || 'Trade not listed'} •{' '}
                            {job.location || 'Location not listed'} •{' '}
                            {job.pay_rate || 'Pay not listed'}
                          </p>

                          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
                            {job.description || 'No description listed.'}
                          </p>

                          <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-300 md:grid-cols-2 xl:grid-cols-4">
                            <p>
                              <span className="text-cyan-300">Company:</span>{' '}
                              {companyName(job)}
                            </p>

                            <p>
                              <span className="text-cyan-300">Worker:</span>{' '}
                              {workerName(job)}
                            </p>

                            <p>
                              <span className="text-cyan-300">Start:</span>{' '}
                              {formatDate(job.start_date)}
                            </p>

                            <p>
                              <span className="text-cyan-300">Posted:</span>{' '}
                              {formatDate(job.created_at)}
                            </p>

                            <p>
                              <span className="text-cyan-300">Payment:</span>{' '}
                              {job.payment_status || 'unpaid'}
                            </p>

                            <p>
                              <span className="text-cyan-300">Payout:</span>{' '}
                              {job.payout_status || 'not released'}
                            </p>

                            <p className="md:col-span-2">
                              <span className="text-cyan-300">
                                Featured Until:
                              </span>{' '}
                              {formatDate(job.featured_until)}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:w-72 xl:grid-cols-1">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-white/15"
                          >
                            View Job
                          </Link>

                          <Link
                            href={`/my-jobs/${job.id}/applicants`}
                            className="rounded-2xl bg-blue-500 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-blue-400"
                          >
                            Applicants
                          </Link>

                          <Link
                            href={`/profile?user=${job.company_id || ''}`}
                            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-white/15"
                          >
                            Company
                          </Link>

                          <button
                            type="button"
                            onClick={() => void toggleFeatured(job)}
                            disabled={working}
                            className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {job.is_featured ? 'Unfeature' : 'Feature'}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void updateJob(job.id, { status: 'open' })
                            }
                            disabled={working}
                            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Mark Open
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void updateJob(job.id, { status: 'completed' })
                            }
                            disabled={working}
                            className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Complete
                          </button>

                          <button
                            type="button"
                            onClick={() => void deleteJob(job)}
                            disabled={working}
                            className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function AdminJobStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-4xl font-black text-white">{value}</p>
    </div>
  )
}

function Badge({
  label,
  tone = 'slate',
}: {
  label: string
  tone?: 'slate' | 'cyan' | 'emerald'
}) {
  const classes =
    tone === 'cyan'
      ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
      : tone === 'emerald'
        ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
        : 'border-white/10 bg-white/10 text-slate-200'

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${classes}`}
    >
      {label}
    </span>
  )
}
