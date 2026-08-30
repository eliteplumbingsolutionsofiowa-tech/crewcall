'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const db = supabase as any

type AIRecruiterCommandCenterProps = {
  jobId: string
  jobTitle?: string | null
}

type RecruiterStatus = {
  recruiting: boolean
  complete: boolean
  startedAt: string | null
  lastInviteAt: string | null
  nextWorkerIndex: number
  inviteCount: number
  assignedWorkerId: string | null
}

type RecruiterStats = {
  matches: number
  strongMatches: number
  invites: number
  viewed: number
  accepted: number
  declined: number
  pending: number
}

type CurrentCandidate = {
  id: string
  name: string
  trade: string
  matchScore: number
  inviteStatus: string
  workerSeen: boolean
  invitedAt: string | null
}

type ActivityItem = {
  id: string
  label: string
  detail?: string
  timestamp?: string | null
}

const EMPTY_STATUS: RecruiterStatus = {
  recruiting: false,
  complete: false,
  startedAt: null,
  lastInviteAt: null,
  nextWorkerIndex: 0,
  inviteCount: 0,
  assignedWorkerId: null,
}

const EMPTY_STATS: RecruiterStats = {
  matches: 0,
  strongMatches: 0,
  invites: 0,
  viewed: 0,
  accepted: 0,
  declined: 0,
  pending: 0,
}

function formatElapsed(value: string | null) {
  if (!value) return 'Not started'

  const started = new Date(value).getTime()
  const elapsed = Math.max(0, Date.now() - started)
  const minutes = Math.floor(elapsed / 60000)

  if (minutes < 1) return 'Less than a minute'
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return remainingMinutes
    ? `${hours} hr ${remainingMinutes} min`
    : `${hours} hr`
}

function formatTime(value: string | null | undefined) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function normalizeStatus(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function statusLabel(
  status: RecruiterStatus,
  stats: RecruiterStats,
) {
  if (status.assignedWorkerId) return 'Position filled'
  if (status.complete) return 'Recruiting complete'
  if (status.recruiting) return 'Actively recruiting'
  if (stats.matches > 0) return 'Ready to recruit'
  return 'Matching required'
}

function statusDotClass(
  status: RecruiterStatus,
  stats: RecruiterStats,
) {
  if (status.assignedWorkerId) return 'bg-emerald-400'
  if (status.complete) return 'bg-violet-400'
  if (status.recruiting) return 'bg-cyan-400 animate-pulse'
  if (stats.matches > 0) return 'bg-amber-400'
  return 'bg-slate-500'
}

function percent(value: number, total: number) {
  if (!total) return 0
  return Math.min(100, Math.round((value / total) * 100))
}

export default function AIRecruiterCommandCenter({
  jobId,
  jobTitle,
}: AIRecruiterCommandCenterProps) {
  const [status, setStatus] =
    useState<RecruiterStatus>(EMPTY_STATUS)
  const [stats, setStats] =
    useState<RecruiterStats>(EMPTY_STATS)
  const [currentCandidate, setCurrentCandidate] =
    useState<CurrentCandidate | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [nowTick, setNowTick] = useState(Date.now())

  const loadCommandCenter = useCallback(async () => {
    try {
      setError('')

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setError('Sign in again to use AI recruiting.')
        return
      }

      const [
        statusResponse,
        matchesResult,
        invitesResult,
        eventsResult,
      ] = await Promise.all([
        fetch(`/api/jobs/${jobId}/auto-recruit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'status' }),
        }),
        db
          .from('job_matches')
          .select('worker_id, match_score, match_rank')
          .eq('job_id', jobId)
          .order('match_rank', { ascending: true }),
        db
          .from('job_invites')
          .select(
            `
              id,
              worker_id,
              status,
              worker_seen,
              company_seen,
              created_at
            `,
          )
          .eq('job_id', jobId)
          .order('created_at', { ascending: false }),
        db
          .from('ai_recruit_events')
          .select(
            `
              id,
              event_type,
              message,
              worker_id,
              metadata,
              created_at
            `,
          )
          .eq('job_id', jobId)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      const statusPayload = await statusResponse
        .json()
        .catch(() => null)

      if (!statusResponse.ok) {
        throw new Error(
          statusPayload?.error ||
            statusPayload?.message ||
            'Unable to load AI recruiter status.',
        )
      }

      if (matchesResult.error) {
        throw new Error(matchesResult.error.message)
      }

      if (invitesResult.error) {
        throw new Error(invitesResult.error.message)
      }

      if (eventsResult.error) {
        console.error(
          'AI recruiter event load error:',
          eventsResult.error,
        )
      }

      const matches = matchesResult.data || []
      const invites = invitesResult.data || []
      const recruiterEvents = eventsResult.data || []

      const nextStatus: RecruiterStatus = {
        recruiting: Boolean(statusPayload?.recruiting),
        complete: Boolean(statusPayload?.complete),
        startedAt: statusPayload?.startedAt || null,
        lastInviteAt: statusPayload?.lastInviteAt || null,
        nextWorkerIndex:
          Number(statusPayload?.nextWorkerIndex) || 0,
        inviteCount:
          Number(statusPayload?.inviteCount) ||
          invites.length,
        assignedWorkerId:
          statusPayload?.assignedWorkerId || null,
      }

      const accepted = invites.filter(
        (invite: any) =>
          normalizeStatus(invite.status) === 'accepted',
      ).length

      const declined = invites.filter(
        (invite: any) =>
          normalizeStatus(invite.status) === 'declined',
      ).length

      const pending = invites.filter(
        (invite: any) =>
          normalizeStatus(invite.status) === 'pending',
      ).length

      const viewed = invites.filter(
        (invite: any) => invite.worker_seen === true,
      ).length

      const nextStats: RecruiterStats = {
        matches: matches.length,
        strongMatches: matches.filter(
          (match: any) =>
            Number(match.match_score || 0) >= 80,
        ).length,
        invites: invites.length,
        viewed,
        accepted,
        declined,
        pending,
      }

      const latestInvite = invites[0] || null
      let candidate: CurrentCandidate | null = null

      if (latestInvite?.worker_id) {
        const match = matches.find(
          (item: any) =>
            item.worker_id === latestInvite.worker_id,
        )

        const { data: profile } = await db
          .from('profiles')
          .select('id, full_name, company_name, trade')
          .eq('id', latestInvite.worker_id)
          .maybeSingle()

        candidate = {
          id: latestInvite.worker_id,
          name:
            profile?.full_name?.trim() ||
            profile?.company_name?.trim() ||
            'CrewCall Worker',
          trade: profile?.trade || 'Skilled trades',
          matchScore:
            Number(match?.match_score || 0),
          inviteStatus:
            normalizeStatus(latestInvite.status) ||
            'pending',
          workerSeen:
            latestInvite.worker_seen === true,
          invitedAt:
            latestInvite.created_at || null,
        }
      }

      const activityItems: ActivityItem[] =
        recruiterEvents.length > 0
          ? recruiterEvents.map((event: any) => {
              const metadata =
                event.metadata &&
                typeof event.metadata === 'object'
                  ? event.metadata
                  : {}

              let detail = ''

              if (event.event_type === 'invite_sent') {
                const matchScore =
                  Number(metadata.matchScore) || 0
                const rank = Number(metadata.rank) || 0

                detail = [
                  rank ? `Rank #${rank}` : '',
                  matchScore
                    ? `${matchScore}% match`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' • ')
              } else if (
                event.event_type ===
                'recruiting_complete'
              ) {
                detail = `${
                  Number(metadata.totalMatches) || 0
                } total matches`
              } else if (
                event.event_type ===
                'no_matches_available'
              ) {
                detail =
                  'Run job matching to generate candidates.'
              } else if (
                event.event_type ===
                'position_filled'
              ) {
                detail =
                  'A worker has been assigned to the job.'
              }

              return {
                id: String(event.id),
                label:
                  event.message ||
                  String(event.event_type || '')
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (letter: string) =>
                      letter.toUpperCase(),
                    ),
                detail,
                timestamp: event.created_at || null,
              }
            })
          : []

      if (
        activityItems.length === 0 &&
        nextStatus.startedAt
      ) {
        activityItems.push({
          id: 'started',
          label: 'AI recruiting started',
          detail: jobTitle || 'Job recruiting campaign',
          timestamp: nextStatus.startedAt,
        })
      }

      if (
        activityItems.length === 0 &&
        matches.length > 0
      ) {
        activityItems.push({
          id: 'matches',
          label: `${matches.length} workers ranked`,
          detail: `${nextStats.strongMatches} strong matches`,
          timestamp: nextStatus.startedAt,
        })
      }

      if (activityItems.length === 0) {
        invites.slice(0, 6).forEach((invite: any) => {
          const inviteStatus =
            normalizeStatus(invite.status) || 'pending'

          activityItems.push({
          id: `invite-${invite.id}`,
          label:
            inviteStatus === 'accepted'
              ? 'Worker accepted invitation'
              : inviteStatus === 'declined'
                ? 'Worker declined invitation'
                : invite.worker_seen
                  ? 'Worker viewed invitation'
                  : 'Invitation sent',
          detail: invite.worker_seen
            ? 'Invite opened by worker'
            : 'Waiting for worker response',
            timestamp: invite.created_at,
          })
        })
      }

      if (
        activityItems.length === 0 &&
        nextStatus.complete &&
        !nextStatus.assignedWorkerId
      ) {
        activityItems.unshift({
          id: 'complete',
          label: 'Recruiting campaign complete',
          detail: 'All available matched workers were contacted.',
          timestamp: nextStatus.lastInviteAt,
        })
      }

      if (
        activityItems.length === 0 &&
        nextStatus.assignedWorkerId
      ) {
        activityItems.unshift({
          id: 'filled',
          label: 'Position filled',
          detail: 'A worker has been assigned to this job.',
          timestamp: nextStatus.lastInviteAt,
        })
      }

      setStatus(nextStatus)
      setStats(nextStats)
      setCurrentCandidate(candidate)
      setActivity(activityItems.slice(0, 8))
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load the AI Recruiter.',
      )
    } finally {
      setLoading(false)
    }
  }, [jobId, jobTitle])

  const sendAction = useCallback(
    async (
      action:
        | 'start'
        | 'pause'
        | 'stop'
        | 'restart'
        | 'send_next',
    ) => {
      setActionLoading(true)
      setError('')

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.access_token) {
          throw new Error(
            'Sign in again to use AI recruiting.',
          )
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

        const payload = await response
          .json()
          .catch(() => null)

        if (!response.ok) {
          throw new Error(
            payload?.error ||
              payload?.message ||
              'AI recruiting action failed.',
          )
        }

        await loadCommandCenter()
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : 'AI recruiting action failed.',
        )
      } finally {
        setActionLoading(false)
      }
    },
    [jobId, loadCommandCenter],
  )

  useEffect(() => {
    void loadCommandCenter()

    const refreshTimer = window.setInterval(() => {
      void loadCommandCenter()
    }, 30000)

    const elapsedTimer = window.setInterval(() => {
      setNowTick(Date.now())
    }, 30000)

    const channel = supabase
      .channel(`ai-recruiter-command-center-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_invites',
          filter: `job_id=eq.${jobId}`,
        },
        () => {
          void loadCommandCenter()
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`,
        },
        () => {
          void loadCommandCenter()
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_recruit_events',
          filter: `job_id=eq.${jobId}`,
        },
        () => {
          void loadCommandCenter()
        },
      )
      .subscribe()

    const handleRecruiterAdvanced = (event: Event) => {
      const customEvent = event as CustomEvent<{
        jobId?: string
      }>

      if (customEvent.detail?.jobId === jobId) {
        void loadCommandCenter()
      }
    }

    window.addEventListener(
      'crewcall-ai-recruiter-advanced',
      handleRecruiterAdvanced,
    )

    return () => {
      window.clearInterval(refreshTimer)
      window.clearInterval(elapsedTimer)
      window.removeEventListener(
        'crewcall-ai-recruiter-advanced',
        handleRecruiterAdvanced,
      )
      void supabase.removeChannel(channel)
    }
  }, [jobId, loadCommandCenter])

  const progress = useMemo(() => {
    if (status.assignedWorkerId) return 100
    if (!stats.matches) return 0

    return Math.min(
      95,
      Math.max(
        percent(stats.invites, stats.matches),
        status.recruiting ? 8 : 0,
      ),
    )
  }, [
    stats.invites,
    stats.matches,
    status.assignedWorkerId,
    status.recruiting,
  ])

  const primaryAction = useMemo(() => {
    if (status.assignedWorkerId) return null

    if (status.recruiting) {
      return {
        label: 'Pause recruiting',
        action: 'pause' as const,
      }
    }

    if (status.complete) {
      return {
        label: 'Restart recruiting',
        action: 'restart' as const,
      }
    }

    return {
      label:
        stats.invites > 0
          ? 'Resume recruiting'
          : 'Start recruiting',
      action: 'start' as const,
    }
  }, [
    stats.invites,
    status.assignedWorkerId,
    status.complete,
    status.recruiting,
  ])

  void nowTick

  return (
    <section className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-slate-950/80 shadow-2xl shadow-cyan-950/20">
      <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-violet-500/10 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              CrewCall AI Recruiter
            </p>

            <h2 className="mt-2 text-xl font-black text-white sm:text-2xl">
              Recruiting Command Center
            </h2>

            {jobTitle && (
              <p className="mt-1 text-sm text-slate-400">
                {jobTitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${statusDotClass(
                status,
                stats,
              )}`}
            />
            <span className="text-xs font-black uppercase tracking-[0.14em] text-white">
              {statusLabel(status, stats)}
            </span>
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-2 flex justify-between text-xs text-slate-400">
          <span>
            {status.startedAt
              ? `Running ${formatElapsed(status.startedAt)}`
              : 'Ready when you are'}
          </span>
          <span>{progress}% campaign progress</span>
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-6">
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
                AI Recruiter Status
              </p>
              <h3 className="mt-1 text-lg font-black text-white">
                {currentCandidate
                  ? currentCandidate.name
                  : 'Waiting for candidate'}
              </h3>
            </div>

            {currentCandidate && (
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-black text-cyan-200">
                {currentCandidate.matchScore}% Match
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Status
              </p>
              <p className="mt-1 font-black text-white">
                {statusLabel(status, stats)}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Attempts
              </p>
              <p className="mt-1 font-black text-white">
                {stats.invites}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Next Action
              </p>
              <p className="mt-1 font-black text-white">
                {status.recruiting
                  ? 'Monitoring response'
                  : 'Ready'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: 'Workers ranked',
                value: stats.matches,
              },
              {
                label: 'Strong matches',
                value: stats.strongMatches,
              },
              {
                label: 'Invites sent',
                value: stats.invites,
              },
              {
                label: 'Viewed',
                value: stats.viewed,
              },
              {
                label: 'Pending',
                value: stats.pending,
              },
              {
                label: 'Accepted',
                value: stats.accepted,
              },
              {
                label: 'Declined',
                value: stats.declined,
              },
              {
                label: 'Current rank',
                value:
                  status.nextWorkerIndex > 0
                    ? `#${status.nextWorkerIndex}`
                    : '—',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
              >
                <p className="text-2xl font-black text-white">
                  {loading ? '—' : item.value}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
                  Current candidate
                </p>
                <h3 className="mt-1 text-lg font-black text-white">
                  {currentCandidate
                    ? currentCandidate.name
                    : 'Waiting for next candidate'}
                </h3>
              </div>

              {currentCandidate && (
                <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-black text-cyan-200">
                  {currentCandidate.matchScore}% match
                </div>
              )}
            </div>

            {currentCandidate ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">
                    Trade
                  </p>
                  <p className="mt-1 font-bold text-white">
                    {currentCandidate.trade}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Invite status
                  </p>
                  <p className="mt-1 font-bold capitalize text-white">
                    {currentCandidate.inviteStatus}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Activity
                  </p>
                  <p className="mt-1 font-bold text-white">
                    {currentCandidate.workerSeen
                      ? 'Viewed invite'
                      : 'Awaiting response'}
                  </p>
                </div>

                <div className="sm:col-span-3">
                  <Link
                    href={`/profile/${currentCandidate.id}`}
                    className="inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:border-cyan-400/30 hover:bg-cyan-400/10"
                  >
                    View worker profile
                  </Link>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Start the recruiter to contact the highest-ranked
                available worker.
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-200">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {primaryAction && (
              <button
                type="button"
                disabled={actionLoading || loading}
                onClick={() =>
                  void sendAction(primaryAction.action)
                }
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading
                  ? 'Working...'
                  : primaryAction.label}
              </button>
            )}

            {!status.assignedWorkerId &&
              stats.matches > 0 && (
                <button
                  type="button"
                  disabled={actionLoading || loading}
                  onClick={() =>
                    void sendAction('send_next')
                  }
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:border-cyan-400/30 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send next invite
                </button>
              )}

            {status.recruiting && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void sendAction('stop')}
                className="rounded-xl border border-red-400/20 bg-red-400/10 px-5 py-3 text-sm font-black text-red-200 transition hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Stop campaign
              </button>
            )}

            <Link
              href={`/my-jobs/${jobId}/recruiter`}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:border-violet-400/30 hover:bg-violet-400/10"
            >
              Open full recruiter
            </Link>
          </div>
        </div>

        <aside className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="mb-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05] p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
              AI Recruiter Activity
            </p>

            <h3 className="mt-2 text-lg font-black text-white">
              {currentCandidate
                ? `Contacting ${currentCandidate.name}`
                : 'Waiting for candidate'}
            </h3>

            <div className="mt-4 grid gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Match Score
                </span>
                <span className="font-black text-white">
                  {currentCandidate
                    ? `${currentCandidate.matchScore}%`
                    : '—'}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Status
                </span>
                <span className="font-black text-white">
                  {statusLabel(status, stats)}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Candidates contacted
                </span>
                <span className="font-black text-white">
                  {stats.invites}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-violet-400/20 bg-violet-400/[0.05] p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">
              AI Recruiter Intelligence
            </p>

            <h3 className="mt-2 text-lg font-black text-white">
              Making the next hiring decision
            </h3>

            <div className="mt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Currently contacting
                </span>
                <span className="font-black text-white">
                  {currentCandidate
                    ? currentCandidate.name
                    : 'Searching'}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Why selected
                </span>
                <span className="font-black text-white">
                  Highest match
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Next candidate
                </span>
                <span className="font-black text-white">
                  Queued automatically
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">
                Live activity
              </p>
              <h3 className="mt-1 text-lg font-black text-white">
                Recruiter timeline
              </h3>
            </div>

            <button
              type="button"
              onClick={() => void loadCommandCenter()}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-slate-300 transition hover:bg-white/5"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {loading ? (
              <p className="text-sm text-slate-500">
                Loading recruiter activity...
              </p>
            ) : activity.length === 0 ? (
              <p className="text-sm leading-6 text-slate-500">
                Activity will appear here as the recruiter
                ranks and contacts workers.
              </p>
            ) : (
              activity.map((item, index) => (
                <div
                  key={item.id}
                  className="relative pl-7"
                >
                  {index < activity.length - 1 && (
                    <div className="absolute left-[7px] top-5 h-[calc(100%+8px)] w-px bg-white/10" />
                  )}

                  <div className="absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 border-slate-950 bg-cyan-400" />

                  <p className="text-sm font-black text-white">
                    {item.label}
                  </p>

                  {item.detail && (
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {item.detail}
                    </p>
                  )}

                  {item.timestamp && (
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">
                      {formatTime(item.timestamp)}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}