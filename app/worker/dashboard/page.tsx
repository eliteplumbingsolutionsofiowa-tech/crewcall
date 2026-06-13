'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Company = {
  full_name: string | null
  company_name: string | null
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
  company_id: string | null
  company?: Company | null
}

type ApplicationJob = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  status: string | null
}

type Application = {
  id: string
  status: string | null
  created_at: string
  job_id: string
  job?: ApplicationJob | null
}

type RawJob = Omit<Job, 'company'> & {
  company: Company | Company[] | null
}

type RawApplication = Omit<Application, 'job'> & {
  job: ApplicationJob | ApplicationJob[] | null
}

type QueryError = {
  message: string
}

type OrderedQuery<T> = {
  order: (
    column: string,
    options?: { ascending?: boolean }
  ) => Promise<{ data: T[] | null; error: QueryError | null }>
}

type FilteredQuery<T> = {
  eq: (column: string, value: string) => OrderedQuery<T>
}

type SelectQuery<T> = {
  select: (columns: string) => FilteredQuery<T>
}

function jobsTable() {
  return supabase.from('jobs') as unknown as SelectQuery<RawJob>
}

function applicationsTable() {
  return supabase.from('applications') as unknown as SelectQuery<RawApplication>
}

function firstOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value
}

function cleanStatus(value: string | null) {
  return (value || 'unknown').replaceAll('_', ' ')
}

function parsePay(value: string | null) {
  if (!value) return 0
  const cleaned = value.replace(/[^0-9.]/g, '')
  return Number(cleaned) || 0
}

function money(value: number) {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function formatDate(value: string | null) {
  if (!value) return 'No date set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No date set'
  return date.toLocaleDateString()
}

export default function WorkerDashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  const stats = useMemo(() => {
    const active = jobs.filter((job) =>
      ['assigned', 'in_progress'].includes(job.status || '')
    )

    const completed = jobs.filter((job) => job.status === 'completed')
    const paid = jobs.filter((job) => job.payment_status === 'paid')
    const unpaidCompleted = completed.filter(
      (job) => job.payment_status !== 'paid'
    )

    return {
      activeCount: active.length,
      completedCount: completed.length,
      paidCount: paid.length,
      pendingApplications: applications.filter(
        (application) => application.status === 'pending'
      ).length,
      paidTotal: paid.reduce((sum, job) => sum + parsePay(job.pay_rate), 0),
      unpaidTotal: unpaidCompleted.reduce(
        (sum, job) => sum + parsePay(job.pay_rate),
        0
      ),
    }
  }, [jobs, applications])

  const currentJobs = useMemo(() => {
    return jobs
      .filter((job) => ['assigned', 'in_progress'].includes(job.status || ''))
      .slice(0, 4)
  }, [jobs])

  const recentApplications = useMemo(() => {
    return applications.slice(0, 4)
  }, [applications])

  async function loadDashboard() {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to view your dashboard.')
      setLoading(false)
      return
    }

    const { data: assignedJobs, error: jobsError } = await jobsTable()
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
        company_id,
        company:profiles!jobs_company_id_fkey (
          full_name,
          company_name
        )
      `)
      .eq('assigned_worker_id', user.id)
      .order('start_date', { ascending: false })

    if (jobsError) {
      setMessage(jobsError.message)
      setLoading(false)
      return
    }

    const { data: applicationData, error: applicationsError } =
      await applicationsTable()
        .select(`
          id,
          status,
          created_at,
          job_id,
          job:jobs!applications_job_id_fkey (
            id,
            title,
            trade,
            location,
            pay_rate,
            status
          )
        `)
        .eq('worker_id', user.id)
        .order('created_at', { ascending: false })

    if (applicationsError) {
      setMessage(applicationsError.message)
      setLoading(false)
      return
    }

    const cleanedJobs: Job[] = (assignedJobs || []).map((job) => ({
      ...job,
      company: firstOrNull(job.company),
    }))

    const cleanedApplications: Application[] = (applicationData || []).map(
      (application) => ({
        ...application,
        job: firstOrNull(application.job),
      })
    )

    setJobs(cleanedJobs)
    setApplications(cleanedApplications)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/20 backdrop-blur md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                CrewCall Worker
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
                Worker Dashboard
              </h1>

              <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-300">
                Track your active work, pending applications, completed jobs, and
                paid earnings.
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
                href="/my-work"
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
              >
                My Work
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active Jobs" value={stats.activeCount} />
            <StatCard label="Completed" value={stats.completedCount} />
            <StatCard label="Paid Jobs" value={stats.paidCount} />
            <StatCard label="Pending Apps" value={stats.pendingApplications} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <MoneyCard
              label="Paid Earnings"
              value={money(stats.paidTotal)}
              tone="green"
            />

            <MoneyCard
              label="Waiting on Payment"
              value={money(stats.unpaidTotal)}
              tone="orange"
            />
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-8 text-slate-300">
            Loading dashboard...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/20 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white">
                    Current Work
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-400">
                    Jobs assigned to you right now.
                  </p>
                </div>

                <Link
                  href="/my-work"
                  className="text-sm font-black text-cyan-300 hover:text-cyan-200"
                >
                  View all →
                </Link>
              </div>

              {currentJobs.length === 0 ? (
                <EmptyState
                  title="No active work"
                  body="When a company hires you, the job will appear here."
                  href="/jobs"
                  label="Find Jobs"
                />
              ) : (
                <div className="mt-5 grid gap-4">
                  {currentJobs.map((job) => {
                    const companyName =
                      job.company?.company_name ||
                      job.company?.full_name ||
                      'Company'

                    return (
                      <Link
                        key={job.id}
                        href={`/jobs/${job.id}`}
                        className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 transition hover:border-cyan-300/30 hover:bg-slate-950/60"
                      >
                        <div className="flex flex-wrap gap-2">
                          <Badge value={job.status || 'assigned'} />
                          <Badge value={job.payment_status || 'unpaid'} />
                        </div>

                        <h3 className="mt-4 text-xl font-black text-white">
                          {job.title || 'Untitled Job'}
                        </h3>

                        <p className="mt-2 text-sm font-semibold text-slate-300">
                          {companyName}
                        </p>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <MiniInfo label="Trade" value={job.trade || 'N/A'} />
                          <MiniInfo
                            label="Location"
                            value={job.location || 'N/A'}
                          />
                          <MiniInfo
                            label="Pay"
                            value={job.pay_rate || 'Not listed'}
                          />
                          <MiniInfo
                            label="Start"
                            value={formatDate(job.start_date)}
                          />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/20 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white">
                    Applications
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-400">
                    Recent jobs you applied to.
                  </p>
                </div>

                <Link
                  href="/applications"
                  className="text-sm font-black text-cyan-300 hover:text-cyan-200"
                >
                  View all →
                </Link>
              </div>

              {recentApplications.length === 0 ? (
                <EmptyState
                  title="No applications yet"
                  body="Browse jobs and apply to start getting hired."
                  href="/jobs"
                  label="Browse Jobs"
                />
              ) : (
                <div className="mt-5 grid gap-4">
                  {recentApplications.map((application) => (
                    <Link
                      key={application.id}
                      href={`/jobs/${application.job_id}`}
                      className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 transition hover:border-cyan-300/30 hover:bg-slate-950/60"
                    >
                      <div className="flex flex-wrap gap-2">
                        <Badge value={application.status || 'pending'} />
                        <Badge value={application.job?.status || 'job open'} />
                      </div>

                      <h3 className="mt-4 text-lg font-black text-white">
                        {application.job?.title || 'Untitled Job'}
                      </h3>

                      <p className="mt-2 text-sm font-semibold text-slate-300">
                        {[application.job?.trade, application.job?.location]
                          .filter(Boolean)
                          .join(' • ') || 'No trade/location listed'}
                      </p>

                      <p className="mt-3 text-sm font-black text-cyan-300">
                        {application.job?.pay_rate || 'Pay not listed'}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  )
}

function MoneyCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'green' | 'orange'
}) {
  const classes =
    tone === 'green'
      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
      : 'border-orange-400/20 bg-orange-400/10 text-orange-100'

  return (
    <div className={`rounded-3xl border p-5 ${classes}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-80">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  )
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  )
}

function Badge({ value }: { value: string }) {
  const lower = value.toLowerCase()

  const classes =
    lower.includes('paid') ||
    lower.includes('accepted') ||
    lower.includes('assigned') ||
    lower.includes('completed')
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
      : lower.includes('rejected') || lower.includes('closed')
        ? 'border-red-400/30 bg-red-400/10 text-red-100'
        : lower.includes('progress') || lower.includes('pending')
          ? 'border-orange-400/30 bg-orange-400/10 text-orange-100'
          : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${classes}`}
    >
      {cleanStatus(value)}
    </span>
  )
}

function EmptyState({
  title,
  body,
  href,
  label,
}: {
  title: string
  body: string
  href: string
  label: string
}) {
  return (
    <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/40 p-6">
      <h3 className="text-xl font-black text-white">{title}</h3>
      <p className="mt-2 text-sm font-semibold text-slate-400">{body}</p>
      <Link
        href={href}
        className="mt-5 inline-flex rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
      >
        {label}
      </Link>
    </div>
  )
}