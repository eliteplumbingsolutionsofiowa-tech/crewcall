'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
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
  is_featured: boolean | null
  featured_until: string | null
  created_at: string | null
}

type Application = {
  id: string
  status: string | null
  job_id: string
}

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
  if (!value) return 'No date set'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'No date set'

  return date.toLocaleDateString()
}

export default function CompanyDashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [savedWorkers, setSavedWorkers] = useState(0)

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadDashboard()

    const refreshDashboard = () => {
      loadDashboard()
      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    }

    const channel = supabase
      .channel('company-dashboard-live-upgraded-v2')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        refreshDashboard
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        refreshDashboard
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'saved_workers' },
        refreshDashboard
      )
      .subscribe()

    window.addEventListener('focus', refreshDashboard)

    return () => {
      window.removeEventListener('focus', refreshDashboard)
      supabase.removeChannel(channel)
    }
  }, [])

  const stats = useMemo(() => {
    const open = jobs.filter((job) => job.status === 'open')

    const active = jobs.filter((job) =>
      ['assigned', 'in_progress'].includes(job.status || '')
    )

    const completed = jobs.filter(
      (job) => job.status === 'completed'
    )

    const paid = jobs.filter(
      (job) => job.payment_status === 'paid'
    )

    const unpaid = jobs.filter(
      (job) => job.payment_status !== 'paid'
    )

    const featured = jobs.filter((job) => job.is_featured)

    return {
      totalJobs: jobs.length,
      openJobs: open.length,
      activeJobs: active.length,
      completedJobs: completed.length,
      paidJobs: paid.length,
      unpaidJobs: unpaid.length,
      featuredJobs: featured.length,
      applications: applications.length,

      totalSpend: paid.reduce(
        (sum, job) => sum + parsePay(job.pay_rate),
        0
      ),

      unpaidTotal: unpaid.reduce(
        (sum, job) => sum + parsePay(job.pay_rate),
        0
      ),
    }
  }, [jobs, applications])

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

    const { data: jobData, error: jobsError } = await supabase
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
        is_featured,
        featured_until,
        created_at
      `)
      .eq('company_id', user.id)
      .order('created_at', { ascending: false })

    if (jobsError) {
      setMessage(jobsError.message)
      setLoading(false)
      return
    }

    const jobIds = ((jobData || []) as Job[]).map((job) => job.id)

    let applicationData: Application[] = []

    if (jobIds.length > 0) {
      const { data, error: applicationsError } = await supabase
        .from('applications')
        .select('id, status, job_id')
        .in('job_id', jobIds)

      if (applicationsError) {
        setMessage(applicationsError.message)
        setLoading(false)
        return
      }

      applicationData = (data || []) as Application[]
    }

    const { count: savedCount } = await supabase
      .from('saved_workers')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', user.id)

    setSavedWorkers(savedCount ?? 0)

    setJobs((jobData || []) as Job[])
    setApplications(applicationData)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="bg-gradient-to-r from-orange-500/15 via-red-500/10 to-yellow-500/10 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-300">
                  CrewCall Company
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Company Dashboard
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Manage jobs, applicants, workers, payments, recruiting,
                  hiring, and saved tradespeople from one command center.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/post-job"
                  className="rounded-2xl bg-orange-400 px-6 py-4 text-sm font-black text-slate-950 shadow-xl shadow-orange-500/20 transition hover:scale-[1.02] hover:bg-orange-300"
                >
                  Post Job
                </Link>

                <Link
                  href="/find-workers"
                  className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-6 py-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/20"
                >
                  Find Workers
                </Link>

                <Link
                  href="/saved-workers"
                  className="rounded-2xl border border-white/10 bg-white/10 px-6 py-4 text-sm font-black text-white transition hover:bg-white/20"
                >
                  Saved Workers
                </Link>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <StatCard label="Total Jobs" value={stats.totalJobs} />
              <StatCard label="Open Jobs" value={stats.openJobs} />
              <StatCard label="Active Jobs" value={stats.activeJobs} />
              <StatCard label="Applicants" value={stats.applications} />
              <StatCard label="Featured" value={stats.featuredJobs} />
              <StatCard label="Saved Workers" value={savedWorkers} />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <MoneyCard
                label="Paid Out"
                value={money(stats.totalSpend)}
                tone="green"
              />

              <MoneyCard
                label="Unpaid / Pending"
                value={money(stats.unpaidTotal)}
                tone="orange"
              />
            </div>
          </div>
        </section>

        {message && (
          <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-5 text-sm font-bold text-red-100">
            {message}
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-4">
          <QuickActionCard
            href="/post-job"
            title="Post New Job"
            description="Create a new CrewCall job posting and start receiving applicants."
            tone="orange"
          />

          <QuickActionCard
            href="/find-workers"
            title="Find Workers"
            description="Browse skilled tradespeople by trade, location, insurance, and experience."
            tone="cyan"
          />

          <QuickActionCard
            href="/saved-workers"
            title="Saved Workers"
            description="Access your favorite workers and invite them back to jobs instantly."
            tone="blue"
          />

          <QuickActionCard
            href="/company/applications"
            title="Review Applicants"
            description="Manage applications and hire workers from your job pipeline."
            tone="emerald"
          />
        </section>

        {loading ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-8 text-lg font-black text-slate-300 backdrop-blur">
            Loading dashboard...
          </div>
        ) : (
          <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/20 backdrop-blur md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-3xl font-black text-white">
                  Recent Jobs
                </h2>

                <p className="mt-2 text-sm font-semibold text-slate-400">
                  Your newest CrewCall postings and applicant activity.
                </p>
              </div>

              <Link
                href="/my-jobs"
                className="text-sm font-black text-orange-300 transition hover:text-orange-200"
              >
                View all jobs →
              </Link>
            </div>

            {jobs.length === 0 ? (
              <div className="mt-6 rounded-[2rem] border border-white/10 bg-slate-950/40 p-8 md:p-10">
                <h3 className="text-2xl font-black text-white">
                  No jobs posted yet
                </h3>

                <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-400">
                  Create your first CrewCall job post and start receiving worker
                  applications instantly.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/post-job"
                    className="inline-flex rounded-2xl bg-orange-400 px-6 py-4 text-sm font-black text-slate-950 shadow-xl shadow-orange-500/20 transition hover:scale-[1.02] hover:bg-orange-300"
                  >
                    Post Your First Job
                  </Link>

                  <Link
                    href="/find-workers"
                    className="inline-flex rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-6 py-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/20"
                  >
                    Browse Workers
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-5">
                {jobs.slice(0, 6).map((job) => (
                  <Link
                    key={job.id}
                    href={`/my-jobs/${job.id}/applicants`}
                    className="group rounded-[2rem] border border-white/10 bg-slate-950/40 p-6 transition-all duration-200 hover:-translate-y-1 hover:border-orange-300/40 hover:bg-slate-950/60 hover:shadow-2xl"
                  >
                    <div className="flex flex-wrap gap-2">
                      <Badge value={job.status || 'unknown'} />
                      <Badge value={job.payment_status || 'unpaid'} />

                      {job.is_featured && (
                        <Badge value="featured" />
                      )}
                    </div>

                    <h3 className="mt-5 text-2xl font-black tracking-tight text-white">
                      {job.title || 'Untitled Job'}
                    </h3>

                    <p className="mt-2 text-sm font-semibold text-slate-300">
                      {[job.trade, job.location]
                        .filter(Boolean)
                        .join(' • ') || 'No trade/location listed'}
                    </p>

                    <div className="mt-5 grid gap-4 sm:grid-cols-3">
                      <MiniInfo
                        label="Pay"
                        value={job.pay_rate || 'Not listed'}
                      />

                      <MiniInfo
                        label="Start"
                        value={formatDate(job.start_date)}
                      />

                      <MiniInfo
                        label="Applicants"
                        value={String(
                          applications.filter(
                            (app) => app.job_id === job.id
                          ).length
                        )}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
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
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-3 text-4xl font-black tracking-tight text-white">
        {value}
      </p>
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
    <div className={`rounded-3xl border p-6 ${classes}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-80">
        {label}
      </p>

      <p className="mt-3 text-4xl font-black tracking-tight">
        {value}
      </p>
    </div>
  )
}

function QuickActionCard({
  href,
  title,
  description,
  tone,
}: {
  href: string
  title: string
  description: string
  tone: 'orange' | 'cyan' | 'blue' | 'emerald'
}) {
  const toneClasses = {
    orange:
      'border-orange-400/20 bg-orange-400/10 hover:border-orange-300/40',
    cyan: 'border-cyan-400/20 bg-cyan-400/10 hover:border-cyan-300/40',
    blue: 'border-blue-400/20 bg-blue-400/10 hover:border-blue-300/40',
    emerald:
      'border-emerald-400/20 bg-emerald-400/10 hover:border-emerald-300/40',
  }

  return (
    <Link
      href={href}
      className={`rounded-[2rem] border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl ${toneClasses[tone]}`}
    >
      <h3 className="text-2xl font-black text-white">
        {title}
      </h3>

      <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
        {description}
      </p>
    </Link>
  )
}

function MiniInfo({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-sm font-bold text-white">
        {value}
      </p>
    </div>
  )
}

function Badge({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-orange-100">
      {value.replaceAll('_', ' ')}
    </span>
  )
}