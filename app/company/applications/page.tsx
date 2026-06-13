'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  worker_name: string | null
  worker_rating: number
  review_count: number
}

type StatusFilter = 'all' | 'pending' | 'accepted' | 'rejected'

type JobRow = {
  id: string
  title: string | null
  location: string | null
}

type RawApplicationRow = {
  id: string
  job_id: string
  worker_id: string
  status: string | null
  created_at: string
}

type ProfileRow = {
  id: string
  full_name: string | null
}

type ReviewRow = {
  reviewee_id: string
  rating: number | null
}

export default function CompanyApplicationsPage() {
  const router = useRouter()

  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const loadApplications = useCallback(async () => {
    setLoading((current) => current || applications.length === 0)
    setRefreshing(true)
    setMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { data: jobsData, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title, location')
      .eq('company_id', user.id)

    if (jobsError) {
      setMessage(jobsError.message)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const jobs = (jobsData as JobRow[]) || []

    if (jobs.length === 0) {
      setApplications([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const jobMap = new Map(
      jobs.map((job) => [
        job.id,
        {
          title: job.title,
          location: job.location,
        },
      ])
    )

    const jobIds = jobs.map((job) => job.id)

    const { data: appsData, error: appsError } = await supabase
      .from('applications')
      .select('id, job_id, worker_id, status, created_at')
      .in('job_id', jobIds)
      .order('created_at', { ascending: false })

    if (appsError) {
      setMessage(appsError.message)
      setApplications([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const rawApps = (appsData as RawApplicationRow[]) || []

    const workerIds = Array.from(
      new Set(rawApps.map((app) => app.worker_id).filter(Boolean))
    )

    let profileMap = new Map<string, ProfileRow>()
    let reviewsByWorker = new Map<string, ReviewRow[]>()

    if (workerIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', workerIds)

      const profiles = (profilesData as ProfileRow[]) || []
      profileMap = new Map(profiles.map((profile) => [profile.id, profile]))

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('reviewee_id, rating')
        .in('reviewee_id', workerIds)

      const reviews = (reviewsData as ReviewRow[]) || []

      reviewsByWorker = reviews.reduce((map, review) => {
        if (!review.reviewee_id) return map

        const existing = map.get(review.reviewee_id) || []
        map.set(review.reviewee_id, [...existing, review])

        return map
      }, new Map<string, ReviewRow[]>())
    }

    const merged: Application[] = rawApps.map((app) => {
      const job = jobMap.get(app.job_id)
      const worker = profileMap.get(app.worker_id)
      const reviews = reviewsByWorker.get(app.worker_id) || []

      const total = reviews.reduce(
        (sum, review) => sum + Number(review.rating || 0),
        0
      )

      const avg = reviews.length ? total / reviews.length : 0

      return {
        id: app.id,
        job_id: app.job_id,
        worker_id: app.worker_id,
        status: app.status || 'pending',
        created_at: app.created_at,
        job_title: job?.title || 'Untitled Job',
        job_location: job?.location || 'Location not set',
        worker_name: worker?.full_name || 'Worker',
        worker_rating: Number(avg.toFixed(1)),
        review_count: reviews.length,
      }
    })

    setApplications(merged)
    setLoading(false)
    setRefreshing(false)

    window.dispatchEvent(new Event('crewcall-refresh-nav'))
  }, [applications.length, router])

  useEffect(() => {
    void loadApplications()

    const refresh = () => {
      void loadApplications()
    }

    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    document.addEventListener('visibilitychange', handleVisibility)

    const applicationsChannel = supabase
      .channel('company-applications-live-v2')
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

    const jobsChannel = supabase
      .channel('company-applications-jobs-live-v2')
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
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(applicationsChannel)
      supabase.removeChannel(jobsChannel)
    }
  }, [loadApplications])

  const filteredApplications = useMemo(() => {
    const term = search.trim().toLowerCase()

    return applications.filter((app) => {
      const matchesStatus = statusFilter === 'all' || app.status === statusFilter

      const haystack = [
        app.job_title,
        app.job_location,
        app.worker_name,
        app.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return matchesStatus && (!term || haystack.includes(term))
    })
  }, [applications, search, statusFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, Application[]>()

    for (const app of filteredApplications) {
      if (!map.has(app.job_id)) map.set(app.job_id, [])
      map.get(app.job_id)!.push(app)
    }

    return Array.from(map.entries())
  }, [filteredApplications])

  const counts = useMemo(() => {
    return {
      all: applications.length,
      pending: applications.filter((app) => app.status === 'pending').length,
      accepted: applications.filter((app) => app.status === 'accepted').length,
      rejected: applications.filter((app) => app.status === 'rejected').length,
    }
  }, [applications])

  async function hire(app: Application) {
    setActionLoading(app.id)
    setMessage(null)
    setSuccessMessage(null)

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        status: 'assigned',
        assigned_worker_id: app.worker_id,
      })
      .eq('id', app.job_id)

    if (jobError) {
      setMessage(jobError.message)
      setActionLoading(null)
      return
    }

    await supabase
      .from('applications')
      .update({ status: 'accepted' })
      .eq('id', app.id)

    await supabase
      .from('applications')
      .update({ status: 'rejected' })
      .eq('job_id', app.job_id)
      .neq('id', app.id)

    await supabase.from('notifications').insert({
      user_id: app.worker_id,
      type: 'application',
      title: 'You were hired',
      body: `You were hired for ${app.job_title || 'a job'}.`,
      link_url: `/jobs/${app.job_id}`,
      is_read: false,
      read: false,
    })

    setSuccessMessage(`${app.worker_name || 'Worker'} hired successfully.`)
    setActionLoading(null)

    await loadApplications()
  }

  async function reject(app: Application) {
    setActionLoading(app.id)
    setMessage(null)
    setSuccessMessage(null)

    const { error } = await supabase
      .from('applications')
      .update({
        status: 'rejected',
      })
      .eq('id', app.id)

    if (error) {
      setMessage(error.message)
      setActionLoading(null)
      return
    }

    await supabase.from('notifications').insert({
      user_id: app.worker_id,
      type: 'application',
      title: 'Application update',
      body: `Your application for ${app.job_title || 'a job'} was not selected.`,
      link_url: `/jobs/${app.job_id}`,
      is_read: false,
      read: false,
    })

    setSuccessMessage(`${app.worker_name || 'Worker'} rejected.`)
    setActionLoading(null)

    await loadApplications()
  }

  function badgeClass(status: string | null) {
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
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black">Loading applications...</p>
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
                  Company Hiring
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Applications
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Review applicants, hire workers, message candidates, and manage
                  your live hiring pipeline.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <StatCard label="All" value={counts.all} />
                <StatCard label="Pending" value={counts.pending} />
                <StatCard label="Accepted" value={counts.accepted} />
                <StatCard label="Rejected" value={counts.rejected} />
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6 md:p-8">
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

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <div className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                    Search
                  </label>

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Worker, job, location..."
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                    Status
                  </label>

                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as StatusFilter)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => void loadApplications()}
                  className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                >
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>

            {grouped.length === 0 ? (
              <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-8 text-center">
                <p className="text-xl font-black text-white">
                  No applications found.
                </p>

                <p className="mt-2 text-sm font-bold text-slate-400">
                  Applications will appear here when workers apply to your jobs.
                </p>

                <div className="mt-5">
                  <Link
                    href="/post-job"
                    className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20"
                  >
                    Post a Job
                  </Link>
                </div>
              </div>
            ) : (
              grouped.map(([jobId, apps]) => (
                <section key={jobId} className="space-y-4">
                  <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-2xl font-black text-white">
                          {apps[0].job_title}
                        </h2>

                        <p className="mt-1 text-sm font-bold text-slate-400">
                          {apps[0].job_location}
                        </p>
                      </div>

                      <Link
                        href={`/jobs/${jobId}`}
                        className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                      >
                        View Job
                      </Link>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {apps.map((app) => (
                      <article
                        key={app.id}
                        className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-5 shadow-xl transition hover:border-cyan-400/20"
                      >
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/profile?user=${app.worker_id}`}
                                className="text-2xl font-black text-white hover:text-cyan-300"
                              >
                                {app.worker_name || 'Worker Profile'}
                              </Link>

                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${badgeClass(
                                  app.status
                                )}`}
                              >
                                {app.status || 'pending'}
                              </span>
                            </div>

                            <p className="mt-2 text-sm font-bold text-slate-300">
                              ⭐ {app.worker_rating || '0.0'} ({app.review_count}{' '}
                              reviews)
                            </p>

                            <p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-500">
                              Applied{' '}
                              {new Date(app.created_at).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <Link
                              href={`/profile?user=${app.worker_id}`}
                              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                            >
                              View Profile
                            </Link>

                            <Link
                              href={`/messages?user=${app.worker_id}`}
                              className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-400"
                            >
                              Message
                            </Link>

                            {app.status !== 'accepted' && (
                              <button
                                type="button"
                                onClick={() => void hire(app)}
                                disabled={actionLoading === app.id}
                                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-400 disabled:opacity-60"
                              >
                                {actionLoading === app.id ? 'Hiring...' : 'Hire'}
                              </button>
                            )}

                            {app.status !== 'rejected' &&
                              app.status !== 'accepted' && (
                                <button
                                  type="button"
                                  onClick={() => void reject(app)}
                                  disabled={actionLoading === app.id}
                                  className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-black text-white transition hover:bg-red-400 disabled:opacity-60"
                                >
                                  {actionLoading === app.id
                                    ? 'Rejecting...'
                                    : 'Reject'}
                                </button>
                              )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 text-center">
      <p className="text-3xl font-black text-cyan-100">{value}</p>

      <p className="text-xs font-black uppercase tracking-wide text-cyan-300">
        {label}
      </p>
    </div>
  )
}