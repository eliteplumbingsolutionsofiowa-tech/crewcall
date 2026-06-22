'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type AdminProfile = {
  id: string
  is_admin: boolean | null
}

type ProfileRow = {
  id: string
  role: 'company' | 'worker' | null
  trade: string | null
  city: string | null
  state: string | null
  created_at: string | null
  is_online: boolean | null
  last_seen: string | null
}

type JobRow = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  status: string | null
  payment_status: string | null
  payout_status: string | null
  created_at: string | null
}

type ApplicationRow = {
  id: string
  status: string | null
  created_at: string | null
}

type MessageRow = {
  id: string
  created_at: string | null
}

type ReviewRow = {
  id: string
  rating: number | null
  created_at: string | null
}

type InviteRow = {
  id: string
  status: string | null
  created_at: string | null
}

type AnalyticsState = {
  profiles: ProfileRow[]
  jobs: JobRow[]
  applications: ApplicationRow[]
  messages: MessageRow[]
  reviews: ReviewRow[]
  invites: InviteRow[]
}

const emptyAnalytics: AnalyticsState = {
  profiles: [],
  jobs: [],
  applications: [],
  messages: [],
  reviews: [],
  invites: [],
}

export default function AdminAnalyticsPage() {
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsState>(emptyAnalytics)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState('')

  const loadAnalytics = useCallback(async () => {
    setRefreshing(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to access analytics.')
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

    const [
      profilesResult,
      jobsResult,
      applicationsResult,
      messagesResult,
      reviewsResult,
      invitesResult,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, role, trade, city, state, created_at, is_online, last_seen')
        .returns<ProfileRow[]>(),
      supabase
        .from('jobs')
        .select(
          'id, title, trade, location, status, payment_status, payout_status, created_at'
        )
        .returns<JobRow[]>(),
      supabase
        .from('applications')
        .select('id, status, created_at')
        .returns<ApplicationRow[]>(),
      supabase.from('messages').select('id, created_at').returns<MessageRow[]>(),
      supabase.from('reviews').select('id, rating, created_at').returns<ReviewRow[]>(),
      supabase
        .from('job_invites')
        .select('id, status, created_at')
        .returns<InviteRow[]>(),
    ])

    setAnalytics({
      profiles: profilesResult.error ? [] : profilesResult.data ?? [],
      jobs: jobsResult.error ? [] : jobsResult.data ?? [],
      applications: applicationsResult.error
        ? []
        : applicationsResult.data ?? [],
      messages: messagesResult.error ? [] : messagesResult.data ?? [],
      reviews: reviewsResult.error ? [] : reviewsResult.data ?? [],
      invites: invitesResult.error ? [] : invitesResult.data ?? [],
    })

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void loadAnalytics()
  }, [loadAnalytics])

  const metrics = useMemo(() => {
    const profiles = analytics.profiles
    const jobs = analytics.jobs
    const applications = analytics.applications
    const messages = analytics.messages
    const reviews = analytics.reviews
    const invites = analytics.invites

    const companies = profiles.filter((profile) => profile.role === 'company')
    const workers = profiles.filter((profile) => profile.role === 'worker')
    const paidJobs = jobs.filter((job) => job.payment_status === 'paid')
    const completedJobs = jobs.filter((job) => job.status === 'completed')
    const openJobs = jobs.filter((job) => !job.status || job.status === 'open')
    const acceptedInvites = invites.filter((invite) => invite.status === 'accepted')
    const hiredApplications = applications.filter(
      (application) => application.status === 'hired'
    )

    const averageRating =
      reviews.length === 0
        ? 0
        : reviews.reduce((sum, review) => sum + (review.rating ?? 0), 0) /
          reviews.length

    return {
      totalUsers: profiles.length,
      companies: companies.length,
      workers: workers.length,
      onlineUsers: profiles.filter((profile) => isActuallyOnline(profile)).length,
      totalJobs: jobs.length,
      openJobs: openJobs.length,
      completedJobs: completedJobs.length,
      paidJobs: paidJobs.length,
      applications: applications.length,
      hiredApplications: hiredApplications.length,
      invites: invites.length,
      acceptedInvites: acceptedInvites.length,
      messages: messages.length,
      reviews: reviews.length,
      averageRating,
      todayUsers: countSince(profiles, 1),
      weekUsers: countSince(profiles, 7),
      monthUsers: countSince(profiles, 30),
      todayJobs: countSince(jobs, 1),
      weekJobs: countSince(jobs, 7),
      monthJobs: countSince(jobs, 30),
      todayApplications: countSince(applications, 1),
      weekApplications: countSince(applications, 7),
      monthApplications: countSince(applications, 30),
      todayMessages: countSince(messages, 1),
      weekMessages: countSince(messages, 7),
      monthMessages: countSince(messages, 30),
    }
  }, [analytics])

  const topTrades = useMemo(() => {
    return topValues(
      [
        ...analytics.jobs.map((job) => job.trade),
        ...analytics.profiles.map((profile) => profile.trade),
      ],
      8
    )
  }, [analytics.jobs, analytics.profiles])

  const topLocations = useMemo(() => {
    return topValues(
      [
        ...analytics.jobs.map((job) => job.location),
        ...analytics.profiles.map((profile) =>
          [profile.city, profile.state].filter(Boolean).join(', ')
        ),
      ],
      8
    )
  }, [analytics.jobs, analytics.profiles])

  const funnel = useMemo(
    () => [
      {
        label: 'Jobs Posted',
        value: metrics.totalJobs,
      },
      {
        label: 'Applications',
        value: metrics.applications,
      },
      {
        label: 'Hired Applications',
        value: metrics.hiredApplications,
      },
      {
        label: 'Completed Jobs',
        value: metrics.completedJobs,
      },
      {
        label: 'Paid Jobs',
        value: metrics.paidJobs,
      },
    ],
    [metrics]
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl shadow-black/20 backdrop-blur">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            CrewCall Admin
          </p>

          <h1 className="mt-3 text-3xl font-black">Loading analytics...</h1>
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
          <div className="bg-gradient-to-r from-purple-500/15 via-blue-500/10 to-cyan-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <Link
                  href="/admin"
                  className="text-sm font-black text-cyan-300 hover:text-cyan-200"
                >
                  ← Back to Admin
                </Link>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.3em] text-purple-300">
                  CrewCall Admin
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Analytics
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Track user growth, job activity, hiring conversion, messages,
                  reviews, and the health of the CrewCall marketplace.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadAnalytics()}
                disabled={refreshing}
                className="rounded-2xl bg-purple-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-purple-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? 'Refreshing...' : 'Refresh Analytics'}
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
              <AnalyticsCard label="Total Users" value={metrics.totalUsers} />
              <AnalyticsCard label="Companies" value={metrics.companies} />
              <AnalyticsCard label="Workers" value={metrics.workers} />
              <AnalyticsCard label="Online Users" value={metrics.onlineUsers} />
              <AnalyticsCard label="Total Jobs" value={metrics.totalJobs} />
              <AnalyticsCard label="Open Jobs" value={metrics.openJobs} />
              <AnalyticsCard label="Completed Jobs" value={metrics.completedJobs} />
              <AnalyticsCard label="Paid Jobs" value={metrics.paidJobs} />
              <AnalyticsCard label="Applications" value={metrics.applications} />
              <AnalyticsCard label="Invites" value={metrics.invites} />
              <AnalyticsCard label="Messages" value={metrics.messages} />
              <AnalyticsCard
                label="Average Rating"
                value={metrics.averageRating.toFixed(1)}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <PeriodPanel
                title="New Users"
                today={metrics.todayUsers}
                week={metrics.weekUsers}
                month={metrics.monthUsers}
              />
              <PeriodPanel
                title="Jobs Posted"
                today={metrics.todayJobs}
                week={metrics.weekJobs}
                month={metrics.monthJobs}
              />
              <PeriodPanel
                title="Applications"
                today={metrics.todayApplications}
                week={metrics.weekApplications}
                month={metrics.monthApplications}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="Hiring Funnel">
                <div className="space-y-4">
                  {funnel.map((item) => (
                    <FunnelRow
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      max={Math.max(metrics.totalJobs, metrics.applications, 1)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel title="Marketplace Health">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniMetric
                    label="Accepted Invites"
                    value={metrics.acceptedInvites}
                  />
                  <MiniMetric
                    label="Hired Applications"
                    value={metrics.hiredApplications}
                  />
                  <MiniMetric label="Reviews" value={metrics.reviews} />
                  <MiniMetric
                    label="Messages This Week"
                    value={metrics.weekMessages}
                  />
                </div>
              </Panel>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <TopList title="Top Trades" items={topTrades} />
              <TopList title="Top Locations" items={topLocations} />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function AnalyticsCard({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-3 text-4xl font-black text-white">{value}</p>
    </div>
  )
}

function PeriodPanel({
  title,
  today,
  week,
  month,
}: {
  title: string
  today: number
  week: number
  month: number
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
      <h2 className="text-xl font-black text-white">{title}</h2>

      <div className="mt-5 grid gap-3">
        <MiniMetric label="Today" value={today} />
        <MiniMetric label="Last 7 Days" value={week} />
        <MiniMetric label="Last 30 Days" value={month} />
      </div>
    </section>
  )
}

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
      <h2 className="text-xl font-black text-white">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function FunnelRow({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  const percentage = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-white">{label}</p>
        <p className="text-sm font-black text-cyan-300">{value}</p>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-cyan-400"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function TopList({
  title,
  items,
}: {
  title: string
  items: Array<{ label: string; count: number }>
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
      <h2 className="text-xl font-black text-white">{title}</h2>

      {items.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-slate-400">
          No data yet.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <p className="font-black text-white">{item.label}</p>
              <p className="font-black text-cyan-300">{item.count}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function countSince<T extends { created_at: string | null }>(
  rows: T[],
  days: number
) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000

  return rows.filter((row) => {
    if (!row.created_at) return false

    const date = new Date(row.created_at).getTime()

    if (Number.isNaN(date)) return false

    return date >= cutoff
  }).length
}

function topValues(values: Array<string | null>, limit: number) {
  const map = new Map<string, number>()

  for (const rawValue of values) {
    const value = rawValue?.trim()

    if (!value) continue

    map.set(value, (map.get(value) ?? 0) + 1)
  }

  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

function isActuallyOnline(profile: ProfileRow | null) {
  if (!profile?.is_online || !profile.last_seen) return false

  const lastSeen = new Date(profile.last_seen).getTime()

  if (Number.isNaN(lastSeen)) return false

  return Date.now() - lastSeen < 90_000
}