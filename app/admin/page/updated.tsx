'use client'

import Link from 'next/link'
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  full_name: string | null
  role: string | null
  company_name: string | null
  company_verified: boolean | null
  insurance_verified: boolean | null
  liability_form_verified: boolean | null
  created_at: string | null
}

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  status: string | null
  payment_status: string | null
  payout_status: string | null
  pay_rate: string | null
  company_id: string | null
  assigned_worker_id: string | null
  created_at: string | null
}

type Application = {
  id: string
  status: string | null
  job_id: string | null
  worker_id: string | null
  requested_pay_rate: string | null
  created_at: string | null
}

type Invite = {
  id: string
  status: string | null
  job_id: string | null
  worker_id: string | null
  company_id: string | null
  created_at: string | null
}

type VerificationField =
  | 'company_verified'
  | 'insurance_verified'
  | 'liability_form_verified'

type UserFilter =
  | 'all'
  | 'worker'
  | 'company'
  | 'admin'
  | 'unverified'

type JobFilter =
  | 'all'
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'unpaid'

type NoticeTone = 'error' | 'success' | 'warning'

function formatDate(value: string | null) {
  if (!value) {
    return 'Unknown'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Unknown'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function normalizeValue(value: string | null) {
  return value?.trim().toLowerCase() || ''
}

function titleCase(value: string | null) {
  if (!value) {
    return 'Unknown'
  }

  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getProfileName(profile: Profile) {
  return (
    profile.company_name ||
    profile.full_name ||
    'CrewCall User'
  )
}

function getInitial(profile: Profile) {
  return getProfileName(profile)
    .trim()
    .charAt(0)
    .toUpperCase()
}

function getVerificationCount(profile: Profile) {
  return [
    profile.company_verified,
    profile.insurance_verified,
    profile.liability_form_verified,
  ].filter(Boolean).length
}

function isFullyVerified(profile: Profile) {
  if (profile.role === 'company') {
    return Boolean(
      profile.company_verified &&
        profile.insurance_verified &&
        profile.liability_form_verified
    )
  }

  return Boolean(
    profile.insurance_verified &&
      profile.liability_form_verified
  )
}

export default function AdminPage() {
  const db = supabase as any

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] =
    useState<NoticeTone>('warning')

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] =
    useState<Application[]>([])
  const [invites, setInvites] = useState<Invite[]>([])

  const [userSearch, setUserSearch] = useState('')
  const [jobSearch, setJobSearch] = useState('')

  const [userFilter, setUserFilter] =
    useState<UserFilter>('all')

  const [jobFilter, setJobFilter] =
    useState<JobFilter>('all')

  const [workingProfileId, setWorkingProfileId] =
    useState<string | null>(null)

  const [accessDenied, setAccessDenied] = useState(false)

  const loadAdminData = useCallback(
    async (backgroundRefresh = false) => {
      if (backgroundRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setMessage('')
      setAccessDenied(false)

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          throw new Error(
            userError?.message || 'You must be logged in.'
          )
        }

        const { data: myProfile, error: profileError } =
          await db
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()

        if (profileError) {
          throw profileError
        }

        if (myProfile?.role !== 'admin') {
          setAccessDenied(true)
          throw new Error('Admin access only.')
        }

        const [
          profilesResponse,
          jobsResponse,
          applicationsResponse,
          invitesResponse,
        ] = await Promise.all([
          db
            .from('profiles')
            .select(
              `
              id,
              full_name,
              role,
              company_name,
              company_verified,
              insurance_verified,
              liability_form_verified,
              created_at
            `
            )
            .order('created_at', {
              ascending: false,
            }),

          db
            .from('jobs')
            .select(
              `
              id,
              title,
              trade,
              location,
              status,
              payment_status,
              payout_status,
              pay_rate,
              company_id,
              assigned_worker_id,
              created_at
            `
            )
            .order('created_at', {
              ascending: false,
            }),

          db
            .from('applications')
            .select(
              `
              id,
              status,
              job_id,
              worker_id,
              requested_pay_rate,
              created_at
            `
            )
            .order('created_at', {
              ascending: false,
            }),

          db
            .from('job_invites')
            .select(
              `
              id,
              status,
              job_id,
              worker_id,
              company_id,
              created_at
            `
            )
            .order('created_at', {
              ascending: false,
            }),
        ])

        const firstError =
          profilesResponse.error ||
          jobsResponse.error ||
          applicationsResponse.error ||
          invitesResponse.error

        if (firstError) {
          throw firstError
        }

        setProfiles(
          (profilesResponse.data as Profile[]) || []
        )

        setJobs((jobsResponse.data as Job[]) || [])

        setApplications(
          (applicationsResponse.data as Application[]) ||
            []
        )

        setInvites(
          (invitesResponse.data as Invite[]) || []
        )

    if (backgroundRefresh) {
          setMessage('Admin data refreshed.')
          setMessageTone('success')
        }
      } catch (error) {
        console.error('Admin dashboard load error:', error)

        setMessage(
          error instanceof Error
            ? error.message
            : JSON.stringify(error)
        )

        setMessageTone('error')
    } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [db]
  )

  useEffect(() => {
    void loadAdminData()
  }, [loadAdminData])

  useEffect(() => {
    if (accessDenied) {
      return
    }

    const refreshDashboard = () => {
      void loadAdminData(true)
    }

    window.addEventListener('focus', refreshDashboard)
    window.addEventListener('pageshow', refreshDashboard)

    const profileChannel = supabase
      .channel('admin-profiles-live-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        refreshDashboard
      )
      .subscribe()

    const jobsChannel = supabase
      .channel('admin-jobs-live-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
        },
        refreshDashboard
      )
      .subscribe()

    const applicationsChannel = supabase
      .channel('admin-applications-live-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
        },
        refreshDashboard
      )
      .subscribe()

    const invitesChannel = supabase
      .channel('admin-invites-live-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_invites',
        },
        refreshDashboard
      )
      .subscribe()

    return () => {
      window.removeEventListener(
        'focus',
        refreshDashboard
      )

      window.removeEventListener(
        'pageshow',
        refreshDashboard
      )

      void supabase.removeChannel(profileChannel)
      void supabase.removeChannel(jobsChannel)
      void supabase.removeChannel(applicationsChannel)
      void supabase.removeChannel(invitesChannel)
    }
  }, [accessDenied, loadAdminData])

  const profileById = useMemo(() => {
    return new Map(
      profiles.map((profile) => [
        profile.id,
        profile,
      ])
    )
  }, [profiles])

  const jobById = useMemo(() => {
    return new Map(
      jobs.map((job) => [job.id, job])
    )
  }, [jobs])

  const stats = useMemo(() => {
    const workers = profiles.filter(
      (profile) => profile.role === 'worker'
    ).length

    const companies = profiles.filter(
      (profile) => profile.role === 'company'
    ).length

    const fullyVerified = profiles.filter(
      isFullyVerified
    ).length

    const openJobs = jobs.filter(
      (job) => job.status === 'open'
    ).length

    const assignedJobs = jobs.filter(
      (job) =>
        job.status === 'assigned' ||
        job.status === 'in_progress'
    ).length

    const completedJobs = jobs.filter(
      (job) => job.status === 'completed'
    ).length

    const paidJobs = jobs.filter(
      (job) => job.payment_status === 'paid'
    ).length

    const unpaidJobs = jobs.filter(
      (job) => job.payment_status !== 'paid'
    ).length

    const pendingApplications = applications.filter(
      (application) =>
        application.status === 'pending'
    ).length

    const pendingInvites = invites.filter(
      (invite) => invite.status === 'pending'
    ).length

    const activeJobRate =
      jobs.length > 0
        ? Math.round(
            ((openJobs + assignedJobs) / jobs.length) *
              100
          )
        : 0

    const verificationRate =
      profiles.length > 0
        ? Math.round(
            (fullyVerified / profiles.length) * 100
          )
        : 0

    const fillRate =
      jobs.length > 0
        ? Math.round(
            ((assignedJobs + completedJobs) /
              jobs.length) *
              100
          )
        : 0

    return {
      users: profiles.length,
      workers,
      companies,
      fullyVerified,
      openJobs,
      assignedJobs,
      completedJobs,
      paidJobs,
      unpaidJobs,
      pendingApplications,
      pendingInvites,
      activeJobRate,
      verificationRate,
      fillRate,
    }
  }, [profiles, jobs, applications, invites])

  const filteredProfiles = useMemo(() => {
    const term = userSearch.trim().toLowerCase()

    return profiles.filter((profile) => {
      const searchable = [
        profile.full_name,
        profile.company_name,
        profile.role,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch =
        !term || searchable.includes(term)

      const matchesFilter =
        userFilter === 'all'
          ? true
          : userFilter === 'unverified'
            ? !isFullyVerified(profile)
            : profile.role === userFilter

      return matchesSearch && matchesFilter
    })
  }, [profiles, userSearch, userFilter])

  const filteredJobs = useMemo(() => {
    const term = jobSearch.trim().toLowerCase()

    return jobs.filter((job) => {
      const company = job.company_id
        ? profileById.get(job.company_id)
        : null

      const searchable = [
        job.title,
        job.trade,
        job.location,
        job.status,
        job.payment_status,
        job.payout_status,
        job.pay_rate,
        company?.company_name,
        company?.full_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch =
        !term || searchable.includes(term)

      const matchesFilter =
        jobFilter === 'all'
          ? true
          : jobFilter === 'unpaid'
            ? job.payment_status !== 'paid'
            : job.status === jobFilter

      return matchesSearch && matchesFilter
    })
  }, [
    jobs,
    jobSearch,
    jobFilter,
    profileById,
  ])

  async function toggleProfileFlag(
    profileId: string,
    field: VerificationField,
    currentValue: boolean | null
  ) {
    setWorkingProfileId(profileId)
    setMessage('')

    const { error } = await db
      .from('profiles')
      .update({
        [field]: !currentValue,
      })
      .eq('id', profileId)

    if (error) {
      setMessage(error.message)
      setMessageTone('error')
      setWorkingProfileId(null)
      return
    }

    setProfiles((current) =>
      current.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              [field]: !currentValue,
            }
          : profile
      )
    )

    setMessage(
      !currentValue
        ? 'Verification approved.'
        : 'Verification removed.'
    )

    setMessageTone('success')
    setWorkingProfileId(null)
  }

  if (loading) {
    return <AdminLoadingState />
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[2rem] border border-red-400/20 bg-red-500/10 p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-red-400/20 bg-red-500/10 text-2xl font-black text-red-300">
              !
            </div>

            <h1 className="mt-5 text-3xl font-black">
              Admin Access Required
            </h1>

            <p className="mt-3 text-sm leading-6 text-red-100/80">
              Your CrewCall account does not have permission
              to view the admin control center.
            </p>

<Link
  href="/"
  className="mt-6 inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:bg-cyan-300"
>
  <span className="text-slate-950">
    Return to Dashboard
  </span>
</Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8 lg:px-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-[130px]" />

        <div className="absolute -right-48 top-64 h-96 w-96 rounded-full bg-blue-500/10 blur-[130px]" />

        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-violet-500/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-[1500px] space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

          <div className="p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col justify-between gap-8 xl:flex-row xl:items-end">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    label="CrewCall Admin"
                    tone="cyan"
                  />

                  <Badge
                    label="Live Control Center"
                    tone="green"
                  />

                  {stats.unpaidJobs > 0 ? (
                    <Badge
                      label={`${stats.unpaidJobs} Unpaid Jobs`}
                      tone="amber"
                    />
                  ) : null}
                </div>

                <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                  Control Center
                </h1>

                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-400 sm:text-base">
                  Monitor CrewCall users, jobs, payments,
                  applications, invites, payouts, and
                  verification activity from one place.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadAdminData(true)
                }
                disabled={refreshing}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing
                  ? 'Refreshing...'
                  : 'Refresh Dashboard'}
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <Notice tone={messageTone}>
            {message}
          </Notice>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total Users"
            value={stats.users}
            detail={`${stats.workers} workers · ${stats.companies} companies`}
            tone="cyan"
          />

          <MetricCard
            label="Open Jobs"
            value={stats.openJobs}
            detail={`${stats.assignedJobs} assigned or active`}
            tone="blue"
          />

          <MetricCard
            label="Completed Jobs"
            value={stats.completedJobs}
            detail={`${stats.fillRate}% overall fill rate`}
            tone="green"
          />

          <MetricCard
            label="Pending Activity"
            value={
              stats.pendingApplications +
              stats.pendingInvites
            }
            detail={`${stats.pendingApplications} applications · ${stats.pendingInvites} invites`}
            tone="amber"
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ProgressCard
            label="Verification Rate"
            value={stats.verificationRate}
            detail={`${stats.fullyVerified} users fully verified`}
            tone="cyan"
          />

          <ProgressCard
            label="Job Fill Rate"
            value={stats.fillRate}
            detail="Assigned and completed jobs"
            tone="green"
          />

          <ProgressCard
            label="Active Job Rate"
            value={stats.activeJobRate}
            detail="Open, assigned, or in progress"
            tone="blue"
          />

          <ProgressCard
            label="Paid Job Rate"
            value={
              jobs.length > 0
                ? Math.round(
                    (stats.paidJobs / jobs.length) *
                      100
                  )
                : 0
            }
            detail={`${stats.paidJobs} paid · ${stats.unpaidJobs} unpaid`}
            tone="amber"
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MiniStat
            label="Workers"
            value={stats.workers}
          />

          <MiniStat
            label="Companies"
            value={stats.companies}
          />

          <MiniStat
            label="Assigned"
            value={stats.assignedJobs}
          />

          <MiniStat
            label="Paid Jobs"
            value={stats.paidJobs}
          />

          <MiniStat
            label="Applications"
            value={stats.pendingApplications}
          />

          <MiniStat
            label="Invites"
            value={stats.pendingInvites}
          />
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-xl shadow-black/20 backdrop-blur-xl">
          <SectionHeader
            eyebrow="Marketplace Activity"
            title="Jobs"
            description="Review active work, payment status, payouts, assigned workers, and job activity."
            actions={
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/admin/jobs"
                  className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-sm font-black text-white transition hover:bg-white/[0.1]"
                >
                  All Jobs
                </Link>

                <Link
                  href="/admin/payments"
                  className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
                >
                  Payments
                </Link>
              </div>
            }
          />

          <div className="border-t border-white/10 p-5 sm:p-6">
            <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
              <input
                value={jobSearch}
                onChange={(event) =>
                  setJobSearch(event.target.value)
                }
                placeholder="Search jobs, trades, companies, locations, or payments..."
                className="min-h-12 rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
              />

              <select
                value={jobFilter}
                onChange={(event) =>
                  setJobFilter(
                    event.target.value as JobFilter
                  )
                }
                className="min-h-12 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-400/40"
              >
                <option value="all">
                  All Jobs
                </option>

                <option value="open">Open</option>

                <option value="assigned">
                  Assigned
                </option>

                <option value="in_progress">
                  In Progress
                </option>

                <option value="completed">
                  Completed
                </option>

                <option value="unpaid">
                  Unpaid
                </option>
              </select>

              {(jobSearch ||
                jobFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setJobSearch('')
                    setJobFilter('all')
                  }}
                  className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white transition hover:bg-white/[0.1]"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                    <th className="px-3 py-4">
                      Job
                    </th>

                    <th className="px-3 py-4">
                      Company
                    </th>

                    <th className="px-3 py-4">
                      Status
                    </th>

                    <th className="px-3 py-4">
                      Payment
                    </th>

                    <th className="px-3 py-4">
                      Payout
                    </th>

                    <th className="px-3 py-4">
                      Worker
                    </th>

                    <th className="px-3 py-4">
                      Created
                    </th>

                    <th className="px-3 py-4 text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredJobs
                    .slice(0, 30)
                    .map((job) => {
                      const company = job.company_id
                        ? profileById.get(
                            job.company_id
                          )
                        : null

                      const worker =
                        job.assigned_worker_id
                          ? profileById.get(
                              job.assigned_worker_id
                            )
                          : null

                      return (
                        <tr
                          key={job.id}
                          className="border-b border-white/[0.07] text-sm transition hover:bg-white/[0.025]"
                        >
                          <td className="px-3 py-4">
                            <p className="font-black text-white">
                              {job.title ||
                                'Untitled Job'}
                            </p>

                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {[
                                job.trade,
                                job.location,
                                job.pay_rate,
                              ]
                                .filter(Boolean)
                                .join(' · ') || 'No details'}
                            </p>
                          </td>

                          <td className="px-3 py-4">
                            <p className="font-bold text-slate-200">
                              {company
                                ? getProfileName(
                                    company
                                  )
                                : 'Unknown Company'}
                            </p>
                          </td>

                          <td className="px-3 py-4">
                            <StatusPill
                              value={job.status}
                            />
                          </td>

                          <td className="px-3 py-4">
                            <StatusPill
                              value={
                                job.payment_status
                              }
                            />
                          </td>

                          <td className="px-3 py-4">
                            <StatusPill
                              value={
                                job.payout_status
                              }
                            />
                          </td>

                          <td className="px-3 py-4">
                            <span className="font-semibold text-slate-300">
                              {worker
                                ? getProfileName(
                                    worker
                                  )
                                : 'Unassigned'}
                            </span>
                          </td>

                          <td className="px-3 py-4 text-xs font-semibold text-slate-500">
                            {formatDate(
                              job.created_at
                            )}
                          </td>

                          <td className="px-3 py-4 text-right">
                            <Link
                              href={`/jobs/${job.id}`}
                              className="inline-flex rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-300 transition hover:bg-cyan-500/20"
                            >
                              View Job
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {filteredJobs.length === 0 ? (
              <EmptyState
                title="No jobs found"
                description="Try changing the search or job-status filter."
              />
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-xl shadow-black/20 backdrop-blur-xl">
          <SectionHeader
            eyebrow="Trust and Compliance"
            title="Users and Verification"
            description="Review companies, workers, insurance, liability forms, and verification status."
            actions={
              <Link
                href="/admin/users"
                className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
              >
                All Users
              </Link>
            }
          />

          <div className="border-t border-white/10 p-5 sm:p-6">
            <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
              <input
                value={userSearch}
                onChange={(event) =>
                  setUserSearch(event.target.value)
                }
                placeholder="Search users, companies, or roles..."
                className="min-h-12 rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
              />

              <select
                value={userFilter}
                onChange={(event) =>
                  setUserFilter(
                    event.target.value as UserFilter
                  )
                }
                className="min-h-12 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-400/40"
              >
                <option value="all">
                  All Users
                </option>

                <option value="worker">
                  Workers
                </option>

                <option value="company">
                  Companies
                </option>

                <option value="admin">
                  Admins
                </option>

                <option value="unverified">
                  Needs Verification
                </option>
              </select>

              {(userSearch ||
                userFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setUserSearch('')
                    setUserFilter('all')
                  }}
                  className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white transition hover:bg-white/[0.1]"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                    <th className="px-3 py-4">
                      User
                    </th>

                    <th className="px-3 py-4">
                      Role
                    </th>

                    <th className="px-3 py-4">
                      Company
                    </th>

                    <th className="px-3 py-4">
                      Company
                    </th>

                    <th className="px-3 py-4">
                      Insurance
                    </th>

                    <th className="px-3 py-4">
                      Liability
                    </th>

                    <th className="px-3 py-4">
                      Verification
                    </th>

                    <th className="px-3 py-4">
                      Joined
                    </th>

                    <th className="px-3 py-4 text-right">
                      Profile
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProfiles
                    .slice(0, 50)
                    .map((profile) => {
                      const verificationCount =
                        getVerificationCount(profile)

                      const working =
                        workingProfileId ===
                        profile.id

                      return (
                        <tr
                          key={profile.id}
                          className="border-b border-white/[0.07] text-sm transition hover:bg-white/[0.025]"
                        >
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-sm font-black text-cyan-300">
                                {getInitial(profile)}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate font-black text-white">
                                  {getProfileName(
                                    profile
                                  )}
                                </p>

                                <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                                {profile.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-4">
                            <StatusPill
                              value={profile.role}
                            />
                          </td>

                          <td className="px-3 py-4 font-semibold text-slate-300">
                            {profile.company_name ||
                              '—'}
                          </td>

                          <td className="px-3 py-4">
                            <VerifyButton
                              label="Company"
                              active={
                                profile.company_verified
                              }
                              working={working}
                              onClick={() =>
                                void toggleProfileFlag(
                                  profile.id,
                                  'company_verified',
                                  profile.company_verified
                                )
                              }
                            />
                          </td>

                          <td className="px-3 py-4">
                            <VerifyButton
                              label="Insurance"
                              active={
                                profile.insurance_verified
                              }
                              working={working}
                              onClick={() =>
                                void toggleProfileFlag(
                                  profile.id,
                                  'insurance_verified',
                                  profile.insurance_verified
                                )
                              }
                            />
                          </td>

                          <td className="px-3 py-4">
                            <VerifyButton
                              label="Liability"
                              active={
                                profile.liability_form_verified
                              }
                              working={working}
                              onClick={() =>
                                void toggleProfileFlag(
                                  profile.id,
                                  'liability_form_verified',
                                  profile.liability_form_verified
                                )
                              }
                            />
                          </td>

                          <td className="px-3 py-4">
                            <div className="min-w-28">
                              <div className="flex items-center justify-between text-xs font-black">
                                <span className="text-slate-500">
                                  {verificationCount}/3
                                </span>

                                <span
                                  className={
                                    verificationCount === 3
                                      ? 'text-emerald-300'
                                      : 'text-amber-300'
                                  }
                                >
                                  {Math.round(
                                    (verificationCount /
                                      3) *
                                      100
                                  )}
                                  %
                                </span>
                              </div>

                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                                <div
                                  className={`h-full rounded-full ${
                                    verificationCount === 3
                                      ? 'bg-emerald-400'
                                      : 'bg-amber-400'
                                  }`}
                                  style={{
                                    width: `${Math.round(
                                      (verificationCount /
                                        3) *
                                        100
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-4 text-xs font-semibold text-slate-500">
                            {formatDate(
                              profile.created_at
                            )}
                          </td>

                          <td className="px-3 py-4 text-right">
                            <Link
                              href={`/admin/users/${profile.id}`}
                              className="inline-flex rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-300 transition hover:bg-cyan-500/20"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {filteredProfiles.length === 0 ? (
              <EmptyState
                title="No users found"
                description="Try changing the user search or verification filter."
              />
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <ActivityPanel
            eyebrow="Hiring Activity"
            title="Recent Applications"
            count={applications.length}
          >
            {applications.length === 0 ? (
              <EmptyState
                title="No applications yet"
                description="Worker applications will appear here."
              />
            ) : (
              <div className="space-y-3">
                {applications
                  .slice(0, 12)
                  .map((application) => {
                    const job = application.job_id
                      ? jobById.get(
                          application.job_id
                        )
                      : null

                    const worker =
                      application.worker_id
                        ? profileById.get(
                            application.worker_id
                          )
                        : null

                    return (
                      <ActivityCard
                        key={application.id}
                        title={
                          worker
                            ? getProfileName(worker)
                            : 'Unknown Worker'
                        }
                        subtitle={
                          job?.title ||
                          'Unknown Job'
                        }
                        status={
                          application.status
                        }
                        detail={`Requested pay: ${
                          application.requested_pay_rate ||
                          'Not provided'
                        }`}
                        date={application.created_at}
                        href={
                          application.job_id
                            ? `/jobs/${application.job_id}`
                            : undefined
                        }
                      />
                    )
                  })}
              </div>
            )}
          </ActivityPanel>

          <ActivityPanel
            eyebrow="Recruiting Activity"
            title="Recent Invites"
            count={invites.length}
          >
            {invites.length === 0 ? (
              <EmptyState
                title="No invites yet"
                description="Company invitations will appear here."
              />
            ) : (
              <div className="space-y-3">
                {invites
                  .slice(0, 12)
                  .map((invite) => {
                    const job = invite.job_id
                      ? jobById.get(invite.job_id)
                      : null

                    const worker =
                      invite.worker_id
                        ? profileById.get(
                            invite.worker_id
                          )
                        : null

                    const company =
                      invite.company_id
                        ? profileById.get(
                            invite.company_id
                          )
                        : null

                    return (
                      <ActivityCard
                        key={invite.id}
                        title={
                          worker
                            ? getProfileName(worker)
                            : 'Unknown Worker'
                        }
                        subtitle={
                          job?.title ||
                          'Unknown Job'
                        }
                        status={invite.status}
                        detail={`From ${
                          company
                            ? getProfileName(
                                company
                              )
                            : 'Unknown Company'
                        }`}
                        date={invite.created_at}
                        href={
                          invite.job_id
                            ? `/jobs/${invite.job_id}`
                            : undefined
                        }
                      />
                    )
                  })}
              </div>
            )}
          </ActivityPanel>
        </section>
      </div>
    </main>
  )
}

function AdminLoadingState() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl">
          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

          <div className="p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
              CrewCall Admin
            </p>

            <h1 className="mt-3 text-3xl font-black">
              Loading Control Center...
            </h1>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-36 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]"
                />
              ))}
            </div>

            <div className="mt-6 h-96 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
          </div>
        </div>
      </div>
    </main>
  )
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: number
  detail: string
  tone: 'cyan' | 'blue' | 'green' | 'amber'
}) {
  const classes = {
    cyan:
      'border-cyan-400/20 bg-cyan-500/[0.08] text-cyan-300',
    blue:
      'border-blue-400/20 bg-blue-500/[0.08] text-blue-300',
    green:
      'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-300',
    amber:
      'border-amber-400/20 bg-amber-500/[0.08] text-amber-300',
  }

  return (
    <div
      className={`rounded-[2rem] border p-5 shadow-xl shadow-black/10 ${classes[tone]}`}
    >
      <p className="text-xs font-black uppercase tracking-[0.14em] opacity-80">
        {label}
      </p>

      <p className="mt-3 text-4xl font-black text-white">
        {value}
      </p>

      <p className="mt-2 text-xs font-semibold text-slate-400">
        {detail}
      </p>
    </div>
  )
}

function ProgressCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: number
  detail: string
  tone: 'cyan' | 'blue' | 'green' | 'amber'
}) {
  const barClasses = {
    cyan: 'bg-cyan-400',
    blue: 'bg-blue-400',
    green: 'bg-emerald-400',
    amber: 'bg-amber-400',
  }

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-xs font-semibold text-slate-400">
            {detail}
          </p>
        </div>

        <p className="text-3xl font-black text-white">
          {value}%
        </p>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${barClasses[tone]}`}
          style={{
            width: `${Math.min(
              100,
              Math.max(0, value)
            )}%`,
          }}
        />
      </div>
    </div>
  )
}

function MiniStat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 text-center shadow-lg shadow-black/10">
      <p className="text-2xl font-black text-white">
        {value}
      </p>

      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
    </div>
  )
}

function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
          {eyebrow}
        </p>

        <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
          {title}
        </h2>

        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-400">
          {description}
        </p>
      </div>

      {actions}
    </div>
  )
}

function ActivityPanel({
  eyebrow,
  title,
  count,
  children,
}: {
  eyebrow: string
  title: string
  count: number
  children: ReactNode
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/20 backdrop-blur-xl sm:p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            {eyebrow}
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            {title}
          </h2>
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-black text-slate-300">
          {count}
        </span>
      </div>

      <div className="mt-5">{children}</div>
    </section>
  )
}

function ActivityCard({
  title,
  subtitle,
  status,
  detail,
  date,
  href,
}: {
  title: string
  subtitle: string
  status: string | null
  detail: string
  date: string | null
  href?: string
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-950/55 p-4 transition hover:border-cyan-400/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-black text-white">
              {title}
            </h3>

            <StatusPill value={status} />
          </div>

          <p className="mt-2 truncate text-sm font-bold text-slate-300">
            {subtitle}
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-500">
            {detail}
          </p>

          <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-slate-600">
            {formatDateTime(date)}
          </p>
        </div>

        {href ? (
          <Link
            href={href}
            className="shrink-0 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-300 transition hover:bg-cyan-500/20"
          >
            Open
          </Link>
        ) : null}
      </div>
    </article>
  )
}

function VerifyButton({
  label,
  active,
  working,
  onClick,
}: {
  label: string
  active: boolean | null
  working: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={working}
      title={`${active ? 'Remove' : 'Approve'} ${label} verification`}
      className={
        active
          ? 'rounded-full border border-emerald-400/20 bg-emerald-500/15 px-3 py-1.5 text-xs font-black text-emerald-300 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50'
          : 'rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-xs font-black text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50'
      }
    >
      {working
        ? 'Updating...'
        : active
          ? 'Verified'
          : 'Verify'}
    </button>
  )
}

function StatusPill({
  value,
}: {
  value: string | null
}) {
  const normalized = normalizeValue(value)

  let classes =
    'border-white/10 bg-white/[0.055] text-slate-300'

  if (
    normalized === 'paid' ||
    normalized === 'completed' ||
    normalized === 'accepted' ||
    normalized === 'verified' ||
    normalized === 'released'
  ) {
    classes =
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
  } else if (
    normalized === 'pending' ||
    normalized === 'open' ||
    normalized === 'unpaid'
  ) {
    classes =
      'border-amber-400/20 bg-amber-500/10 text-amber-300'
  } else if (
    normalized === 'assigned' ||
    normalized === 'in_progress'
  ) {
    classes =
      'border-cyan-400/20 bg-cyan-500/10 text-cyan-300'
  } else if (
    normalized === 'declined' ||
    normalized === 'rejected' ||
    normalized === 'cancelled' ||
    normalized === 'failed'
  ) {
    classes =
      'border-red-400/20 bg-red-500/10 text-red-300'
  } else if (
    normalized === 'worker' ||
    normalized === 'company' ||
    normalized === 'admin'
  ) {
    classes =
      'border-blue-400/20 bg-blue-500/10 text-blue-300'
  }

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${classes}`}
    >
      {titleCase(value)}
    </span>
  )
}

function Badge({
  label,
  tone,
}: {
  label: string
  tone: 'cyan' | 'green' | 'amber'
}) {
  const classes = {
    cyan:
      'border-cyan-400/20 bg-cyan-500/10 text-cyan-300',
    green:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
    amber:
      'border-amber-400/20 bg-amber-500/10 text-amber-300',
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wider ${classes[tone]}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          tone === 'cyan'
            ? 'bg-cyan-400'
            : tone === 'green'
              ? 'bg-emerald-400'
              : 'bg-amber-400'
        }`}
      />

      {label}
    </span>
  )
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mt-5 rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
      <p className="text-lg font-black text-white">
        {title}
      </p>

      <p className="mt-2 text-sm font-semibold text-slate-500">
        {description}
      </p>
    </div>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: NoticeTone
  children: ReactNode
}) {
  const classes = {
    error:
      'border-red-400/20 bg-red-500/10 text-red-200',
    success:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    warning:
      'border-amber-400/20 bg-amber-500/10 text-amber-200',
  }

  return (
    <div
      className={`rounded-2xl border p-4 text-sm font-bold ${classes[tone]}`}
    >
      {children}
    </div>
  )
}