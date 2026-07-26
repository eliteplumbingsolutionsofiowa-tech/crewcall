'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type CheckStatus = 'ready' | 'warning' | 'missing'

type SystemCheck = {
  id: string
  label: string
  status: CheckStatus
  detail: string
}

type LaunchStats = {
  totalProfiles: number
  companies: number
  workers: number
  admins: number
  totalJobs: number
  openJobs: number
  assignedJobs: number
  completedJobs: number
  paidJobs: number
  releasedPayouts: number
  totalApplications: number
  hiredApplications: number
  totalInvites: number
  pendingInvites: number
  totalNotifications: number
  unreadNotifications: number
}

type LaunchResponse = {
  success?: boolean
  error?: string
  generatedAt?: string
  readinessPercent?: number
  checks?: SystemCheck[]
  stats?: LaunchStats
  databaseWarnings?: string[]
}

type ManualTask = {
  id: string
  label: string
  description: string
  href?: string
  critical: boolean
}

const MANUAL_TASKS: ManualTask[] = [
  {
    id: 'live-stripe-test',
    label: 'Complete a real Stripe payment test',
    description:
      'Post a small test job, pay it, complete it, and release the worker payout.',
    href: '/admin/payments',
    critical: true,
  },
  {
    id: 'worker-flow',
    label: 'Test complete worker flow on mobile',
    description:
      'Sign up, complete profile, browse, apply, message, accept work, and review.',
    href: '/jobs',
    critical: true,
  },
  {
    id: 'company-flow',
    label: 'Test complete company flow',
    description:
      'Sign up, post a job, run AI matching, invite, hire, message, pay, and review.',
    href: '/company/dashboard',
    critical: true,
  },
  {
    id: 'email-flow',
    label: 'Verify every important email',
    description:
      'Confirm welcome, application, invite, hired, message, payment, and review emails.',
    critical: true,
  },
  {
    id: 'password-reset',
    label: 'Verify password reset',
    description:
      'Confirm a real user can request and complete a password reset.',
    href: '/login',
    critical: true,
  },
  {
    id: 'remove-test-data',
    label: 'Remove or isolate test accounts',
    description:
      'Remove unrealistic test workers and jobs from production matching.',
    href: '/admin/users',
    critical: true,
  },
  {
    id: 'domain',
    label: 'Connect production domain',
    description:
      'Connect the final CrewCall domain and confirm HTTPS and redirects.',
    critical: true,
  },
  {
    id: 'support-email',
    label: 'Create customer support email',
    description:
      'Set up an address such as support@getcrewcall.com and verify delivery.',
    critical: true,
  },
  {
    id: 'mobile-safari',
    label: 'Test Safari on iPhone',
    description:
      'Test signup, navigation, forms, messages, maps, and payments.',
    critical: false,
  },
  {
    id: 'mobile-android',
    label: 'Test Chrome on Android',
    description:
      'Test signup, navigation, forms, messages, maps, and payments.',
    critical: false,
  },
  {
    id: 'favicon',
    label: 'Verify favicon and app icons',
    description:
      'Confirm favicon, Apple touch icon, and mobile home-screen icon.',
    critical: false,
  },
  {
    id: 'seo',
    label: 'Verify SEO metadata',
    description:
      'Confirm titles, descriptions, social previews, sitemap, and robots.txt.',
    critical: false,
  },
  {
    id: 'analytics',
    label: 'Connect production analytics',
    description:
      'Add privacy-conscious analytics and verify page-view tracking.',
    critical: false,
  },
  {
    id: 'backup',
    label: 'Verify database backup plan',
    description:
      'Confirm Supabase backups and document the restoration process.',
    critical: false,
  },
]

const STORAGE_KEY = 'crewcall-launch-checklist-v1'

const EMPTY_STATS: LaunchStats = {
  totalProfiles: 0,
  companies: 0,
  workers: 0,
  admins: 0,
  totalJobs: 0,
  openJobs: 0,
  assignedJobs: 0,
  completedJobs: 0,
  paidJobs: 0,
  releasedPayouts: 0,
  totalApplications: 0,
  hiredApplications: 0,
  totalInvites: 0,
  pendingInvites: 0,
  totalNotifications: 0,
  unreadNotifications: 0,
}

function statusTone(status: CheckStatus) {
  if (status === 'ready') {
    return {
      border: 'border-emerald-400/30',
      background: 'bg-emerald-400/10',
      text: 'text-emerald-100',
      icon: '✓',
      label: 'Ready',
    }
  }

  if (status === 'warning') {
    return {
      border: 'border-orange-400/30',
      background: 'bg-orange-400/10',
      text: 'text-orange-100',
      icon: '!',
      label: 'Review',
    }
  }

  return {
    border: 'border-red-400/30',
    background: 'bg-red-400/10',
    text: 'text-red-100',
    icon: '×',
    label: 'Missing',
  }
}

function progressTone(value: number) {
  if (value >= 90) return 'from-emerald-400 to-cyan-400'
  if (value >= 70) return 'from-cyan-400 to-blue-500'
  if (value >= 50) return 'from-orange-400 to-yellow-300'

  return 'from-red-500 to-orange-400'
}

export default function AdminLaunchPage() {
  const [checks, setChecks] = useState<SystemCheck[]>([])
  const [stats, setStats] = useState<LaunchStats>(EMPTY_STATS)
  const [completedTasks, setCompletedTasks] = useState<string[]>([])
  const [systemReadiness, setSystemReadiness] = useState(0)
  const [generatedAt, setGeneratedAt] = useState('')
  const [databaseWarnings, setDatabaseWarnings] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const manualReadiness = useMemo(() => {
    if (MANUAL_TASKS.length === 0) return 100

    return Math.round(
      (completedTasks.length / MANUAL_TASKS.length) * 100
    )
  }, [completedTasks])

  const overallReadiness = useMemo(
    () => Math.round(systemReadiness * 0.65 + manualReadiness * 0.35),
    [manualReadiness, systemReadiness]
  )

  const completedCriticalTasks = useMemo(
    () =>
      MANUAL_TASKS.filter(
        (task) => task.critical && completedTasks.includes(task.id)
      ).length,
    [completedTasks]
  )

  const totalCriticalTasks = useMemo(
    () => MANUAL_TASKS.filter((task) => task.critical).length,
    []
  )

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)

      if (stored) {
        const parsed = JSON.parse(stored)

        if (Array.isArray(parsed)) {
          setCompletedTasks(
            parsed.filter((value) => typeof value === 'string')
          )
        }
      }
    } catch {
      // Ignore invalid local checklist storage.
    }

    void loadLaunchCenter(false)
  }, [])

  function saveCompletedTasks(next: string[]) {
    setCompletedTasks(next)

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Local storage is optional.
    }
  }

  function toggleTask(taskId: string) {
    const next = completedTasks.includes(taskId)
      ? completedTasks.filter((id) => id !== taskId)
      : [...completedTasks, taskId]

    saveCompletedTasks(next)
  }

  async function loadLaunchCenter(isRefresh: boolean) {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setError('Your login session expired. Please log in again.')
        return
      }

      const response = await fetch('/api/admin/launch', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: 'no-store',
      })

      const result = (await response.json().catch(() => null)) as
        | LaunchResponse
        | null

      if (!response.ok || !result?.success) {
        setError(
          result?.error || 'Unable to load launch readiness.'
        )
        return
      }

      setChecks(result.checks || [])
      setStats(result.stats || EMPTY_STATS)
      setSystemReadiness(result.readinessPercent || 0)
      setGeneratedAt(result.generatedAt || '')
      setDatabaseWarnings(result.databaseWarnings || [])
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load launch readiness.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
            CrewCall Admin
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Loading Launch Center...
          </h1>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 via-blue-500/10 to-purple-500/10 shadow-2xl">
          <div className="p-6 md:p-9">
            <div className="flex flex-col gap-7 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <Link
                  href="/admin"
                  className="text-sm font-black text-cyan-300 transition hover:text-cyan-200"
                >
                  ← Back to Admin
                </Link>

                <p className="mt-7 text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
                  CrewCall Command Center
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
                  Launch Readiness
                </h1>

                <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-slate-300">
                  Complete the critical systems, production testing,
                  legal, domain, support, and mobile tasks before opening
                  CrewCall to real customers.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadLaunchCenter(true)}
                disabled={refreshing}
                className="rounded-2xl bg-cyan-300 px-7 py-4 text-sm font-black text-slate-950 shadow-xl transition hover:bg-cyan-200 disabled:opacity-50"
              >
                {refreshing ? 'Checking Systems...' : 'Refresh Status'}
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-3xl border border-red-400/30 bg-red-400/10 p-5 text-sm font-bold text-red-100">
            {error}
          </div>
        ) : null}

        <section className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-6 shadow-2xl md:p-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                Overall Progress
              </p>

              <p className="mt-3 text-6xl font-black">
                {overallReadiness}%
              </p>

              <p className="mt-3 max-w-xl text-sm font-semibold text-slate-400">
                System readiness is weighted at 65%. Manual production
                testing and business readiness are weighted at 35%.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard
                label="Systems"
                value={`${systemReadiness}%`}
              />
              <SummaryCard
                label="Manual Tasks"
                value={`${completedTasks.length}/${MANUAL_TASKS.length}`}
              />
              <SummaryCard
                label="Critical Tests"
                value={`${completedCriticalTasks}/${totalCriticalTasks}`}
              />
            </div>
          </div>

          <div className="mt-7 h-5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${progressTone(
                overallReadiness
              )} transition-all duration-700`}
              style={{
                width: `${Math.max(0, Math.min(100, overallReadiness))}%`,
              }}
            />
          </div>

          {generatedAt ? (
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Last system check:{' '}
              {new Date(generatedAt).toLocaleString('en-US')}
            </p>
          ) : null}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Companies"
            value={stats.companies}
            detail={`${stats.totalProfiles} total profiles`}
          />
          <MetricCard
            label="Workers"
            value={stats.workers}
            detail={`${stats.admins} administrator account${
              stats.admins === 1 ? '' : 's'
            }`}
          />
          <MetricCard
            label="Jobs Posted"
            value={stats.totalJobs}
            detail={`${stats.openJobs} open • ${stats.assignedJobs} active`}
          />
          <MetricCard
            label="Completed Jobs"
            value={stats.completedJobs}
            detail={`${stats.paidJobs} paid • ${stats.releasedPayouts} payouts`}
          />
          <MetricCard
            label="Applications"
            value={stats.totalApplications}
            detail={`${stats.hiredApplications} hired`}
          />
          <MetricCard
            label="Invitations"
            value={stats.totalInvites}
            detail={`${stats.pendingInvites} pending`}
          />
          <MetricCard
            label="Notifications"
            value={stats.totalNotifications}
            detail={`${stats.unreadNotifications} unread`}
          />
          <MetricCard
            label="Conversion"
            value={
              stats.totalApplications > 0
                ? `${Math.round(
                    (stats.hiredApplications /
                      stats.totalApplications) *
                      100
                  )}%`
                : '0%'
            }
            detail="Applications hired"
          />
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl md:p-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
              Automated Checks
            </p>

            <h2 className="mt-2 text-3xl font-black">
              Critical Systems
            </h2>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {checks.map((item) => {
              const tone = statusTone(item.status)

              return (
                <article
                  key={item.id}
                  className={`rounded-3xl border ${tone.border} ${tone.background} p-5`}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${tone.border} text-xl font-black ${tone.text}`}
                    >
                      {tone.icon}
                    </span>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-black text-white">
                          {item.label}
                        </h3>

                        <span
                          className={`rounded-full border ${tone.border} px-3 py-1 text-[10px] font-black uppercase tracking-wide ${tone.text}`}
                        >
                          {tone.label}
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="rounded-[2rem] border border-purple-400/20 bg-purple-400/10 p-6 shadow-2xl md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-purple-200">
                Production Checklist
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Required Before Public Launch
              </h2>

              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
                Check a task only after you have personally completed and
                verified it in the production environment.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const confirmed = window.confirm(
                  'Reset every manual launch task?'
                )

                if (confirmed) {
                  saveCompletedTasks([])
                }
              }}
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black transition hover:bg-white/20"
            >
              Reset Checklist
            </button>
          </div>

          <div className="mt-7 grid gap-4">
            {MANUAL_TASKS.map((task) => {
              const complete = completedTasks.includes(task.id)

              return (
                <article
                  key={task.id}
                  className={`rounded-3xl border p-5 transition ${
                    complete
                      ? 'border-emerald-400/30 bg-emerald-400/10'
                      : task.critical
                        ? 'border-red-400/25 bg-red-400/10'
                        : 'border-white/10 bg-slate-950/40'
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <button
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      aria-label={
                        complete
                          ? `Mark ${task.label} incomplete`
                          : `Mark ${task.label} complete`
                      }
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-xl font-black transition ${
                        complete
                          ? 'border-emerald-300/40 bg-emerald-400/20 text-emerald-100'
                          : 'border-white/15 bg-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {complete ? '✓' : ''}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3
                          className={`text-lg font-black ${
                            complete
                              ? 'text-emerald-100 line-through'
                              : 'text-white'
                          }`}
                        >
                          {task.label}
                        </h3>

                        {task.critical ? (
                          <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-red-100">
                            Critical
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-slate-300">
                            Launch Polish
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                        {task.description}
                      </p>
                    </div>

                    {task.href ? (
                      <Link
                        href={task.href}
                        className="shrink-0 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-5 py-3 text-center text-sm font-black text-cyan-100 transition hover:bg-cyan-300/20"
                      >
                        Open
                      </Link>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        {databaseWarnings.length > 0 ? (
          <section className="rounded-[2rem] border border-orange-400/25 bg-orange-400/10 p-6">
            <h2 className="text-xl font-black text-orange-100">
              Database warnings
            </h2>

            <div className="mt-4 space-y-2">
              {databaseWarnings.map((warning, index) => (
                <p
                  key={`${warning}-${index}`}
                  className="text-sm font-semibold text-orange-50"
                >
                  • {warning}
                </p>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-[2rem] border border-cyan-400/20 bg-gradient-to-r from-cyan-400/15 to-blue-500/15 p-6 text-center shadow-2xl md:p-10">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-200">
            Launch Decision
          </p>

          <h2 className="mt-3 text-4xl font-black">
            {overallReadiness >= 90 &&
            completedCriticalTasks === totalCriticalTasks
              ? 'CrewCall is ready for a controlled Iowa beta.'
              : 'CrewCall still has launch work remaining.'}
          </h2>

          <p className="mx-auto mt-4 max-w-3xl font-semibold leading-7 text-slate-300">
            Do not launch publicly until every critical manual task has
            been completed and automated system readiness is at least
            90%.
          </p>
        </section>
      </div>
    </main>
  )
}

function SummaryCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-36 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center">
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: number | string
  detail: string
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>

      <p className="mt-3 text-4xl font-black text-white">{value}</p>

      <p className="mt-2 text-xs font-semibold text-slate-500">
        {detail}
      </p>
    </article>
  )
}
