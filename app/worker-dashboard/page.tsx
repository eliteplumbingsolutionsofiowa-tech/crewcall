'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import WorkerLocationPresence from '@/app/components/WorkerLocationPresence'
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
  paid_at: string | null
  company_id: string | null
}

type Stats = {
  assigned: number
  completed: number
  paid: number
  unpaid: number
}

type JobUpdate = {
  status: string
}

type QueryError = {
  message: string
}

type OrderedQuery<T> = {
  order: (
    column: string,
    options?: {
      ascending?: boolean
    }
  ) => Promise<{
    data: T[] | null
    error: QueryError | null
  }>
}

type EqOrderQuery<T> = {
  eq: (column: string, value: string) => OrderedQuery<T>
}

type SelectTable<T> = {
  select: (columns: string) => EqOrderQuery<T>
}

type UpdateEqQuery = {
  eq: (
    column: string,
    value: string
  ) => Promise<{
    data: null
    error: QueryError | null
  }>
}

type UpdateTable<TUpdate> = {
  update: (value: TUpdate) => UpdateEqQuery
}

type NoticeTone = 'error' | 'success' | 'info'

function jobsSelectTable() {
  return supabase.from('jobs') as unknown as SelectTable<Job>
}

function jobsUpdateTable() {
  return supabase.from('jobs') as unknown as UpdateTable<JobUpdate>
}

function normalize(value: string | null) {
  return String(value || '').toLowerCase().trim()
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Not scheduled'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Not scheduled'
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getStatusLabel(status: string) {
  if (status === 'completed') {
    return 'Completed'
  }

  if (status === 'in_progress') {
    return 'In Progress'
  }

  if (status === 'assigned') {
    return 'Assigned'
  }

  return status
    ? status
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : 'Assigned'
}

function getPaymentLabel(status: string) {
  if (status === 'paid') {
    return 'Paid'
  }

  if (status === 'pending') {
    return 'Payment Pending'
  }

  if (status === 'processing') {
    return 'Processing'
  }

  return 'Unpaid'
}

export default function WorkerDashboard() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats>({
    assigned: 0,
    completed: 0,
    paid: 0,
    unpaid: 0,
  })

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [messageTone, setMessageTone] = useState<NoticeTone>('info')

  useEffect(() => {
    void loadJobs()
  }, [])

  const activeJobs = useMemo(
    () =>
      jobs.filter((job) => normalize(job.status) !== 'completed'),
    [jobs]
  )

  const completedJobs = useMemo(
    () =>
      jobs.filter((job) => normalize(job.status) === 'completed'),
    [jobs]
  )

  async function loadJobs(showRefreshState = false) {
    if (showRefreshState) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You need to log in as a worker to view this page.')
      setMessageTone('error')
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data, error } = await jobsSelectTable()
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
        paid_at,
        company_id
      `
      )
      .eq('assigned_worker_id', user.id)
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      setMessage(error.message)
      setMessageTone('error')
      setJobs([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const jobList = (data || []).filter(Boolean)

    setJobs(jobList)

    setStats({
      assigned: jobList.filter(
        (job) => normalize(job.status) !== 'completed'
      ).length,
      completed: jobList.filter(
        (job) => normalize(job.status) === 'completed'
      ).length,
      paid: jobList.filter(
        (job) => normalize(job.payment_status) === 'paid'
      ).length,
      unpaid: jobList.filter(
        (job) => normalize(job.payment_status) !== 'paid'
      ).length,
    })

    if (showRefreshState) {
      setMessage('Dashboard refreshed.')
      setMessageTone('success')
    }

    setLoading(false)
    setRefreshing(false)
  }

  async function markComplete(jobId: string) {
    const confirmed = window.confirm(
      'Mark this job as completed? The company will be notified that the work is finished.'
    )

    if (!confirmed) {
      return
    }

    setBusyJobId(jobId)
    setMessage(null)

    const { error } = await jobsUpdateTable()
      .update({
        status: 'completed',
      })
      .eq('id', jobId)

    if (error) {
      setMessage(error.message)
      setMessageTone('error')
      setBusyJobId(null)
      return
    }

    await loadJobs()

    setMessage('Job marked as completed.')
    setMessageTone('success')
    setBusyJobId(null)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-4">
                <div className="relative flex h-12 w-12 items-center justify-center">
                  <span className="absolute h-full w-full animate-ping rounded-2xl bg-cyan-400/20" />
                  <span className="relative h-12 w-12 animate-pulse rounded-2xl bg-cyan-400/15" />
                </div>

                <div>
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">
                    CrewCall Worker
                  </p>

                  <p className="mt-1 text-lg font-bold text-white">
                    Loading your dashboard...
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-32 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]"
                  />
                ))}
              </div>

              <div className="mt-6 h-64 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8 lg:px-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-48 top-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute -right-48 top-56 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-violet-500/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

          <div className="p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col justify-between gap-7 xl:flex-row xl:items-center">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    Worker Command Center
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs font-bold text-slate-300">
                    {stats.assigned} active{' '}
                    {stats.assigned === 1 ? 'job' : 'jobs'}
                  </span>
                </div>

                <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Worker Dashboard
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Manage assigned work, track completed jobs, monitor payments,
                  and control when companies can see your availability.
                </p>
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[510px]">
                <Link
                  href="/jobs"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-center text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-300"
                >
                  Browse Jobs
                </Link>

                <Link
                  href="/worker/invites"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.065] px-5 py-3 text-center text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/[0.11]"
                >
                  View Invites
                </Link>

                <button
                  type="button"
                  onClick={() => void loadJobs(true)}
                  disabled={refreshing}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 px-5 py-3 text-sm font-black text-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>

            {message ? (
              <Notice tone={messageTone}>{message}</Notice>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStat
            label="Active Jobs"
            value={stats.assigned}
            description="Currently assigned"
            tone="cyan"
            icon="A"
          />

          <DashboardStat
            label="Completed"
            value={stats.completed}
            description="Finished jobs"
            tone="green"
            icon="C"
          />

          <DashboardStat
            label="Paid"
            value={stats.paid}
            description="Payments received"
            tone="blue"
            icon="$"
          />

          <DashboardStat
            label="Awaiting Payment"
            value={stats.unpaid}
            description="Not marked paid"
            tone="amber"
            icon="P"
          />
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:p-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-lg font-black text-cyan-300">
                  L
                </span>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                    Live Availability
                  </p>

                  <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
                    Location and worker presence
                  </h2>
                </div>
              </div>
            </div>

            <p className="max-w-xl text-sm leading-6 text-slate-400">
              Control whether nearby companies can see that you are available
              for work.
            </p>
          </div>

          <div className="p-4 sm:p-6">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70">
              <WorkerLocationPresence />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col justify-between gap-5 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                My Work
              </p>

              <h2 className="mt-2 text-2xl font-black text-white">
                Assigned and completed jobs
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Review details, communicate with companies, update job status,
                and track payments.
              </p>
            </div>

            <Link
              href="/jobs"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-500/15"
            >
              Find More Work
            </Link>
          </div>

          {jobs.length === 0 ? (
            <EmptyJobs />
          ) : (
            <div className="space-y-8 p-4 sm:p-6">
              {activeJobs.length > 0 ? (
                <JobGroup
                  title="Active Jobs"
                  description="Work currently assigned to you"
                  count={activeJobs.length}
                >
                  {activeJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      busy={busyJobId === job.id}
                      onMarkComplete={markComplete}
                    />
                  ))}
                </JobGroup>
              ) : null}

              {completedJobs.length > 0 ? (
                <JobGroup
                  title="Completed Jobs"
                  description="Finished work and payment status"
                  count={completedJobs.length}
                >
                  {completedJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      busy={busyJobId === job.id}
                      onMarkComplete={markComplete}
                    />
                  ))}
                </JobGroup>
              ) : null}
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <QuickLink
            href="/saved-jobs"
            eyebrow="Saved Work"
            title="Saved Jobs"
            description="Return to jobs you saved for later."
            action="View Saved Jobs"
          />

          <QuickLink
            href="/messages"
            eyebrow="Communication"
            title="Messages"
            description="Keep conversations with hiring companies organized."
            action="Open Messages"
          />

          <QuickLink
            href="/profile"
            eyebrow="Worker Profile"
            title="Improve Your Profile"
            description="Keep your skills, credentials, and availability current."
            action="Edit Profile"
          />
        </section>
      </div>
    </main>
  )
}

function JobGroup({
  title,
  description,
  count,
  children,
}: {
  title: string
  description: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h3 className="text-xl font-black text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>

        <span className="w-fit rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs font-black text-slate-300">
          {count} {count === 1 ? 'job' : 'jobs'}
        </span>
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  )
}

function JobCard({
  job,
  busy,
  onMarkComplete,
}: {
  job: Job
  busy: boolean
  onMarkComplete: (jobId: string) => Promise<void>
}) {
  const jobStatus = normalize(job.status)
  const paymentStatus = normalize(job.payment_status)
  const isCompleted = jobStatus === 'completed'
  const isPaid = paymentStatus === 'paid'

  return (
    <article className="group overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 transition hover:border-cyan-400/20 hover:bg-slate-950/75">
      <div
        className={[
          'h-1',
          isCompleted
            ? isPaid
              ? 'bg-emerald-400'
              : 'bg-amber-400'
            : 'bg-cyan-400',
        ].join(' ')}
      />

      <div className="p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <JobStatusBadge status={jobStatus} />
              <PaymentStatusBadge status={paymentStatus} />

              {job.trade ? (
                <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-violet-300">
                  {job.trade}
                </span>
              ) : null}
            </div>

            <h3 className="mt-4 text-2xl font-black leading-tight text-white">
              {job.title || 'Untitled Job'}
            </h3>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoCard
                label="Trade"
                value={job.trade || 'Not provided'}
              />

              <InfoCard
                label="Location"
                value={job.location || 'Not provided'}
              />

              <InfoCard
                label="Pay"
                value={job.pay_rate || 'Not provided'}
              />

              <InfoCard
                label="Start Date"
                value={formatDate(job.start_date)}
              />
            </div>

            {isPaid ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-sm font-black text-emerald-300">
                  ✓
                </span>

                <div>
                  <p className="text-sm font-black text-emerald-200">
                    Payment received
                  </p>

                  <p className="mt-1 text-sm text-emerald-200/70">
                    {job.paid_at
                      ? `Marked paid on ${formatDate(job.paid_at)}.`
                      : 'This job has been marked as paid.'}
                  </p>
                </div>
              </div>
            ) : null}

            {isCompleted && !isPaid ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-sm font-black text-amber-300">
                  !
                </span>

                <div>
                  <p className="text-sm font-black text-amber-200">
                    Waiting for payment
                  </p>

                  <p className="mt-1 text-sm text-amber-200/70">
                    The work is marked complete, but payment has not been
                    recorded yet.
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:w-56 xl:grid-cols-1">
            <Link
              href={`/jobs/${job.id}`}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-center text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/15 transition hover:-translate-y-0.5 hover:bg-cyan-300"
            >
              View Job
            </Link>

            {job.company_id ? (
              <Link
                href={`/messages?start=${job.company_id}`}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.065] px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white/[0.11]"
              >
                Message Company
              </Link>
            ) : null}

            {!isCompleted ? (
              <button
                type="button"
                onClick={() => void onMarkComplete(job.id)}
                disabled={busy}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10 px-5 py-3 text-sm font-black text-amber-200 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Completing...' : 'Mark Complete'}
              </button>
            ) : null}

            {isCompleted && job.company_id ? (
              <Link
                href={`/reviews/new?jobId=${job.id}&revieweeId=${job.company_id}`}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 px-5 py-3 text-center text-sm font-black text-violet-200 transition hover:bg-violet-500/15"
              >
                Leave Review
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}

function DashboardStat({
  label,
  value,
  description,
  tone,
  icon,
}: {
  label: string
  value: number
  description: string
  tone: 'cyan' | 'green' | 'blue' | 'amber'
  icon: string
}) {
  const styles = {
    cyan: {
      border: 'border-cyan-400/20',
      background: 'bg-cyan-500/10',
      text: 'text-cyan-300',
    },
    green: {
      border: 'border-emerald-400/20',
      background: 'bg-emerald-500/10',
      text: 'text-emerald-300',
    },
    blue: {
      border: 'border-blue-400/20',
      background: 'bg-blue-500/10',
      text: 'text-blue-300',
    },
    amber: {
      border: 'border-amber-400/20',
      background: 'bg-amber-500/10',
      text: 'text-amber-300',
    },
  }

  const selected = styles[tone]

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/15 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>

          <p className="mt-3 text-4xl font-black tracking-tight text-white">
            {value}
          </p>

          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>

        <span
          className={[
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-lg font-black',
            selected.border,
            selected.background,
            selected.text,
          ].join(' ')}
        >
          {icon}
        </span>
      </div>
    </div>
  )
}

function InfoCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-bold leading-6 text-white">
        {value}
      </p>
    </div>
  )
}

function JobStatusBadge({ status }: { status: string }) {
  const isCompleted = status === 'completed'
  const isInProgress = status === 'in_progress'

  const classes = isCompleted
    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
    : isInProgress
      ? 'border-blue-400/20 bg-blue-500/10 text-blue-300'
      : 'border-cyan-400/20 bg-cyan-500/10 text-cyan-300'

  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wider',
        classes,
      ].join(' ')}
    >
      <span
        className={[
          'h-2 w-2 rounded-full',
          isCompleted
            ? 'bg-emerald-400'
            : isInProgress
              ? 'bg-blue-400'
              : 'bg-cyan-400',
        ].join(' ')}
      />

      {getStatusLabel(status)}
    </span>
  )
}

function PaymentStatusBadge({ status }: { status: string }) {
  const isPaid = status === 'paid'
  const isPending =
    status === 'pending' || status === 'processing'

  const classes = isPaid
    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
    : isPending
      ? 'border-amber-400/20 bg-amber-500/10 text-amber-300'
      : 'border-white/10 bg-white/[0.055] text-slate-300'

  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wider',
        classes,
      ].join(' ')}
    >
      <span
        className={[
          'h-2 w-2 rounded-full',
          isPaid
            ? 'bg-emerald-400'
            : isPending
              ? 'bg-amber-400'
              : 'bg-slate-400',
        ].join(' ')}
      />

      {getPaymentLabel(status)}
    </span>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: NoticeTone
  children: React.ReactNode
}) {
  const classes = {
    error:
      'border-red-400/20 bg-red-500/10 text-red-200',
    success:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    info:
      'border-blue-400/20 bg-blue-500/10 text-blue-200',
  }

  return (
    <div
      className={[
        'mt-6 rounded-2xl border p-4 text-sm font-bold',
        classes[tone],
      ].join(' ')}
    >
      {children}
    </div>
  )
}

function EmptyJobs() {
  return (
    <div className="p-6 sm:p-10">
      <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/45 px-6 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/20 bg-cyan-500/10 text-2xl font-black text-cyan-300">
          C
        </div>

        <h3 className="mt-6 text-2xl font-black text-white">
          No assigned work yet
        </h3>

        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
          Browse available opportunities and apply for work that matches your
          trade, location, experience, and schedule.
        </p>

        <Link
          href="/jobs"
          className="mt-7 inline-flex min-h-12 items-center justify-center rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-300"
        >
          Browse Available Jobs
        </Link>
      </div>
    </div>
  )
}

function QuickLink({
  href,
  eyebrow,
  title,
  description,
  action,
}: {
  href: string
  eyebrow: string
  title: string
  description: string
  action: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/15 transition hover:-translate-y-1 hover:border-cyan-400/20 hover:bg-white/[0.065]"
    >
      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
        {eyebrow}
      </p>

      <h3 className="mt-3 text-xl font-black text-white">{title}</h3>

      <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">
        {description}
      </p>

      <p className="mt-5 text-sm font-black text-cyan-300 transition group-hover:text-cyan-200">
        {action} →
      </p>
    </Link>
  )
}