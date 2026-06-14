'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type AdminProfile = {
  id: string
  role: 'company' | 'worker' | null
  full_name: string | null
  company_name: string | null
  is_admin: boolean | null
}

type CountState = {
  companies: number
  workers: number
  jobs: number
  openJobs: number
  completedJobs: number
  applications: number
  invites: number
  messages: number
  notifications: number
}

type RecentJob = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  status: string | null
  created_at: string | null
}

type RecentProfile = {
  id: string
  role: 'company' | 'worker' | null
  full_name: string | null
  company_name: string | null
  created_at: string | null
}

const emptyCounts: CountState = {
  companies: 0,
  workers: 0,
  jobs: 0,
  openJobs: 0,
  completedJobs: 0,
  applications: 0,
  invites: 0,
  messages: 0,
  notifications: 0,
}

export default function AdminDashboardPage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [counts, setCounts] = useState<CountState>(emptyCounts)
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])
  const [recentProfiles, setRecentProfiles] = useState<RecentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState('')

  const adminName = useMemo(() => {
    return profile?.company_name || profile?.full_name || 'CrewCall Admin'
  }, [profile])

  const loadAdminDashboard = useCallback(async () => {
    setRefreshing(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setProfile(null)
      setMessage('You must be logged in to access admin.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name, company_name, is_admin')
      .eq('id', user.id)
      .maybeSingle<AdminProfile>()

    if (profileError) {
      setMessage(profileError.message)
      setLoading(false)
      setRefreshing(false)
      return
    }

    if (!profileData?.is_admin) {
      setProfile(profileData || null)
      setMessage('You do not have admin access.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    setProfile(profileData)

    const [
      companiesCount,
      workersCount,
      jobsCount,
      openJobsCount,
      completedJobsCount,
      applicationsCount,
      invitesCount,
      messagesCount,
      notificationsCount,
      jobsResult,
      profilesResult,
    ] = await Promise.all([
      getCount('profiles', { column: 'role', value: 'company' }),
      getCount('profiles', { column: 'role', value: 'worker' }),
      getCount('jobs'),
      getCount('jobs', { column: 'status', value: 'open' }),
      getCount('jobs', { column: 'status', value: 'completed' }),
      getCount('applications'),
      getCount('job_invites'),
      getCount('messages'),
      getCount('notifications'),
      supabase
        .from('jobs')
        .select('id, title, trade, location, status, created_at')
        .order('created_at', { ascending: false })
        .limit(8)
        .returns<RecentJob[]>(),
      supabase
        .from('profiles')
        .select('id, role, full_name, company_name, created_at')
        .order('created_at', { ascending: false })
        .limit(8)
        .returns<RecentProfile[]>(),
    ])

    setCounts({
      companies: companiesCount,
      workers: workersCount,
      jobs: jobsCount,
      openJobs: openJobsCount,
      completedJobs: completedJobsCount,
      applications: applicationsCount,
      invites: invitesCount,
      messages: messagesCount,
      notifications: notificationsCount,
    })

    if (!jobsResult.error) {
      setRecentJobs(jobsResult.data ?? [])
    }

    if (!profilesResult.error) {
      setRecentProfiles(profilesResult.data ?? [])
    }

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void loadAdminDashboard()
  }, [loadAdminDashboard])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl shadow-black/20 backdrop-blur">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            CrewCall Admin
          </p>
          <h1 className="mt-3 text-3xl font-black">Loading admin...</h1>
        </div>
      </main>
    )
  }

  if (!profile?.is_admin) {
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
            href="/"
            className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
          >
            Back to CrewCall
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
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  CrewCall Admin
                </p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Business Dashboard
                </h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Welcome back, {adminName}. Monitor users, jobs, messages, and
                  system activity from one control center.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadAdminDashboard()}
                disabled={refreshing}
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? 'Refreshing...' : 'Refresh Dashboard'}
              </button>
            </div>
          </div>

          <div className="space-y-6 p-6 md:p-8">
            {message && (
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-sm font-bold text-cyan-100">
                {message}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <AdminStatCard label="Companies" value={counts.companies} />
              <AdminStatCard label="Workers" value={counts.workers} />
              <AdminStatCard label="Total Jobs" value={counts.jobs} />
              <AdminStatCard label="Open Jobs" value={counts.openJobs} />
              <AdminStatCard
                label="Completed Jobs"
                value={counts.completedJobs}
              />
              <AdminStatCard label="Applications" value={counts.applications} />
              <AdminStatCard label="Invites" value={counts.invites} />
              <AdminStatCard label="Messages" value={counts.messages} />
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <AdminActionCard
                title="Users"
                description="Search companies and workers, review profiles, and manage account status."
                href="/admin/users"
              />
              <AdminActionCard
                title="Jobs"
                description="Review posted jobs, close spam, feature jobs, and monitor hiring activity."
                href="/admin/jobs"
              />
              <AdminActionCard
                title="Payments"
                description="Monitor Stripe payments, payouts, failed charges, and subscription health."
                href="/admin/payments"
              />
              <AdminActionCard
                title="Analytics"
                description="Track signups, jobs posted, applications, active users, and revenue trends."
                href="/admin/analytics"
              />
              <AdminActionCard
                title="Support"
                description="Handle reported users, jobs, messages, reviews, and customer issues."
                href="/admin/support"
              />
              <AdminActionCard
                title="Settings"
                description="Manage admin tools, verification options, pricing, and platform settings."
                href="/admin/settings"
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <RecentPanel title="Recent Jobs">
                {recentJobs.length === 0 ? (
                  <EmptyPanelText>No recent jobs found.</EmptyPanelText>
                ) : (
                  <div className="space-y-3">
                    {recentJobs.map((job) => (
                      <div
                        key={job.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-white">
                              {job.title || 'Untitled Job'}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-400">
                              {job.trade || 'Trade not listed'} •{' '}
                              {job.location || 'Location not listed'}
                            </p>
                          </div>
                          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase text-cyan-100">
                            {job.status || 'open'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </RecentPanel>

              <RecentPanel title="Recent Users">
                {recentProfiles.length === 0 ? (
                  <EmptyPanelText>No recent users found.</EmptyPanelText>
                ) : (
                  <div className="space-y-3">
                    {recentProfiles.map((user) => (
                      <div
                        key={user.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-white">
                              {user.company_name ||
                                user.full_name ||
                                'Unnamed User'}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-400">
                              {user.role || 'Role missing'}
                            </p>
                          </div>
                          <Link
                            href={`/profile?user=${user.id}`}
                            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/15"
                          >
                            View
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </RecentPanel>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

async function getCount(
  table:
    | 'profiles'
    | 'jobs'
    | 'applications'
    | 'job_invites'
    | 'messages'
    | 'notifications',
  filter?: { column: string; value: string }
) {
  let query = supabase.from(table).select('id', {
    count: 'exact',
    head: true,
  })

  if (filter) {
    query = query.eq(filter.column, filter.value)
  }

  const { count } = await query

  return count ?? 0
}

function AdminStatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-4xl font-black text-white">{value}</p>
    </div>
  )
}

function AdminActionCard({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 transition hover:border-cyan-300/40 hover:bg-slate-950/70"
    >
      <p className="text-xl font-black text-white">{title}</p>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
        {description}
      </p>
    </Link>
  )
}

function RecentPanel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
      <h2 className="text-xl font-black text-white">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function EmptyPanelText({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm font-bold text-slate-400">
      {children}
    </p>
  )
}