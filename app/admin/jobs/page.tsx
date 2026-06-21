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

type JobFilter =
  | 'all'
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'featured'
  | 'paid'
  | 'unpaid'
  | 'pending_payout'
  | 'released_payout'

type SortMode = 'newest' | 'oldest' | 'highest_pay' | 'lowest_pay'

const db = supabase as any
const PLATFORM_FEE_PERCENT = 10

function firstOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function parseMoney(value: string | null) {
  if (!value) return 0
  const cleaned = value.replace(/[^0-9.]/g, '')
  const amount = Number(cleaned)
  return Number.isFinite(amount) ? amount : 0
}

function money(value: number) {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
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

function companyName(job: CleanJob) {
  return job.company?.company_name || job.company?.full_name || 'Company'
}

function workerName(job: CleanJob) {
  return job.worker?.full_name || 'Unassigned'
}

export default function AdminJobsPage() {
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [jobs, setJobs] = useState<CleanJob[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [bulkWorking, setBulkWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<JobFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')

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

    const { data: adminData, error: adminError } = await db
      .from('profiles')
      .select('id, is_admin')
      .eq('id', user.id)
      .maybeSingle()

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

    const { data, error } = await db
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

    if (error) {
      setMessage(error.message)
      setJobs([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const cleaned: CleanJob[] = ((data || []) as Job[]).map((job) => ({
      ...job,
      company: firstOrNull(job.company),
      worker: firstOrNull(job.worker),
    }))

    setJobs(cleaned)
    setSelectedIds([])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  const analytics = useMemo(() => {
    const totalValue = jobs.reduce((sum, job) => sum + parseMoney(job.pay_rate), 0)
    const paidJobs = jobs.filter((job) => job.payment_status === 'paid')
    const paidValue = paidJobs.reduce((sum, job) => sum + parseMoney(job.pay_rate), 0)
    const unpaidValue = jobs
      .filter((job) => job.payment_status !== 'paid')
      .reduce((sum, job) => sum + parseMoney(job.pay_rate), 0)

    const pendingPayoutValue = jobs
      .filter(
        (job) =>
          job.payment_status === 'paid' &&
          job.status === 'completed' &&
          job.payout_status !== 'released'
      )
      .reduce((sum, job) => sum + parseMoney(job.pay_rate), 0)

    return {
      total: jobs.length,
      open: jobs.filter((job) => !job.status || job.status === 'open').length,
      assigned: jobs.filter((job) => job.status === 'assigned').length,
      inProgress: jobs.filter((job) => job.status === 'in_progress').length,
      completed: jobs.filter((job) => job.status === 'completed').length,
      paid: paidJobs.length,
      featured: jobs.filter((job) => job.is_featured).length,
      totalValue,
      paidValue,
      unpaidValue,
      pendingPayoutValue,
      platformRevenue: paidValue * (PLATFORM_FEE_PERCENT / 100),
      averageJobValue: jobs.length ? totalValue / jobs.length : 0,
    }
  }, [jobs])

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase()

    const filtered = jobs.filter((job) => {
      const searchable = [
        job.id,
        job.title,
        job.description,
        job.trade,
        job.location,
        job.pay_rate,
        job.status,
        job.payment_status,
        job.payout_status,
        companyName(job),
        workerName(job),
        job.company?.city,
        job.company?.state,
        job.worker?.city,
        job.worker?.state,
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
            : filter === 'paid'
              ? job.payment_status === 'paid'
              : filter === 'unpaid'
                ? job.payment_status !== 'paid'
                : filter === 'pending_payout'
                  ? job.payment_status === 'paid' &&
                    job.status === 'completed' &&
                    job.payout_status !== 'released'
                  : filter === 'released_payout'
                    ? job.payout_status === 'released'
                    : filter === 'open'
                      ? !job.status || job.status === 'open'
                      : job.status === filter

      return matchesSearch && matchesFilter
    })

    return [...filtered].sort((a, b) => {
      if (sortMode === 'highest_pay') return parseMoney(b.pay_rate) - parseMoney(a.pay_rate)
      if (sortMode === 'lowest_pay') return parseMoney(a.pay_rate) - parseMoney(b.pay_rate)

      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0

      return sortMode === 'oldest' ? aDate - bDate : bDate - aDate
    })
  }, [jobs, search, filter, sortMode])

  async function updateJob(jobId: string, update: JobUpdate) {
    setWorkingId(jobId)
    setMessage('')
    setSuccessMessage('')

    const { error } = await db.from('jobs').update(update).eq('id', jobId)

    if (error) {
      setMessage(error.message)
      setWorkingId(null)
      return
    }

    setJobs((current) =>
      current.map((job) => (job.id === jobId ? { ...job, ...update } : job))
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

    const { error } = await db.from('jobs').delete().eq('id', job.id)

    if (error) {
      setMessage(error.message)
      setWorkingId(null)
      return
    }

    setJobs((current) => current.filter((item) => item.id !== job.id))
    setSelectedIds((current) => current.filter((id) => id !== job.id))
    setSuccessMessage('Job deleted.')
    setWorkingId(null)
  }

  async function toggleFeatured(job: CleanJob) {
    const nextFeatured = !job.is_featured

    await updateJob(job.id, {
      is_featured: nextFeatured,
      featured_until: nextFeatured
        ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()
        : null,
    })
  }

  function toggleSelected(jobId: string) {
    setSelectedIds((current) =>
      current.includes(jobId)
        ? current.filter((id) => id !== jobId)
        : [...current, jobId]
    )
  }

  function toggleAllVisible() {
    const visibleIds = filteredJobs.map((job) => job.id)
    const allSelected = visibleIds.every((id) => selectedIds.includes(id))

    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds]))
    )
  }

  async function bulkUpdate(update: JobUpdate, label: string) {
    if (selectedIds.length === 0) return

    setBulkWorking(true)
    setMessage('')
    setSuccessMessage('')

    const { error } = await db.from('jobs').update(update).in('id', selectedIds)

    if (error) {
      setMessage(error.message)
      setBulkWorking(false)
      return
    }

    setJobs((current) =>
      current.map((job) =>
        selectedIds.includes(job.id) ? { ...job, ...update } : job
      )
    )

    setSuccessMessage(label)
    setBulkWorking(false)
  }

  async function bulkDelete() {
    if (selectedIds.length === 0) return

    const confirmed = window.confirm(
      `Delete ${selectedIds.length} selected job(s)? This cannot be undone.`
    )

    if (!confirmed) return

    setBulkWorking(true)
    setMessage('')
    setSuccessMessage('')

    const { error } = await db.from('jobs').delete().in('id', selectedIds)

    if (error) {
      setMessage(error.message)
      setBulkWorking(false)
      return
    }

    setJobs((current) => current.filter((job) => !selectedIds.includes(job.id)))
    setSelectedIds([])
    setSuccessMessage('Selected jobs deleted.')
    setBulkWorking(false)
  }

  function exportCsv() {
    const rows = filteredJobs.map((job) => ({
      id: job.id,
      title: job.title || '',
      company: companyName(job),
      worker: workerName(job),
      trade: job.trade || '',
      location: job.location || '',
      pay_rate: job.pay_rate || '',
      status: job.status || 'open',
      payment_status: job.payment_status || 'unpaid',
      payout_status: job.payout_status || '',
      featured: job.is_featured ? 'yes' : 'no',
      created_at: job.created_at || '',
    }))

    const headers = Object.keys(rows[0] || { id: '' })

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = String(row[header as keyof typeof row] || '')
            return `"${value.replaceAll('"', '""')}"`
          })
          .join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `crewcall-jobs-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()

    URL.revokeObjectURL(url)
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
                <Link href="/admin" className="text-sm font-black text-cyan-300 hover:text-cyan-200">
                  ← Back to Admin
                </Link>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  CrewCall Admin
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Jobs Control Center
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Track jobs, revenue, payment status, payouts, featured listings, and admin cleanup from one screen.
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <AdminJobStat label="Total Jobs" value={analytics.total} />
              <AdminJobStat label="Paid Volume" value={money(analytics.paidValue)} />
              <AdminJobStat label="Unpaid Volume" value={money(analytics.unpaidValue)} />
              <AdminJobStat label="Pending Payouts" value={money(analytics.pendingPayoutValue)} />
              <AdminJobStat label="Platform Revenue" value={money(analytics.platformRevenue)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <SmallStat label="Open" value={analytics.open} />
              <SmallStat label="Assigned" value={analytics.assigned} />
              <SmallStat label="In Progress" value={analytics.inProgress} />
              <SmallStat label="Completed" value={analytics.completed} />
              <SmallStat label="Paid Jobs" value={analytics.paid} />
              <SmallStat label="Featured" value={analytics.featured} />
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px]">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search job ID, title, company, worker, trade, city, status..."
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
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="pending_payout">Pending Payout</option>
                  <option value="released_payout">Released Payout</option>
                </select>

                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none focus:border-cyan-300/50"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest_pay">Highest Pay</option>
                  <option value="lowest_pay">Lowest Pay</option>
                </select>
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-black text-cyan-100">
                    {selectedIds.length} selected
                  </p>
                  <p className="mt-1 text-xs font-semibold text-cyan-100/70">
                    Bulk actions only affect selected jobs.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={toggleAllVisible}
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white"
                  >
                    Select Visible
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void bulkUpdate(
                        {
                          is_featured: true,
                          featured_until: new Date(
                            Date.now() + 1000 * 60 * 60 * 24 * 7
                          ).toISOString(),
                        },
                        'Selected jobs featured.'
                      )
                    }
                    disabled={bulkWorking || selectedIds.length === 0}
                    className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                  >
                    Feature
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void bulkUpdate({ status: 'completed' }, 'Selected jobs completed.')
                    }
                    disabled={bulkWorking || selectedIds.length === 0}
                    className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                  >
                    Complete
                  </button>

                  <button
                    type="button"
                    onClick={exportCsv}
                    className="rounded-2xl bg-blue-500 px-4 py-3 text-sm font-black text-white"
                  >
                    Export CSV
                  </button>

                  <button
                    type="button"
                    onClick={() => void bulkDelete()}
                    disabled={bulkWorking || selectedIds.length === 0}
                    className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            {filteredJobs.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-8 text-center">
                <p className="text-xl font-black text-white">No jobs found.</p>
                <p className="mt-2 text-sm font-semibold text-slate-400">
                  Try adjusting the search, filter, or sort.
                </p>
              </div>
            ) : (
              <div className="grid gap-5">
                {filteredJobs.map((job) => {
                  const working = workingId === job.id
                  const selected = selectedIds.includes(job.id)
                  const payoutReady =
                    job.payment_status === 'paid' &&
                    job.status === 'completed' &&
                    job.payout_status !== 'released'

                  return (
                    <article
                      key={job.id}
                      className={`rounded-[2rem] border p-6 shadow-xl shadow-black/10 transition ${
                        selected
                          ? 'border-cyan-300/60 bg-cyan-400/10'
                          : 'border-white/10 bg-slate-950/60 hover:border-cyan-300/30'
                      }`}
                    >
                      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleSelected(job.id)}
                              className="h-5 w-5 rounded border-white/20 bg-slate-950"
                            />

                            <h2 className="truncate text-2xl font-black text-white">
                              {job.title || 'Untitled Job'}
                            </h2>

                            <Badge label={cleanStatus(job.status)} />
                            <Badge label={job.payment_status || 'unpaid'} tone={job.payment_status === 'paid' ? 'emerald' : 'amber'} />
                            <Badge label={job.payout_status || 'no payout'} tone={job.payout_status === 'released' ? 'emerald' : 'slate'} />

                            {job.is_featured && <Badge label="Featured" tone="cyan" />}
                            {payoutReady && <Badge label="Payout Ready" tone="emerald" />}
                          </div>

                          <p className="mt-3 text-sm font-semibold text-slate-300">
                            {job.trade || 'Trade not listed'} • {job.location || 'Location not listed'} • {job.pay_rate || 'Pay not listed'}
                          </p>

                          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
                            {job.description || 'No description listed.'}
                          </p>

                          <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-300 md:grid-cols-2 xl:grid-cols-4">
                            <p><span className="text-cyan-300">Company:</span> {companyName(job)}</p>
                            <p><span className="text-cyan-300">Worker:</span> {workerName(job)}</p>
                            <p><span className="text-cyan-300">Start:</span> {formatDate(job.start_date)}</p>
                            <p><span className="text-cyan-300">Posted:</span> {formatDate(job.created_at)}</p>
                            <p><span className="text-cyan-300">Job Value:</span> {money(parseMoney(job.pay_rate))}</p>
                            <p><span className="text-cyan-300">Platform Fee:</span> {money(parseMoney(job.pay_rate) * 0.1)}</p>
                            <p className="md:col-span-2"><span className="text-cyan-300">Featured Until:</span> {formatDate(job.featured_until)}</p>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:w-72 xl:grid-cols-1">
                          <Link href={`/jobs/${job.id}`} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/15">
                            View Job
                          </Link>

                          <Link href={`/my-jobs/${job.id}/applicants`} className="rounded-2xl bg-blue-500 px-4 py-3 text-center text-sm font-black text-white hover:bg-blue-400">
                            Applicants
                          </Link>

                          <Link href={`/companies/${job.company_id || ''}`} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/15">
                            Company Profile
                          </Link>

                          {job.assigned_worker_id && (
                            <Link href={`/profile/${job.assigned_worker_id}`} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/15">
                              Worker Profile
                            </Link>
                          )}

                          <button
                            type="button"
                            onClick={() => void toggleFeatured(job)}
                            disabled={working}
                            className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
                          >
                            {job.is_featured ? 'Unfeature' : 'Feature'}
                          </button>

                          <button
                            type="button"
                            onClick={() => void updateJob(job.id, { status: 'open' })}
                            disabled={working}
                            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15 disabled:opacity-60"
                          >
                            Mark Open
                          </button>

                          <button
                            type="button"
                            onClick={() => void updateJob(job.id, { status: 'in_progress' })}
                            disabled={working}
                            className="rounded-2xl bg-purple-500 px-4 py-3 text-sm font-black text-white hover:bg-purple-400 disabled:opacity-60"
                          >
                            In Progress
                          </button>

                          <button
                            type="button"
                            onClick={() => void updateJob(job.id, { status: 'completed' })}
                            disabled={working}
                            className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white hover:bg-emerald-400 disabled:opacity-60"
                          >
                            Complete
                          </button>

                          <button
                            type="button"
                            onClick={() => void deleteJob(job)}
                            disabled={working}
                            className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 hover:bg-red-500/20 disabled:opacity-60"
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

function AdminJobStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
    </div>
  )
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function Badge({
  label,
  tone = 'slate',
}: {
  label: string
  tone?: 'slate' | 'cyan' | 'emerald' | 'amber'
}) {
  const classes =
    tone === 'cyan'
      ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
      : tone === 'emerald'
        ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
        : tone === 'amber'
          ? 'border-amber-400/20 bg-amber-400/10 text-amber-100'
          : 'border-white/10 bg-white/10 text-slate-200'

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${classes}`}>
      {label}
    </span>
  )
}