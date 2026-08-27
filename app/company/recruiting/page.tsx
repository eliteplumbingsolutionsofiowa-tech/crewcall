'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { resolveCompanyContext } from '@/lib/company-context'

type JobRow = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  status: string | null
  assigned_worker_id: string | null
  created_at: string | null
  ai_recruiting: boolean | null
  ai_recruiting_complete: boolean | null
  ai_recruiting_started_at: string | null
  ai_last_invite_at: string | null
  ai_next_worker_index: number | null
}

type InviteRow = {
  id: string
  job_id: string
  worker_id: string
  status: string | null
  worker_seen: boolean | null
  created_at: string | null
}

type MatchRow = {
  job_id: string
  worker_id: string
  match_score: number | null
  rank: number | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  company_name: string | null
}

type RecruitEventRow = {
  id: string
  job_id: string
  worker_id: string | null
  event_type: string
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
}

type QueueItem = {
  job: JobRow
  invites: InviteRow[]
  matches: MatchRow[]
  currentWorker: ProfileRow | null
  status:
    | 'recruiting'
    | 'waiting'
    | 'filled'
    | 'complete'
    | 'paused'
    | 'no_matches'
  currentMatchScore: number | null
  currentRank: number | null
}

type MetricCardProps = {
  label: string
  value: string | number
  detail: string
  icon: string
}

const INVITE_DELAY_MINUTES = 15

// AI recruiting columns may be newer than the generated Supabase types.
const db = supabase as any

function normalizeStatus(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function formatRelativeTime(
  value: string | null,
  locale: string,
  t: ReturnType<typeof useTranslations>,
) {
  if (!value) return t('never')

  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return t('unknown')

  const difference = Date.now() - timestamp
  const minutes = Math.max(0, Math.floor(difference / 60000))

  if (minutes < 1) return t('justNow')

  const formatter = new Intl.RelativeTimeFormat(locale, {
    numeric: 'always',
  })

  if (minutes < 60) {
    return formatter.format(-minutes, 'minute')
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return formatter.format(-hours, 'hour')
  }

  const days = Math.floor(hours / 24)
  return formatter.format(-days, 'day')
}

function formatDuration(
  milliseconds: number | null,
  locale: string,
) {
  if (!milliseconds || milliseconds <= 0) return '—'

  const minutes = Math.round(milliseconds / 60000)

  if (minutes < 60) {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'minute',
      unitDisplay: 'short',
    }).format(minutes)
  }

  const hours = minutes / 60
  const roundedHours =
    hours >= 10
      ? Math.round(hours)
      : Math.round(hours * 10) / 10

  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'hour',
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(roundedHours)
}

function getProfileName(
  profile: ProfileRow | null,
  t?: ReturnType<typeof useTranslations>,
) {
  return (
    profile?.full_name?.trim() ||
    profile?.company_name?.trim() ||
    (t ? t('crewCallWorker') : 'CrewCall Worker')
  )
}

function getQueueStatus(
  job: JobRow,
  matches: MatchRow[],
): QueueItem['status'] {
  if (job.assigned_worker_id) return 'filled'

  if (job.ai_recruiting_complete) {
    return matches.length === 0 ? 'no_matches' : 'complete'
  }

  if (job.ai_recruiting) {
    if (!job.ai_last_invite_at) return 'recruiting'

    const elapsed =
      Date.now() - new Date(job.ai_last_invite_at).getTime()

    if (
      Number.isFinite(elapsed) &&
      elapsed < INVITE_DELAY_MINUTES * 60 * 1000
    ) {
      return 'waiting'
    }

    return 'recruiting'
  }

  return 'paused'
}

function getStatusPresentation(status: QueueItem['status']) {
  switch (status) {
    case 'recruiting':
      return {
        labelKey: 'statusRecruiting',
        classes:
          'border-green-400/25 bg-green-400/10 text-green-200',
        dot: 'bg-green-300',
      }
    case 'waiting':
      return {
        labelKey: 'statusWaiting',
        classes:
          'border-amber-400/25 bg-amber-400/10 text-amber-200',
        dot: 'bg-amber-300',
      }
    case 'filled':
      return {
        labelKey: 'statusFilled',
        classes:
          'border-cyan-400/25 bg-cyan-400/10 text-cyan-200',
        dot: 'bg-cyan-300',
      }
    case 'complete':
      return {
        labelKey: 'statusComplete',
        classes:
          'border-blue-400/25 bg-blue-400/10 text-blue-200',
        dot: 'bg-blue-300',
      }
    case 'no_matches':
      return {
        labelKey: 'statusNoMatches',
        classes:
          'border-red-400/25 bg-red-400/10 text-red-200',
        dot: 'bg-red-300',
      }
    default:
      return {
        labelKey: 'statusPaused',
        classes:
          'border-slate-400/20 bg-white/[0.04] text-slate-300',
        dot: 'bg-slate-400',
      }
  }
}

function MetricCard({
  label,
  value,
  detail,
  icon,
}: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>
          <p className="mt-3 text-3xl font-black text-white">
            {value}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-400">
            {detail}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] text-xl">
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function CompanyRecruitingPage() {
  const t = useTranslations('CompanyRecruiting')
  const locale = useLocale()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [events, setEvents] = useState<RecruitEventRow[]>([])
  const [busyJobId, setBusyJobId] = useState<string | null>(null)

  const loadDashboard = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError('')

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) throw sessionError
        if (!session?.user) {
          throw new Error(t('loginRequired'))
        }

        const companyContext = await resolveCompanyContext(
          supabase,
          session.user.id,
        )

        if (!companyContext.companyId) {
          throw new Error(
            t('companyRequired'),
          )
        }

        const resolvedCompanyId = companyContext.companyId
        setCompanyId(resolvedCompanyId)

        const { data: jobsData, error: jobsError } =
          await db
            .from('jobs')
            .select(`
              id,
              title,
              trade,
              location,
              status,
              assigned_worker_id,
              created_at,
              ai_recruiting,
              ai_recruiting_complete,
              ai_recruiting_started_at,
              ai_last_invite_at,
              ai_next_worker_index
            `)
            .eq('company_id', resolvedCompanyId)
            .order('created_at', { ascending: false })

        if (jobsError) throw jobsError

        const nextJobs = (jobsData || []) as unknown as JobRow[]
        const jobIds = nextJobs.map((job) => job.id)

        if (jobIds.length === 0) {
          setJobs([])
          setInvites([])
          setMatches([])
          setProfiles([])
          setEvents([])
          return
        }

        const [
          invitesResult,
          matchesResult,
          eventsResult,
        ] = await Promise.all([
          db
            .from('job_invites')
            .select(`
              id,
              job_id,
              worker_id,
              status,
              worker_seen,
              created_at
            `)
            .in('job_id', jobIds)
            .order('created_at', { ascending: false }),

          db
            .from('job_matches')
            .select(`
              job_id,
              worker_id,
              match_score
            `)
            .in('job_id', jobIds),

          db
            .from('ai_recruit_events')
            .select(`
              id,
              job_id,
              worker_id,
              event_type,
              message,
              metadata,
              created_at
            `)
            .in('job_id', jobIds)
            .order('created_at', { ascending: false })
            .limit(250),
        ])

        if (invitesResult.error) {
          console.warn(
            'Recruiting invites unavailable:',
            invitesResult.error.message,
          )
        }

        if (matchesResult.error) {
          console.warn(
            'Recruiting matches unavailable:',
            matchesResult.error.message,
          )
        }

        if (eventsResult.error) {
          console.warn(
            'Recruiter events unavailable:',
            eventsResult.error.message,
          )
        }

        const nextInvites = invitesResult.error
          ? []
          : ((invitesResult.data || []) as unknown as InviteRow[])

        const nextMatches = matchesResult.error
          ? []
          : ((matchesResult.data || []) as unknown as MatchRow[])

        const nextEvents = eventsResult.error
          ? []
          : ((eventsResult.data || []) as unknown as RecruitEventRow[])

        const workerIds = Array.from(
          new Set([
            ...nextInvites.map((invite) => invite.worker_id),
            ...nextMatches.map((match) => match.worker_id),
            ...nextJobs
              .map((job) => job.assigned_worker_id)
              .filter(Boolean),
          ]),
        ) as string[]

        let nextProfiles: ProfileRow[] = []

        if (workerIds.length > 0) {
          const { data: profilesData, error: profilesError } =
            await db
              .from('profiles')
              .select('id, full_name, company_name')
              .in('id', workerIds)

          if (profilesError) {
            console.warn(
              'Recruiting worker profiles unavailable:',
              profilesError.message,
            )
          } else {
            nextProfiles = (profilesData || []) as unknown as ProfileRow[]
          }
        }

        setJobs(nextJobs)
        setInvites(nextInvites)
        setMatches(nextMatches)
        setProfiles(nextProfiles)
        setEvents(nextEvents)
      } catch (caughtError: unknown) {
        const errorRecord =
          caughtError &&
          typeof caughtError === 'object'
            ? (caughtError as Record<string, unknown>)
            : null

        const errorMessage =
          caughtError instanceof Error
            ? caughtError.message
            : typeof errorRecord?.message === 'string'
              ? errorRecord.message
              : typeof errorRecord?.details === 'string'
                ? errorRecord.details
                : typeof caughtError === 'string'
                  ? caughtError
                  : t('loadFailed')

        console.error(
          'Recruiting dashboard load failed:',
          errorMessage,
          errorRecord,
        )

        setError(errorMessage)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void loadDashboard()

    const channel = supabase
      .channel('company-recruiting-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
        },
        () => {
          void loadDashboard(true)
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_invites',
        },
        () => {
          void loadDashboard(true)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_recruit_events',
        },
        () => {
          void loadDashboard(true)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadDashboard])

  const profileById = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [profile.id, profile]),
      ),
    [profiles],
  )

  const queueItems = useMemo<QueueItem[]>(() => {
    return jobs
      .filter((job) => {
        const status = normalizeStatus(job.status)

        return (
          job.ai_recruiting ||
          job.ai_recruiting_complete ||
          Boolean(job.assigned_worker_id) ||
          ['open', 'assigned', 'in_progress'].includes(status)
        )
      })
      .map((job) => {
        const jobInvites = invites.filter(
          (invite) => invite.job_id === job.id,
        )
        const jobMatches = matches
          .filter((match) => match.job_id === job.id)
          .sort(
            (a, b) =>
              (Number(a.rank) || 999999) -
              (Number(b.rank) || 999999),
          )

        const currentIndex = Math.max(
          0,
          Number(job.ai_next_worker_index) - 1 || 0,
        )

        const currentMatch =
          jobMatches[currentIndex] ||
          jobMatches.find(
            (match) =>
              !jobInvites.some(
                (invite) =>
                  invite.worker_id === match.worker_id,
              ),
          ) ||
          null

        const currentWorkerId =
          job.assigned_worker_id ||
          currentMatch?.worker_id ||
          jobInvites[0]?.worker_id ||
          null

        return {
          job,
          invites: jobInvites,
          matches: jobMatches,
          currentWorker: currentWorkerId
            ? profileById.get(currentWorkerId) || null
            : null,
          status: getQueueStatus(job, jobMatches),
          currentMatchScore: currentMatch
            ? Number(currentMatch.match_score) || 0
            : null,
          currentRank: currentMatch
            ? Number(currentMatch.rank) || currentIndex + 1
            : null,
        }
      })
      .sort((a, b) => {
        const order: Record<QueueItem['status'], number> = {
          recruiting: 0,
          waiting: 1,
          paused: 2,
          no_matches: 3,
          complete: 4,
          filled: 5,
        }

        return order[a.status] - order[b.status]
      })
  }, [invites, jobs, matches, profileById])

  const metrics = useMemo(() => {
    const activeRecruiters = jobs.filter(
      (job) => job.ai_recruiting,
    ).length

    const acceptedInvites = invites.filter(
      (invite) =>
        normalizeStatus(invite.status) === 'accepted',
    ).length

    const respondedInvites = invites.filter((invite) =>
      ['accepted', 'declined'].includes(
        normalizeStatus(invite.status),
      ),
    ).length

    const acceptanceRate =
      respondedInvites > 0
        ? Math.round(
            (acceptedInvites / respondedInvites) * 100,
          )
        : 0

    const filledJobs = jobs.filter(
      (job) => job.assigned_worker_id,
    )

    const fillDurations = filledJobs
      .map((job) => {
        const start = job.ai_recruiting_started_at
          ? new Date(job.ai_recruiting_started_at).getTime()
          : null

        const fillEvent = events.find(
          (event) =>
            event.job_id === job.id &&
            event.event_type === 'position_filled',
        )

        const end = fillEvent
          ? new Date(fillEvent.created_at).getTime()
          : null

        if (
          !start ||
          !end ||
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          end <= start
        ) {
          return null
        }

        return end - start
      })
      .filter(
        (value): value is number =>
          typeof value === 'number',
      )

    const averageFillTime =
      fillDurations.length > 0
        ? fillDurations.reduce(
            (total, value) => total + value,
            0,
          ) / fillDurations.length
        : null

    const topScore =
      matches.length > 0
        ? Math.max(
            ...matches.map(
              (match) => Number(match.match_score) || 0,
            ),
          )
        : 0

    return {
      activeRecruiters,
      filledJobs: filledJobs.length,
      totalInvites: invites.length,
      acceptanceRate,
      averageFillTime,
      topScore,
    }
  }, [events, invites, jobs, matches])

  const recentEvents = useMemo(
    () => events.slice(0, 12),
    [events],
  )

  async function runRecruitAction(
    jobId: string,
    action:
      | 'start'
      | 'pause'
      | 'restart'
      | 'send_next',
  ) {
    setBusyJobId(jobId)
    setError('')
    setMessage('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error(t('sessionExpired'))
      }

      const response = await fetch(
        `/api/jobs/${jobId}/auto-recruit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action }),
        },
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result?.error ||
            result?.message ||
            t('actionFailed'),
        )
      }

      setMessage(
        result?.message || t('updatedSuccessfully'),
      )

      await loadDashboard(true)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t('actionFailed'),
      )
    } finally {
      setBusyJobId(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">
              {t('aiRecruiting')}
            </p>
            <p className="mt-3 text-2xl font-black">
              {t('loading')}
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.08] via-slate-900 to-slate-950 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                  {t('intelligence')}
                </p>

                {refreshing && (
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">
                    {t('updating')}
                  </span>
                )}
              </div>

              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                {t('title')}
              </h1>

              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
                {t('description')}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void loadDashboard(true)}
                disabled={refreshing}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing ? t('refreshing') : t('refresh')}
              </button>

              <Link
                href="/company/operations"
                className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
              >
                {t('operations')}
              </Link>
            </div>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-green-400/20 bg-green-400/[0.07] px-5 py-4 text-sm font-bold text-green-200">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-5 py-4 text-sm font-bold text-red-200">
            {error}
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label={t('activeRecruiters')}
            value={metrics.activeRecruiters}
            detail={t('activeRecruitersDetail')}
            icon="⚡"
          />

          <MetricCard
            label={t('jobsFilled')}
            value={metrics.filledJobs}
            detail={t('jobsFilledDetail')}
            icon="✅"
          />

          <MetricCard
            label={t('invitesSent')}
            value={metrics.totalInvites}
            detail={t('invitesSentDetail')}
            icon="📨"
          />

          <MetricCard
            label={t('acceptanceRate')}
            value={`${metrics.acceptanceRate}%`}
            detail={t('acceptanceRateDetail')}
            icon="📈"
          />

          <MetricCard
            label={t('averageFillTime')}
            value={formatDuration(metrics.averageFillTime, locale)}
            detail={t('averageFillTimeDetail')}
            icon="⏱️"
          />

          <MetricCard
            label={t('topMatchScore')}
            value={`${metrics.topScore}%`}
            detail={t('topMatchScoreDetail')}
            icon="🎯"
          />
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
                {t('live')} {t('recruiterQueue')}
              </p>
              <h2 className="mt-1 text-xl font-black">
                {t('automatedRecruitingJobs')}
              </h2>
            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-black text-slate-300">
              {t('jobsCount', { count: queueItems.length })}
            </span>
          </div>

          {queueItems.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-xl font-black text-white">
                {t('noRecruitingJobs')}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-400">
                {t('noRecruitingJobsDescription')}
              </p>
              <Link
                href="/company/operations"
                className="mt-5 inline-flex rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950"
              >
                {t('openOperations')}
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {queueItems.map((item) => {
                const statusPresentation =
                  getStatusPresentation(item.status)
                const busy = busyJobId === item.job.id
                const assigned =
                  Boolean(item.job.assigned_worker_id)

                return (
                  <article
                    key={item.job.id}
                    className="px-5 py-5 sm:px-6"
                  >
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(110px,0.55fr))_auto] xl:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/my-jobs/${item.job.id}`}
                            className="truncate text-base font-black text-white hover:text-cyan-200"
                          >
                            {item.job.title?.trim() ||
                              t('untitledJob')}
                          </Link>

                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusPresentation.classes}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${statusPresentation.dot}`}
                            />
                            {t(statusPresentation.labelKey)}
                          </span>
                        </div>

                        <p className="mt-2 truncate text-xs font-semibold text-slate-400">
                          {[item.job.trade, item.job.location]
                            .filter(Boolean)
                            .join(' • ') || t('jobDetailsUnavailable')}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                          {t('currentWorker')}
                        </p>
                        <p className="mt-1 truncate text-sm font-black text-white">
                          {item.currentWorker
                            ? getProfileName(item.currentWorker, t)
                            : '—'}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                          {t('match')}
                        </p>
                        <p className="mt-1 text-sm font-black text-white">
                          {item.currentMatchScore !== null
                            ? `${item.currentMatchScore}%`
                            : '—'}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                          {t('invites')}
                        </p>
                        <p className="mt-1 text-sm font-black text-white">
                          {item.invites.length}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                          {t('lastInvite')}
                        </p>
                        <p className="mt-1 text-sm font-black text-white">
                          {formatRelativeTime(
                            item.job.ai_last_invite_at,
                            locale,
                            t,
                          )}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        {!assigned &&
                          !item.job.ai_recruiting && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void runRecruitAction(
                                  item.job.id,
                                  item.job.ai_recruiting_complete
                                    ? 'restart'
                                    : 'start',
                                )
                              }
                              className="rounded-lg bg-green-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-green-200 disabled:opacity-50"
                            >
                              {item.job.ai_recruiting_complete
                                ? t('restart')
                                : t('start')}
                            </button>
                          )}

                        {!assigned &&
                          item.job.ai_recruiting && (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runRecruitAction(
                                    item.job.id,
                                    'pause',
                                  )
                                }
                                className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-200 transition hover:bg-amber-400/15 disabled:opacity-50"
                              >
                                {t('pause')}
                              </button>

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runRecruitAction(
                                    item.job.id,
                                    'send_next',
                                  )
                                }
                                className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-xs font-black text-cyan-200 transition hover:bg-cyan-400/15 disabled:opacity-50"
                              >
                                {t('sendNext')}
                              </button>
                            </>
                          )}

                        <Link
                          href={`/my-jobs/${item.job.id}`}
                          className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-black text-white transition hover:bg-white/[0.1]"
                        >
                          {t('view')}
                        </Link>
                      </div>
                    </div>

                    {busy && (
                      <p className="mt-3 text-xs font-bold text-cyan-300">
                        {t('updatingRecruiter')}
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-1">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
                  {t('recruitingActivity')}
                </p>
                <h2 className="mt-1 text-xl font-black">
                  {t('latestAiActions')}
                </h2>
              </div>

              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-black text-slate-400">
                {t('live')}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {recentEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center">
                  <p className="text-sm font-bold text-slate-400">
                    {t('activityEmpty')}
                  </p>
                </div>
              ) : (
                recentEvents.map((event) => {
                  const job = jobs.find(
                    (candidate) =>
                      candidate.id === event.job_id,
                  )

                  return (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-black text-white">
                            {event.message}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            {job?.title?.trim() ||
                              t('recruitingJob')}
                          </p>
                        </div>

                        <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                          {formatRelativeTime(event.created_at, locale, t)}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
              {t('recruiterHealth')}
            </p>
            <h2 className="mt-1 text-xl font-black">
              {t('systemOverview')}
            </h2>

            <div className="mt-5 space-y-4">
              {[
                {
                  label: t('activeJobs'),
                  value: metrics.activeRecruiters,
                },
                {
                  label: t('waitingForDelay'),
                  value: queueItems.filter(
                    (item) => item.status === 'waiting',
                  ).length,
                },
                {
                  label: t('statusPaused'),
                  value: queueItems.filter(
                    (item) => item.status === 'paused',
                  ).length,
                },
                {
                  label: t('statusNoMatches'),
                  value: queueItems.filter(
                    (item) =>
                      item.status === 'no_matches',
                  ).length,
                },
                {
                  label: t('completed'),
                  value: queueItems.filter((item) =>
                    ['complete', 'filled'].includes(
                      item.status,
                    ),
                  ).length,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3"
                >
                  <span className="text-sm font-bold text-slate-400">
                    {item.label}
                  </span>
                  <span className="text-lg font-black text-white">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-3 pb-8">
          <Link
            href="/company/dashboard"
            className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-white transition hover:bg-white/[0.1]"
          >
            {t('companyDashboard')}
          </Link>

          <Link
            href="/company/operations"
            className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] px-4 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-400/[0.12]"
          >
            {t('operationsCenter')}
          </Link>
        </div>
      </div>
    </main>
  )
}