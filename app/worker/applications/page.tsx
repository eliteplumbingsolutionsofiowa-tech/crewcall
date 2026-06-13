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

type Application = {
  id: string
  job_id: string
  worker_id: string
  status: string | null
  created_at: string

  job_title: string | null
  job_location: string | null
  pay_rate: string | null
  company_name: string | null

  assigned_worker_id: string | null
}

type StatusFilter =
  | 'all'
  | 'pending'
  | 'accepted'
  | 'rejected'

export default function WorkerApplicationsPage() {
  const router = useRouter()

  const [applications, setApplications] =
    useState<Application[]>([])

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [message, setMessage] =
    useState<string | null>(null)

  const [search, setSearch] =
    useState('')

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('all')

  const loadApplications =
    useCallback(async () => {
      setRefreshing(true)
      setMessage(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: apps, error } =
        await supabase
          .from('applications')
          .select(`
          id,
          job_id,
          worker_id,
          status,
          created_at,
          jobs (
            id,
            title,
            location,
            pay_rate,
            assigned_worker_id,
            profiles (
              company_name
            )
          )
        `)
          .eq('worker_id', user.id)
          .order('created_at', {
            ascending: false,
          })

      if (error) {
        setMessage(error.message)
        setApplications([])
        setLoading(false)
        setRefreshing(false)
        return
      }

      const formatted: Application[] =
        (apps || []).map((app: any) => ({
          id: app.id,
          job_id: app.job_id,
          worker_id: app.worker_id,
          status:
            app.status || 'pending',
          created_at: app.created_at,

          job_title:
            app.jobs?.title ||
            'Untitled Job',

          job_location:
            app.jobs?.location ||
            'Location not listed',

          pay_rate:
            app.jobs?.pay_rate ||
            'Pay not listed',

          company_name:
            app.jobs?.profiles
              ?.company_name ||
            'Company',

          assigned_worker_id:
            app.jobs
              ?.assigned_worker_id ||
            null,
        }))

      setApplications(formatted)

      setLoading(false)
      setRefreshing(false)

      window.dispatchEvent(
        new Event(
          'crewcall-refresh-nav'
        )
      )
    }, [router])

  useEffect(() => {
    loadApplications()

    const refresh = () => {
      loadApplications()
    }

    window.addEventListener(
      'focus',
      refresh
    )

    window.addEventListener(
      'pageshow',
      refresh
    )

    const visibility = () => {
      if (
        document.visibilityState ===
        'visible'
      ) {
        refresh()
      }
    }

    document.addEventListener(
      'visibilitychange',
      visibility
    )

    const channel = supabase
      .channel(
        'worker-applications-live-upgraded'
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
        visibility
      )

      supabase.removeChannel(channel)
    }
  }, [loadApplications])

  const filteredApplications =
    useMemo(() => {
      const term = search
        .trim()
        .toLowerCase()

      return applications.filter(
        (app) => {
          const matchesStatus =
            statusFilter === 'all'
              ? true
              : app.status ===
                statusFilter

          const haystack = [
            app.job_title,
            app.job_location,
            app.company_name,
            app.status,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

          const matchesSearch =
            !term ||
            haystack.includes(term)

          return (
            matchesStatus &&
            matchesSearch
          )
        }
      )
    }, [
      applications,
      search,
      statusFilter,
    ])

  const counts = useMemo(() => {
    return {
      all: applications.length,

      pending:
        applications.filter(
          (a) =>
            a.status ===
            'pending'
        ).length,

      accepted:
        applications.filter(
          (a) =>
            a.status ===
            'accepted'
        ).length,

      rejected:
        applications.filter(
          (a) =>
            a.status ===
            'rejected'
        ).length,
    }
  }, [applications])

  function badgeClass(
    status: string | null
  ) {
    if (status === 'accepted') {
      return 'border-emerald-300/20 bg-emerald-400/15 text-emerald-100'
    }

    if (status === 'rejected') {
      return 'border-red-300/20 bg-red-400/15 text-red-100'
    }

    return 'border-yellow-300/20 bg-yellow-400/15 text-yellow-100'
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black">
            Loading applications...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  Worker Dashboard
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  My Applications
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Track every CrewCall
                  application in realtime
                  and monitor hiring
                  progress.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <StatCard
                  label="All"
                  value={counts.all}
                />

                <StatCard
                  label="Pending"
                  value={
                    counts.pending
                  }
                />

                <StatCard
                  label="Accepted"
                  value={
                    counts.accepted
                  }
                />

                <StatCard
                  label="Rejected"
                  value={
                    counts.rejected
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6 md:p-8">
            {message && (
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-sm font-bold text-cyan-100">
                {message}
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <div className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                    Search
                  </label>

                  <input
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                    placeholder="Search jobs, companies..."
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                    Status
                  </label>

                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(
                        e.target
                          .value as StatusFilter
                      )
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
                  >
                    <option value="all">
                      All
                    </option>

                    <option value="pending">
                      Pending
                    </option>

                    <option value="accepted">
                      Accepted
                    </option>

                    <option value="rejected">
                      Rejected
                    </option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={
                    loadApplications
                  }
                  className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                >
                  {refreshing
                    ? 'Refreshing...'
                    : 'Refresh'}
                </button>
              </div>
            </div>

            {filteredApplications.length ===
            0 ? (
              <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-8 text-center">
                <p className="text-xl font-black text-white">
                  No applications found.
                </p>

                <p className="mt-2 text-sm font-bold text-slate-400">
                  Apply to jobs and they
                  will appear here.
                </p>

                <div className="mt-5">
                  <Link
                    href="/jobs"
                    className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20"
                  >
                    Browse Jobs
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredApplications.map(
                  (app) => {
                    const hired =
                      app.assigned_worker_id ===
                        app.worker_id &&
                      app.status ===
                        'accepted'

                    return (
                      <article
                        key={app.id}
                        className={`rounded-[2rem] border p-5 shadow-xl transition ${
                          hired
                            ? 'border-emerald-400/20 bg-emerald-400/10'
                            : 'border-white/10 bg-slate-950/60 hover:border-cyan-400/20'
                        }`}
                      >
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/jobs/${app.job_id}`}
                                className="text-2xl font-black text-white hover:text-cyan-300"
                              >
                                {
                                  app.job_title
                                }
                              </Link>

                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${badgeClass(
                                  app.status
                                )}`}
                              >
                                {
                                  app.status
                                }
                              </span>

                              {hired && (
                                <span className="rounded-full border border-emerald-300/20 bg-emerald-400/20 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-100">
                                  Hired
                                </span>
                              )}
                            </div>

                            <p className="mt-2 text-sm font-bold text-slate-300">
                              {
                                app.company_name
                              }
                            </p>

                            <p className="mt-2 text-sm font-bold text-slate-400">
                              {
                                app.job_location
                              }
                            </p>

                            <p className="mt-3 text-lg font-black text-emerald-300">
                              {
                                app.pay_rate
                              }
                            </p>

                            <p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-500">
                              Applied{' '}
                              {new Date(
                                app.created_at
                              ).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-3 lg:justify-end">
                            <Link
                              href={`/jobs/${app.job_id}`}
                              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                            >
                              View Job
                            </Link>

                            <Link
                              href={`/messages?jobId=${app.job_id}`}
                              className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-400"
                            >
                              Message
                            </Link>
                          </div>
                        </div>
                      </article>
                    )
                  }
                )}
              </div>
            )}
          </div>
        </section>
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
    <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 text-center">
      <p className="text-3xl font-black text-cyan-100">
        {value}
      </p>

      <p className="text-xs font-black uppercase tracking-wide text-cyan-300">
        {label}
      </p>
    </div>
  )
}