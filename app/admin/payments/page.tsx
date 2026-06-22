'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type AdminProfile = {
  id: string
  is_admin: boolean | null
}

type JobPayment = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  payment_status: string | null
  payout_status: string | null
  status: string | null
  company_id: string | null
  assigned_worker_id: string | null
  created_at: string | null
  company: PaymentProfile | PaymentProfile[] | null
  worker: PaymentProfile | PaymentProfile[] | null
}

type PaymentProfile = {
  id: string
  full_name: string | null
  company_name: string | null
  stripe_account_id: string | null
  stripe_onboarded: boolean | null
}

type CleanJobPayment = Omit<JobPayment, 'company' | 'worker'> & {
  company: PaymentProfile | null
  worker: PaymentProfile | null
}

type PaymentCounts = {
  totalJobs: number
  paidJobs: number
  unpaidJobs: number
  pendingPayments: number
  releasedPayouts: number
  pendingPayouts: number
  completedJobs: number
  assignedJobs: number
}

type PaymentFilter =
  | 'all'
  | 'paid'
  | 'unpaid'
  | 'pending'
  | 'released'
  | 'pending_payout'
  | 'completed'

const emptyCounts: PaymentCounts = {
  totalJobs: 0,
  paidJobs: 0,
  unpaidJobs: 0,
  pendingPayments: 0,
  releasedPayouts: 0,
  pendingPayouts: 0,
  completedJobs: 0,
  assignedJobs: 0,
}

function firstOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export default function AdminPaymentsPage() {
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [jobs, setJobs] = useState<CleanJobPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PaymentFilter>('all')

  const loadPayments = useCallback(async () => {
    setRefreshing(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to access admin payments.')
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
        title,
        trade,
        location,
        pay_rate,
        payment_status,
        payout_status,
        status,
        company_id,
        assigned_worker_id,
        created_at,
        company:profiles!jobs_company_id_fkey (
          id,
          full_name,
          company_name,
          stripe_account_id,
          stripe_onboarded
        ),
        worker:profiles!jobs_assigned_worker_id_fkey (
          id,
          full_name,
          company_name,
          stripe_account_id,
          stripe_onboarded
        )
      `
      )
      .order('created_at', { ascending: false })
      .returns<JobPayment[]>()

    if (error) {
      setMessage(error.message)
      setJobs([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const cleaned: CleanJobPayment[] = (data ?? []).map((job) => ({
      id: job.id,
      title: job.title,
      trade: job.trade,
      location: job.location,
      pay_rate: job.pay_rate,
      payment_status: job.payment_status,
      payout_status: job.payout_status,
      status: job.status,
      company_id: job.company_id,
      assigned_worker_id: job.assigned_worker_id,
      created_at: job.created_at,
      company: firstOrNull(job.company),
      worker: firstOrNull(job.worker),
    }))

    setJobs(cleaned)
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void loadPayments()
  }, [loadPayments])

  const counts = useMemo<PaymentCounts>(() => {
    return {
      totalJobs: jobs.length,
      paidJobs: jobs.filter((job) => job.payment_status === 'paid').length,
      unpaidJobs: jobs.filter(
        (job) => !job.payment_status || job.payment_status === 'unpaid'
      ).length,
      pendingPayments: jobs.filter((job) => job.payment_status === 'pending')
        .length,
      releasedPayouts: jobs.filter((job) => job.payout_status === 'released')
        .length,
      pendingPayouts: jobs.filter(
        (job) =>
          job.payment_status === 'paid' && job.payout_status !== 'released'
      ).length,
      completedJobs: jobs.filter((job) => job.status === 'completed').length,
      assignedJobs: jobs.filter((job) => job.status === 'assigned').length,
    }
  }, [jobs])

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase()

    return jobs.filter((job) => {
      const companyName =
        job.company?.company_name || job.company?.full_name || ''
      const workerName =
        job.worker?.full_name || job.worker?.company_name || ''

      const searchable = [
        job.title,
        job.trade,
        job.location,
        job.pay_rate,
        job.payment_status,
        job.payout_status,
        job.status,
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
          : filter === 'paid'
            ? job.payment_status === 'paid'
            : filter === 'unpaid'
              ? !job.payment_status || job.payment_status === 'unpaid'
              : filter === 'pending'
                ? job.payment_status === 'pending'
                : filter === 'released'
                  ? job.payout_status === 'released'
                  : filter === 'pending_payout'
                    ? job.payment_status === 'paid' &&
                      job.payout_status !== 'released'
                    : job.status === 'completed'

      return matchesSearch && matchesFilter
    })
  }, [jobs, search, filter])

  function companyName(job: CleanJobPayment) {
    return job.company?.company_name || job.company?.full_name || 'Company'
  }

  function workerName(job: CleanJobPayment) {
    return job.worker?.full_name || job.worker?.company_name || 'Unassigned'
  }

  function cleanStatus(value: string | null) {
    return (value || 'unknown').replaceAll('_', ' ')
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
          <h1 className="mt-3 text-3xl font-black">Loading payments...</h1>
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
          <div className="bg-gradient-to-r from-emerald-500/15 via-blue-500/10 to-cyan-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <Link
                  href="/admin"
                  className="text-sm font-black text-cyan-300 hover:text-cyan-200"
                >
                  ← Back to Admin
                </Link>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
                  CrewCall Admin
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Payments
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Monitor job payments, payout status, completed work, unpaid
                  jobs, and Stripe onboarding readiness.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadPayments()}
                disabled={refreshing}
                className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? 'Refreshing...' : 'Refresh Payments'}
              </button>
            </div>
          </div>

          <div className="space-y-6 p-6 md:p-8">
            {message && (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100">
                {message}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <PaymentStat label="Total Jobs" value={counts.totalJobs} />
              <PaymentStat label="Paid Jobs" value={counts.paidJobs} />
              <PaymentStat label="Unpaid Jobs" value={counts.unpaidJobs} />
              <PaymentStat label="Pending Payments" value={counts.pendingPayments} />
              <PaymentStat label="Released Payouts" value={counts.releasedPayouts} />
              <PaymentStat label="Pending Payouts" value={counts.pendingPayouts} />
              <PaymentStat label="Completed Jobs" value={counts.completedJobs} />
              <PaymentStat label="Assigned Jobs" value={counts.assignedJobs} />
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_230px]">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search job, company, worker, payment status, location..."
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-emerald-300/50"
                />

                <select
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as PaymentFilter)
                  }
                  className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none focus:border-emerald-300/50"
                >
                  <option value="all">All Payments</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="pending">Pending Payment</option>
                  <option value="released">Payout Released</option>
                  <option value="pending_payout">Pending Payout</option>
                  <option value="completed">Completed Jobs</option>
                </select>
              </div>
            </div>

            {filteredJobs.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-8 text-center">
                <p className="text-xl font-black text-white">
                  No payment records found.
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-400">
                  Try adjusting your search or filter.
                </p>
              </div>
            ) : (
              <div className="grid gap-5">
                {filteredJobs.map((job) => (
                  <article
                    key={job.id}
                    className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-xl shadow-black/10 transition hover:border-emerald-300/30"
                  >
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-2xl font-black text-white">
                            {job.title || 'Untitled Job'}
                          </h2>

                          <Badge label={cleanStatus(job.payment_status)} tone="emerald" />
                          <Badge label={`Payout: ${cleanStatus(job.payout_status)}`} />
                          <Badge label={cleanStatus(job.status)} tone="cyan" />
                        </div>

                        <p className="mt-3 text-sm font-semibold text-slate-300">
                          {job.trade || 'Trade not listed'} •{' '}
                          {job.location || 'Location not listed'} •{' '}
                          {job.pay_rate || 'Pay not listed'}
                        </p>

                        <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-300 md:grid-cols-2 xl:grid-cols-4">
                          <p>
                            <span className="text-emerald-300">Company:</span>{' '}
                            {companyName(job)}
                          </p>

                          <p>
                            <span className="text-emerald-300">Worker:</span>{' '}
                            {workerName(job)}
                          </p>

                          <p>
                            <span className="text-emerald-300">Posted:</span>{' '}
                            {formatDate(job.created_at)}
                          </p>

                          <p>
                            <span className="text-emerald-300">Worker Stripe:</span>{' '}
                            {job.worker?.stripe_onboarded ? 'Ready' : 'Not ready'}
                          </p>

                          <p className="md:col-span-2">
                            <span className="text-emerald-300">
                              Company Stripe:
                            </span>{' '}
                            {job.company?.stripe_onboarded ? 'Ready' : 'Not ready'}
                          </p>

                          <p className="md:col-span-2">
                            <span className="text-emerald-300">
                              Worker Account:
                            </span>{' '}
                            {job.worker?.stripe_account_id || 'Not connected'}
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
                          href={`/profile?user=${job.company_id || ''}`}
                          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-white/15"
                        >
                          Company
                        </Link>

                        {job.assigned_worker_id && (
                          <Link
                            href={`/profile?user=${job.assigned_worker_id}`}
                            className="rounded-2xl bg-blue-500 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-blue-400"
                          >
                            Worker
                          </Link>
                        )}

                        <Link
                          href="/admin/jobs"
                          className="rounded-2xl bg-emerald-400 px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-emerald-300"
                        >
                          Manage Job
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function PaymentStat({ label, value }: { label: string; value: number }) {
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