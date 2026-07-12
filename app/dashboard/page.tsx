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
  payout_status: string | null
  is_featured: boolean | null
  featured_until: string | null
  created_at: string | null
  assigned_worker_id: string | null
}

type Application = {
  id: string
  status: string | null
  job_id: string
  created_at: string | null
  worker_id: string | null
}

type NotificationRow = {
  id: string
  title: string | null
  body: string | null
  type: string | null
  created_at: string | null
  read: boolean | null
  is_read: boolean | null
}

type ReviewRow = {
  id: string
  rating: number | null
  created_at: string | null
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

function cleanStatus(value: string | null) {
  return (value || 'unknown').replaceAll('_', ' ')
}

function isUnread(row: { read?: boolean | null; is_read?: boolean | null }) {
  return row.read === false || row.is_read === false
}

export default function CompanyDashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [reviews, setReviews] = useState<ReviewRow[]>([])
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
      .channel('company-dashboard-live-v21')
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
        { event: '*', schema: 'public', table: 'notifications' },
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
    const assigned = jobs.filter((job) => job.status === 'assigned')
    const inProgress = jobs.filter((job) => job.status === 'in_progress')
    const completed = jobs.filter((job) => job.status === 'completed')
    const paid = jobs.filter((job) => job.payment_status === 'paid')
    const unpaid = jobs.filter((job) => job.payment_status !== 'paid')
    const featured = jobs.filter((job) => job.is_featured)
    const pendingApps = applications.filter((app) => app.status === 'pending')

    const hiredWorkers = new Set(
      jobs
        .map((job) => job.assigned_worker_id)
        .filter((workerId): workerId is string => Boolean(workerId))
    )

    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) /
          reviews.length
        : 0

    return {
      totalJobs: jobs.length,
      openJobs: open.length,
      assignedJobs: assigned.length,
      inProgressJobs: inProgress.length,
      activeJobs: assigned.length + inProgress.length,
      completedJobs: completed.length,
      paidJobs: paid.length,
      unpaidJobs: unpaid.length,
      featuredJobs: featured.length,
      applications: applications.length,
      pendingApplications: pendingApps.length,
      hiredWorkers: hiredWorkers.size,
      unreadNotifications: notifications.filter(isUnread).length,
      reviewCount: reviews.length,
      averageRating,
      completionRate:
        jobs.length > 0 ? Math.round((completed.length / jobs.length) * 100) : 0,
      totalSpend: paid.reduce((sum, job) => sum + parsePay(job.pay_rate), 0),
      unpaidTotal: unpaid.reduce((sum, job) => sum + parsePay(job.pay_rate), 0),
    }
  }, [jobs, applications, notifications, reviews])

  const jobsNeedingPayment = useMemo(() => {
    return jobs.filter(
      (job) => job.status === 'completed' && job.payment_status !== 'paid'
    )
  }, [jobs])

  const jobsWithApplicants = useMemo(() => {
    const jobIds = new Set(applications.map((app) => app.job_id))
    return jobs.filter((job) => job.status === 'open' && jobIds.has(job.id))
  }, [jobs, applications])

  const payoutReadyJobs = useMemo(() => {
    return jobs.filter(
      (job) =>
        job.status === 'completed' &&
        job.payment_status === 'paid' &&
        job.payout_status !== 'released'
    )
  }, [jobs])

  const upcomingJobs = useMemo(() => {
    return [...jobs]
      .filter((job) => Boolean(job.start_date))
      .sort((a, b) => {
        const aDate = new Date(a.start_date || '').getTime()
        const bDate = new Date(b.start_date || '').getTime()
        return aDate - bDate
      })
      .slice(0, 5)
  }, [jobs])

  const recentActivity = useMemo(() => {
    const items: {
      id: string
      label: string
      detail: string
      createdAt: string | null
      href: string
      tone: 'cyan' | 'orange' | 'emerald' | 'blue'
    }[] = []

    applications.slice(0, 6).forEach((application) => {
      const job = jobs.find((item) => item.id === application.job_id)

      items.push({
        id: `application-${application.id}`,
        label: 'New application',
        detail: job?.title || 'A worker applied to a job',
        createdAt: application.created_at,
        href: job ? `/my-jobs/${job.id}/applicants` : '/company/applications',
        tone: 'orange',
      })
    })

    notifications.slice(0, 6).forEach((notification) => {
      items.push({
        id: `notification-${notification.id}`,
        label: notification.title || 'Notification',
        detail: notification.body || notification.type || 'CrewCall update',
        createdAt: notification.created_at,
        href: '/notifications',
        tone: 'cyan',
      })
    })

    jobs.slice(0, 6).forEach((job) => {
      items.push({
        id: `job-${job.id}`,
        label: 'Job activity',
        detail: `${job.title || 'Untitled job'} · ${cleanStatus(job.status)}`,
        createdAt: job.created_at,
        href: `/my-jobs/${job.id}/applicants`,
        tone: job.status === 'completed' ? 'emerald' : 'blue',
      })
    })

    return items
      .sort((a, b) => {
        const aDate = new Date(a.createdAt || '').getTime()
        const bDate = new Date(b.createdAt || '').getTime()
        return bDate - aDate
      })
      .slice(0, 8)
  }, [applications, jobs, notifications])

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
        payout_status,
        is_featured,
        featured_until,
        created_at,
        assigned_worker_id
      `)
      .eq('company_id', user.id)
      .order('created_at', { ascending: false })

    if (jobsError) {
      setMessage(jobsError.message)
      setLoading(false)
      return
    }

    const loadedJobs = (jobData || []) as Job[]
    const jobIds = loadedJobs.map((job) => job.id)

    let applicationData: Application[] = []

    if (jobIds.length > 0) {
      const { data, error: applicationsError } = await supabase
        .from('applications')
        .select('id, status, job_id, created_at, worker_id')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false })

      if (applicationsError) {
        setMessage(applicationsError.message)
        setLoading(false)
        return
      }

      applicationData = (data || []) as Application[]
    }

    const { data: notificationData } = await supabase
      .from('notifications')
      .select('id, title, body, type, created_at, read, is_read')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40)

    const { data: reviewData } = await supabase
      .from('reviews')
      .select('id, rating, created_at')
      .eq('reviewee_id', user.id)
      .order('created_at', { ascending: false })

    const { count: savedCount } = await supabase
      .from('saved_workers')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', user.id)

    setSavedWorkers(savedCount ?? 0)
    setJobs(loadedJobs)
    setApplications(applicationData)
    setNotifications((notificationData || []) as NotificationRow[])
    setReviews((reviewData || []) as ReviewRow[])
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
                  Your command center for jobs, applicants, payments, saved
                  workers, reviews, and hiring activity.
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
                  href="/company/worker-map"
                  className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-6 py-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/20"
                >
                  Find Workers
                </Link>

                <Link
                  href="/messages"
                  className="rounded-2xl border border-white/10 bg-white/10 px-6 py-4 text-sm font-black text-white transition hover:bg-white/20"
                >
                  Messages
                </Link>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <StatCard label="Open Jobs" value={stats.openJobs} />
              <StatCard label="Applicants" value={stats.applications} />
              <StatCard label="Hired" value={stats.hiredWorkers} />
              <StatCard label="Active Jobs" value={stats.activeJobs} />
              <StatCard label="Completed" value={stats.completedJobs} />
              <StatCard label="Saved Workers" value={savedWorkers} />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <MoneyCard label="Paid Out" value={money(stats.totalSpend)} tone="green" />
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

        <section className="grid gap-5 xl:grid-cols-3">
          <ActionCenter
            jobsNeedingPayment={jobsNeedingPayment.length}
            jobsWithApplicants={jobsWithApplicants.length}
            payoutReadyJobs={payoutReadyJobs.length}
            unreadNotifications={stats.unreadNotifications}
          />

          <PipelineCard
            open={stats.openJobs}
            applicants={stats.pendingApplications}
            assigned={stats.assignedJobs}
            inProgress={stats.inProgressJobs}
            completed={stats.completedJobs}
            paid={stats.paidJobs}
          />

          <PerformanceCard
            totalJobs={stats.totalJobs}
            hiredWorkers={stats.hiredWorkers}
            completionRate={stats.completionRate}
            averageRating={stats.averageRating}
            reviewCount={stats.reviewCount}
            featuredJobs={stats.featuredJobs}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-4">
          <QuickActionCard
            href="/post-job"
            title="Post New Job"
            description="Create a new CrewCall job and start receiving applicants."
            tone="orange"
          />

          <QuickActionCard
            href="/company/worker-map"
            title="Find Workers"
            description="Browse skilled tradespeople by trade, location, and experience."
            tone="cyan"
          />

          <QuickActionCard
            href="/saved-workers"
            title="Saved Workers"
            description="Invite favorite workers back to future jobs."
            tone="blue"
          />

          <QuickActionCard
            href="/company/applications"
            title="Review Applicants"
            description="Manage applicants and hire workers from your pipeline."
            tone="emerald"
          />
        </section>

        {loading ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-8 text-lg font-black text-slate-300 backdrop-blur">
            Loading dashboard...
          </div>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/20 backdrop-blur md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-3xl font-black text-white">Recent Jobs</h2>

                  <p className="mt-2 text-sm font-semibold text-slate-400">
                    Your newest postings and applicant activity.
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
                <EmptyJobs />
              ) : (
                <div className="mt-6 grid gap-5">
                  {jobs.slice(0, 6).map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      applicantCount={
                        applications.filter((app) => app.job_id === job.id).length
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <ActivityFeed items={recentActivity} />
              <UpcomingJobs jobs={upcomingJobs} />
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
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

      <p className="mt-3 text-4xl font-black tracking-tight">{value}</p>
    </div>
  )
}

function ActionCenter({
  jobsNeedingPayment,
  jobsWithApplicants,
  payoutReadyJobs,
  unreadNotifications,
}: {
  jobsNeedingPayment: number
  jobsWithApplicants: number
  payoutReadyJobs: number
  unreadNotifications: number
}) {
  const total =
    jobsNeedingPayment + jobsWithApplicants + payoutReadyJobs + unreadNotifications

  return (
    <section className="rounded-[2rem] border border-orange-400/20 bg-orange-400/10 p-6 shadow-2xl shadow-black/20">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-200">
        Action Center
      </p>

      <h2 className="mt-3 text-3xl font-black text-white">
        {total === 0 ? 'All Clear' : `${total} Need Attention`}
      </h2>

      <div className="mt-5 space-y-3">
        <ActionRow href="/my-jobs" label="Jobs waiting for payment" value={jobsNeedingPayment} />
        <ActionRow href="/company/applications" label="Jobs with applicants" value={jobsWithApplicants} />
        <ActionRow href="/my-jobs" label="Payouts ready" value={payoutReadyJobs} />
        <ActionRow href="/notifications" label="Unread notifications" value={unreadNotifications} />
      </div>
    </section>
  )
}

function ActionRow({
  href,
  label,
  value,
}: {
  href: string
  label: string
  value: number
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 transition hover:bg-slate-950/70"
    >
      <span className="text-sm font-bold text-slate-200">{label}</span>
      <span className="rounded-full bg-orange-400 px-3 py-1 text-xs font-black text-slate-950">
        {value}
      </span>
    </Link>
  )
}

function PipelineCard({
  open,
  applicants,
  assigned,
  inProgress,
  completed,
  paid,
}: {
  open: number
  applicants: number
  assigned: number
  inProgress: number
  completed: number
  paid: number
}) {
  return (
    <section className="rounded-[2rem] border border-cyan-400/20 bg-cyan-400/10 p-6 shadow-2xl shadow-black/20">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-200">
        Hiring Pipeline
      </p>

      <div className="mt-5 space-y-3">
        <PipelineRow label="Open" value={open} />
        <PipelineRow label="Applicants" value={applicants} />
        <PipelineRow label="Assigned" value={assigned} />
        <PipelineRow label="In Progress" value={inProgress} />
        <PipelineRow label="Completed" value={completed} />
        <PipelineRow label="Paid" value={paid} />
      </div>
    </section>
  )
}

function PipelineRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
      <span className="text-sm font-bold text-slate-200">{label}</span>
      <span className="text-lg font-black text-cyan-100">{value}</span>
    </div>
  )
}

function PerformanceCard({
  totalJobs,
  hiredWorkers,
  completionRate,
  averageRating,
  reviewCount,
  featuredJobs,
}: {
  totalJobs: number
  hiredWorkers: number
  completionRate: number
  averageRating: number
  reviewCount: number
  featuredJobs: number
}) {
  return (
    <section className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-6 shadow-2xl shadow-black/20">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-200">
        Company Performance
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <PerformanceStat label="Jobs" value={String(totalJobs)} />
        <PerformanceStat label="Workers" value={String(hiredWorkers)} />
        <PerformanceStat label="Complete" value={`${completionRate}%`} />
        <PerformanceStat
          label="Rating"
          value={reviewCount > 0 ? `${averageRating.toFixed(1)}★` : '—'}
        />
        <PerformanceStat label="Reviews" value={String(reviewCount)} />
        <PerformanceStat label="Featured" value={String(featuredJobs)} />
      </div>
    </section>
  )
}

function PerformanceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-white">{value}</p>
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
      <h3 className="text-2xl font-black text-white">{title}</h3>

      <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
        {description}
      </p>
    </Link>
  )
}

function JobCard({
  job,
  applicantCount,
}: {
  job: Job
  applicantCount: number
}) {
  return (
    <Link
      href={`/my-jobs/${job.id}/applicants`}
      className="group rounded-[2rem] border border-white/10 bg-slate-950/40 p-6 transition-all duration-200 hover:-translate-y-1 hover:border-orange-300/40 hover:bg-slate-950/60 hover:shadow-2xl"
    >
      <div className="flex flex-wrap gap-2">
        <Badge value={job.status || 'unknown'} />
        <Badge value={job.payment_status || 'unpaid'} />

        {job.is_featured && <Badge value="featured" />}
      </div>

      <h3 className="mt-5 text-2xl font-black tracking-tight text-white">
        {job.title || 'Untitled Job'}
      </h3>

      <p className="mt-2 text-sm font-semibold text-slate-300">
        {[job.trade, job.location].filter(Boolean).join(' • ') ||
          'No trade/location listed'}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-4">
        <MiniInfo label="Pay" value={job.pay_rate || 'Not listed'} />
        <MiniInfo label="Start" value={formatDate(job.start_date)} />
        <MiniInfo label="Applicants" value={String(applicantCount)} />
        <MiniInfo label="Payout" value={cleanStatus(job.payout_status)} />
      </div>
    </Link>
  )
}

function ActivityFeed({
  items,
}: {
  items: {
    id: string
    label: string
    detail: string
    createdAt: string | null
    href: string
    tone: 'cyan' | 'orange' | 'emerald' | 'blue'
  }[]
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
      <h2 className="text-2xl font-black text-white">Recent Activity</h2>

      {items.length === 0 ? (
        <p className="mt-4 text-sm font-semibold text-slate-400">
          No recent activity yet.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="block rounded-2xl border border-white/10 bg-slate-950/50 p-4 transition hover:bg-slate-950/80"
            >
              <p className="text-sm font-black text-white">{item.label}</p>

              <p className="mt-1 text-sm font-semibold text-slate-400">
                {item.detail}
              </p>

              <p className="mt-2 text-xs font-bold text-cyan-300">
                {formatDate(item.createdAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function UpcomingJobs({ jobs }: { jobs: Job[] }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
      <h2 className="text-2xl font-black text-white">Upcoming Jobs</h2>

      {jobs.length === 0 ? (
        <p className="mt-4 text-sm font-semibold text-slate-400">
          No upcoming start dates.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/my-jobs/${job.id}/applicants`}
              className="block rounded-2xl border border-white/10 bg-slate-950/50 p-4 transition hover:bg-slate-950/80"
            >
              <p className="text-sm font-black text-white">
                {job.title || 'Untitled Job'}
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-400">
                {formatDate(job.start_date)} · {job.location || 'No location'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function EmptyJobs() {
  return (
    <div className="mt-6 rounded-[2rem] border border-white/10 bg-slate-950/40 p-8 md:p-10">
      <h3 className="text-2xl font-black text-white">No jobs posted yet</h3>

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
          href="/company/worker-map"
          className="inline-flex rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-6 py-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/20"
        >
          Browse Workers
        </Link>
      </div>
    </div>
  )
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-sm font-bold text-white">{value}</p>
    </div>
  )
}

function Badge({ value }: { value: string }) {
  const lowered = value.toLowerCase()

  const classes =
    lowered.includes('paid') ||
    lowered.includes('completed') ||
    lowered.includes('featured')
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
      : lowered.includes('pending') ||
          lowered.includes('unpaid') ||
          lowered.includes('open')
        ? 'border-orange-400/30 bg-orange-400/10 text-orange-100'
        : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${classes}`}
    >
      {value.replaceAll('_', ' ')}
    </span>
  )
}