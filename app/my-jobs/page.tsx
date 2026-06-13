'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useRouter } from 'next/navigation'
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
  company_id: string
  assigned_worker_id: string | null
  created_at: string
  applicant_count: number
}

type Filter =
  | 'all'
  | 'open'
  | 'assigned'
  | 'completed'
  | 'paid'

function formatDate(value: string | null) {
  if (!value) return 'Not set'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Not set'
  }

  return date.toLocaleDateString()
}

function statusClasses(status: string | null) {
  const value = status || 'open'

  if (value === 'completed') {
    return 'border-emerald-300/20 bg-emerald-400/15 text-emerald-100'
  }

  if (value === 'assigned') {
    return 'border-cyan-300/20 bg-cyan-400/15 text-cyan-100'
  }

  if (value === 'cancelled') {
    return 'border-red-300/20 bg-red-400/15 text-red-100'
  }

  return 'border-yellow-300/20 bg-yellow-400/15 text-yellow-100'
}

function paymentClasses(status: string | null) {
  const value = status || 'unpaid'

  if (value === 'paid') {
    return 'border-emerald-300/20 bg-emerald-400/15 text-emerald-100'
  }

  if (value === 'pending') {
    return 'border-orange-300/20 bg-orange-400/15 text-orange-100'
  }

  return 'border-slate-300/20 bg-slate-400/10 text-slate-200'
}

export default function MyJobsPage() {
  const router = useRouter()

  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filter, setFilter] =
    useState<Filter>('all')

  const loadJobs = useCallback(async () => {
    setRefreshing(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.push('/login')
      return
    }

    const {
      data: jobsData,
      error: jobsError,
    } = await supabase
      .from('jobs')
      .select(
        `
        id,
        title,
        description,
        trade,
        location,
        pay_rate,
        start_date,
        status,
        payment_status,
        company_id,
        assigned_worker_id,
        created_at
      `
      )
      .eq('company_id', user.id)
      .order('created_at', {
        ascending: false,
      })

    if (jobsError) {
      setMessage(jobsError.message)
      setJobs([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const cleanJobs = (
      jobsData || []
    ) as Omit<Job, 'applicant_count'>[]

    const jobIds = cleanJobs.map(
      (job) => job.id
    )

    let countMap = new Map<
      string,
      number
    >()

    if (jobIds.length > 0) {
      const {
        data: applicationsData,
      } = await supabase
        .from('applications')
        .select('id, job_id')
        .in('job_id', jobIds)

      ;(
        applicationsData || []
      ).forEach((app: any) => {
        countMap.set(
          app.job_id,
          (countMap.get(app.job_id) ||
            0) + 1
        )
      })
    }

    const mergedJobs: Job[] =
      cleanJobs.map((job) => ({
        ...job,
        applicant_count:
          countMap.get(job.id) || 0,
      }))

    setJobs(mergedJobs)

    setLoading(false)
    setRefreshing(false)

    window.dispatchEvent(
      new Event('crewcall-refresh-nav')
    )
  }, [router])

  useEffect(() => {
    let mounted = true

    async function boot() {
      if (!mounted) return
      await loadJobs()
    }

    boot()

    const refresh = async () => {
      if (!mounted) return

      await loadJobs()

      window.dispatchEvent(
        new Event('crewcall-refresh-nav')
      )
    }

    window.addEventListener(
      'focus',
      refresh
    )

    window.addEventListener(
      'pageshow',
      refresh
    )

    const handleVisibility = () => {
      if (
        document.visibilityState ===
        'visible'
      ) {
        refresh()
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibility
    )

    const jobsChannel = supabase
      .channel('my-jobs-live-sync-upgraded')
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

    const applicationsChannel =
      supabase
        .channel(
          'my-jobs-applications-sync-upgraded'
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'applications',
          },
          refresh
        )
        .subscribe()

    return () => {
      mounted = false

      window.removeEventListener(
        'focus',
        refresh
      )

      window.removeEventListener(
        'pageshow',
        refresh
      )

      document.removeEventListener(
        'visibilitychange',
        handleVisibility
      )

      supabase.removeChannel(
        jobsChannel
      )

      supabase.removeChannel(
        applicationsChannel
      )
    }
  }, [loadJobs])

  const dedupedJobs = useMemo(() => {
    const seen = new Set<string>()

    return jobs.filter((job) => {
      if (seen.has(job.id)) {
        return false
      }

      seen.add(job.id)

      return true
    })
  }, [jobs])

  const filteredJobs = useMemo(() => {
    const term = search
      .trim()
      .toLowerCase()

    return dedupedJobs.filter((job) => {
      const matchesFilter =
        filter === 'all' ||
        job.status === filter ||
        (filter === 'paid' &&
          job.payment_status ===
            'paid')

      const haystack = [
        job.title,
        job.description,
        job.trade,
        job.location,
        job.pay_rate,
        job.status,
        job.payment_status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch =
        !term ||
        haystack.includes(term)

      return (
        matchesFilter &&
        matchesSearch
      )
    })
  }, [
    dedupedJobs,
    filter,
    search,
  ])

  const stats = useMemo(() => {
    return {
      total: dedupedJobs.length,

      open: dedupedJobs.filter(
        (job) =>
          job.status === 'open'
      ).length,

      assigned: dedupedJobs.filter(
        (job) =>
          job.status === 'assigned'
      ).length,

      completed:
        dedupedJobs.filter(
          (job) =>
            job.status ===
            'completed'
        ).length,

      paid: dedupedJobs.filter(
        (job) =>
          job.payment_status ===
          'paid'
      ).length,
    }
  }, [dedupedJobs])

  function clearFilters() {
    setSearch('')
    setFilter('all')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black">
            Loading your jobs...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/10 p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  Company Dashboard
                </p>

                <h1 className="mt-3 text-5xl font-black tracking-tight text-white">
                  My Jobs
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Manage active jobs,
                  applicants, hires,
                  payments, completed work,
                  and worker communication.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/completed-jobs"
                  className="rounded-2xl border border-white/10 bg-white/10 px-6 py-4 text-sm font-black text-white transition hover:bg-white/20"
                >
                  Completed Jobs
                </Link>

                <Link
                  href="/post-job"
                  className="rounded-2xl bg-cyan-400 px-6 py-4 text-sm font-black text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-[1.02] hover:bg-cyan-300"
                >
                  Post New Job
                </Link>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard
                label="Total"
                value={String(stats.total)}
              />

              <StatCard
                label="Open"
                value={String(stats.open)}
              />

              <StatCard
                label="Assigned"
                value={String(
                  stats.assigned
                )}
              />

              <StatCard
                label="Completed"
                value={String(
                  stats.completed
                )}
              />

              <StatCard
                label="Paid"
                value={String(stats.paid)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_auto_auto] lg:items-end">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                Search Jobs
              </label>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search title, trade, location..."
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                Filter
              </label>

              <select
                value={filter}
                onChange={(event) =>
                  setFilter(
                    event.target
                      .value as Filter
                  )
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none"
              >
                <option value="all">
                  All
                </option>

                <option value="open">
                  Open
                </option>

                <option value="assigned">
                  Assigned
                </option>

                <option value="completed">
                  Completed
                </option>

                <option value="paid">
                  Paid
                </option>
              </select>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={loadJobs}
              className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-[1.02] hover:bg-cyan-300"
            >
              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        )}

        {filteredJobs.length === 0 && (
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-10 text-center shadow-2xl backdrop-blur">
            <h2 className="text-3xl font-black text-white">
              No jobs found
            </h2>

            <p className="mt-3 text-slate-300">
              Post your first job to
              start finding workers.
            </p>

            <Link
              href="/post-job"
              className="mt-6 inline-flex rounded-2xl bg-cyan-400 px-6 py-4 text-sm font-black text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-[1.02] hover:bg-cyan-300"
            >
              Post a Job
            </Link>
          </div>
        )}

        <div className="grid gap-5">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="group rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:border-cyan-300/20"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black text-white">
                        {job.title ||
                          'Untitled Job'}
                      </h2>

                      <Badge
                        value={
                          job.status ||
                          'open'
                        }
                        payment={false}
                      />

                      <Badge
                        value={
                          job.payment_status ||
                          'unpaid'
                        }
                        payment
                      />
                    </div>

                    <p className="mt-2 text-sm font-semibold text-slate-400">
                      {job.trade ||
                        'Trade not set'}{' '}
                      •{' '}
                      {job.location ||
                        'Location not set'}
                    </p>
                  </div>

                  {job.description && (
                    <p className="max-w-3xl text-sm leading-6 text-slate-300">
                      {job.description}
                    </p>
                  )}

                  <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                    <Info
                      label="Pay"
                      value={
                        job.pay_rate ||
                        'Not set'
                      }
                    />

                    <Info
                      label="Start"
                      value={formatDate(
                        job.start_date
                      )}
                    />

                    <Info
                      label="Applicants"
                      value={String(
                        job.applicant_count
                      )}
                    />

                    <Info
                      label="Posted"
                      value={formatDate(
                        job.created_at
                      )}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 lg:w-[260px] lg:flex-col">
                  {job.status !==
                    'completed' && (
                    <Link
                      href={`/my-jobs/${job.id}/applicants`}
                      className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white/20"
                    >
                      View Applicants
                    </Link>
                  )}

                  <Link
                    href={`/jobs/${job.id}`}
                    className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white/20"
                  >
                    View Job
                  </Link>

                  {job.status ===
                    'assigned' && (
                    <Link
                      href={`/jobs/${job.id}/pay`}
                      className="rounded-2xl bg-green-600 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-green-500"
                    >
                      Pay Worker
                    </Link>
                  )}

                  {job.status ===
                    'completed' && (
                    <>
                      <Link
                        href="/completed-jobs"
                        className="rounded-2xl bg-purple-600 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-purple-500"
                      >
                        View Completed
                      </Link>

                      <Link
                        href={`/jobs/${job.id}/review`}
                        className="rounded-2xl bg-orange-500 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-orange-400"
                      >
                        Leave Review
                      </Link>
                    </>
                  )}

                  {job.assigned_worker_id && (
                    <Link
                      href={`/messages?workerId=${job.assigned_worker_id}&jobId=${job.id}`}
                      className="rounded-2xl bg-blue-500 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-blue-400"
                    >
                      Message Worker
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-3 text-4xl font-black tracking-tight text-white">
        {value}
      </p>
    </div>
  )
}

function Badge({
  value,
  payment,
}: {
  value: string
  payment?: boolean
}) {
  const classes = payment
    ? paymentClasses(value)
    : statusClasses(value)

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${classes}`}
    >
      {value.replaceAll('_', ' ')}
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

      <p className="mt-2 text-sm font-bold text-white">
        {value}
      </p>
    </div>
  )
}