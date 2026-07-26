'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  status: string | null
  company_id: string
}

type WorkerProfile = {
  id: string
  full_name: string | null
  company_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  years_experience: string | number | null
  availability_status: string | null
  available_for_work: boolean | null
  currently_working: boolean | null
  booked_until: string | null
  willing_to_travel: boolean | null
  travel_radius: number | null
  expected_pay_min: number | null
  expected_pay_max: number | null
  crewcall_score: number | null
  skills: string[] | null
  preferred_work: string[] | null
  osha10: boolean | null
  osha30: boolean | null
  med_gas: boolean | null
  background_verified: boolean | null
  drug_tested: boolean | null
  license_number: string | null
  liability_form_signed: boolean | null
  insurance_provider: string | null
  is_online: boolean | null
  last_seen: string | null
}

type AiMatch = {
  job_id: string
  worker_id: string
  rank: number
  match_score: number
  match_label: string
  trade_score: number
  location_score: number
  availability_score: number
  certification_score: number
  online_score: number
  pay_score: number
  reason: string
  match_reasons: string[]
  warnings: string[]
  worker: WorkerProfile
}

type MatchResponse = {
  success?: boolean
  error?: string
  jobId?: string
  jobTitle?: string | null
  totalWorkersReviewed?: number
  matchesCreated?: number
  excellentMatches?: number
  strongMatches?: number
  matches?: AiMatch[]
}

type InviteResponse = {
  success?: boolean
  error?: string
  message?: string
  alreadyInvited?: boolean
}

function workerName(worker: WorkerProfile) {
  return (
    worker.full_name?.trim() ||
    worker.company_name?.trim() ||
    'CrewCall Worker'
  )
}

function formatStatus(value: string | null | undefined) {
  if (!value) return 'Not listed'

  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatPayRange(worker: WorkerProfile) {
  const minimum = Number(worker.expected_pay_min || 0)
  const maximum = Number(worker.expected_pay_max || 0)

  if (minimum > 0 && maximum > 0) {
    return `$${minimum.toLocaleString()}–$${maximum.toLocaleString()}`
  }

  if (minimum > 0) {
    return `From $${minimum.toLocaleString()}`
  }

  if (maximum > 0) {
    return `Up to $${maximum.toLocaleString()}`
  }

  return 'Not listed'
}

function matchTone(score: number) {
  if (score >= 90) {
    return {
      ring: 'border-emerald-400/40',
      background: 'bg-emerald-400/10',
      text: 'text-emerald-200',
      badge: 'bg-emerald-400/20 text-emerald-100',
    }
  }

  if (score >= 80) {
    return {
      ring: 'border-cyan-400/40',
      background: 'bg-cyan-400/10',
      text: 'text-cyan-200',
      badge: 'bg-cyan-400/20 text-cyan-100',
    }
  }

  if (score >= 70) {
    return {
      ring: 'border-blue-400/30',
      background: 'bg-blue-400/10',
      text: 'text-blue-200',
      badge: 'bg-blue-400/20 text-blue-100',
    }
  }

  return {
    ring: 'border-white/10',
    background: 'bg-white/5',
    text: 'text-slate-200',
    badge: 'bg-white/10 text-slate-200',
  }
}

export default function AiWorkerMatchesPage() {
  const params = useParams()
  const jobId = String(params?.id || '')

  const [job, setJob] = useState<Job | null>(null)
  const [matches, setMatches] = useState<AiMatch[]>([])
  const [hiddenWorkerIds, setHiddenWorkerIds] = useState<string[]>([])
  const [invitedWorkerIds, setInvitedWorkerIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [matching, setMatching] = useState(false)
  const [actionWorkerId, setActionWorkerId] = useState<string | null>(null)
  const [bulkInviting, setBulkInviting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [totalWorkersReviewed, setTotalWorkersReviewed] = useState(0)

  const visibleMatches = useMemo(
    () =>
      matches.filter(
        (match) => !hiddenWorkerIds.includes(match.worker_id)
      ),
    [hiddenWorkerIds, matches]
  )

  const recommendedMatches = useMemo(
    () =>
      visibleMatches
        .filter(
          (match) =>
            match.match_score >= 70 &&
            !invitedWorkerIds.includes(match.worker_id)
        )
        .slice(0, 3),
    [invitedWorkerIds, visibleMatches]
  )

  const excellentMatchCount = useMemo(
    () =>
      visibleMatches.filter((match) => match.match_score >= 90).length,
    [visibleMatches]
  )

  const strongMatchCount = useMemo(
    () =>
      visibleMatches.filter(
        (match) =>
          match.match_score >= 80 &&
          match.match_score < 90
      ).length,
    [visibleMatches]
  )

  const goodMatchCount = useMemo(
    () =>
      visibleMatches.filter(
        (match) =>
          match.match_score >= 70 &&
          match.match_score < 80
      ).length,
    [visibleMatches]
  )

  useEffect(() => {
    if (!jobId) return

    loadPage()
  }, [jobId])

  async function loadPage() {
    setLoading(true)
    setError('')
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError('You must be logged in to use AI worker matching.')
      setLoading(false)
      return
    }

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, trade, location, status, company_id')
      .eq('id', jobId)
      .maybeSingle()

    if (jobError) {
      setError(jobError.message)
      setLoading(false)
      return
    }

    if (!jobData) {
      setError('Job not found.')
      setLoading(false)
      return
    }

    if (jobData.company_id !== user.id) {
      setError('You do not have permission to match workers for this job.')
      setLoading(false)
      return
    }

    setJob(jobData as Job)
    setLoading(false)

    await runMatching(false)
  }

  async function runMatching(showSuccessMessage = true) {
    setMatching(true)
    setError('')

    if (showSuccessMessage) {
      setMessage('')
    }

    const response = await fetch('/api/jobs/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jobId,
      }),
    })

    const result = (await response.json().catch(() => null)) as
      | MatchResponse
      | null

    if (!response.ok || !result?.success) {
      setError(result?.error || 'Unable to run AI worker matching.')
      setMatches([])
      setMatching(false)
      return
    }

    setMatches(result.matches || [])
    setTotalWorkersReviewed(result.totalWorkersReviewed || 0)
    setHiddenWorkerIds([])

    if (showSuccessMessage) {
      setMessage(
        `AI reviewed ${result.totalWorkersReviewed || 0} workers and found ${
          result.matchesCreated || 0
        } possible matches.`
      )
    }

    setMatching(false)
  }

  async function inviteWorker(match: AiMatch) {
    const name = workerName(match.worker)

    const confirmed = window.confirm(
      `Invite ${name} to ${job?.title || 'this job'}?`
    )

    if (!confirmed) return

    setActionWorkerId(match.worker_id)
    setError('')
    setMessage('')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setError('Your login session expired. Please log in again.')
      setActionWorkerId(null)
      return
    }

    const response = await fetch(`/api/jobs/${jobId}/invite`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workerId: match.worker_id,
      }),
    })

    const result = (await response.json().catch(() => null)) as
      | InviteResponse
      | null

    if (!response.ok || !result?.success) {
      setError(result?.error || 'Unable to invite worker.')
      setActionWorkerId(null)
      return
    }

    setInvitedWorkerIds((current) =>
      current.includes(match.worker_id)
        ? current
        : [...current, match.worker_id]
    )

    setMessage(
      result.alreadyInvited
        ? `${name} already has a pending invitation.`
        : `${name} was invited successfully.`
    )

    window.dispatchEvent(new Event('crewcall-refresh-nav'))
    setActionWorkerId(null)
  }

  async function inviteRecommendedWorkers() {
    if (recommendedMatches.length === 0) {
      setMessage('There are no uninvited recommended workers right now.')
      return
    }

    const names = recommendedMatches
      .map((match) => workerName(match.worker))
      .join(', ')

    const confirmed = window.confirm(
      `Invite these recommended workers to ${
        job?.title || 'this job'
      }?\n\n${names}`
    )

    if (!confirmed) return

    setBulkInviting(true)
    setError('')
    setMessage('')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setError('Your login session expired. Please log in again.')
      setBulkInviting(false)
      return
    }

    const newlyInvitedIds: string[] = []
    const failedNames: string[] = []

    for (const match of recommendedMatches) {
      try {
        const response = await fetch(`/api/jobs/${jobId}/invite`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workerId: match.worker_id,
          }),
        })

        const result = (await response.json().catch(() => null)) as
          | InviteResponse
          | null

        if (response.ok && result?.success) {
          newlyInvitedIds.push(match.worker_id)
        } else {
          failedNames.push(workerName(match.worker))
        }
      } catch {
        failedNames.push(workerName(match.worker))
      }
    }

    if (newlyInvitedIds.length > 0) {
      setInvitedWorkerIds((current) =>
        Array.from(new Set([...current, ...newlyInvitedIds]))
      )
    }

    if (failedNames.length === 0) {
      setMessage(
        `${newlyInvitedIds.length} recommended worker${
          newlyInvitedIds.length === 1 ? '' : 's'
        } invited successfully.`
      )
    } else {
      setMessage(
        `${newlyInvitedIds.length} invitation${
          newlyInvitedIds.length === 1 ? '' : 's'
        } sent. Could not invite: ${failedNames.join(', ')}.`
      )
    }

    window.dispatchEvent(new Event('crewcall-refresh-nav'))
    setBulkInviting(false)
  }

  function hideWorker(workerId: string) {
    setHiddenWorkerIds((current) =>
      current.includes(workerId)
        ? current
        : [...current, workerId]
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black">
            Loading AI worker matching...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link
                href={`/my-jobs/${jobId}/applicants`}
                className="text-sm font-black text-cyan-300 transition hover:text-cyan-200"
              >
                ← Back to Applicants
              </Link>

              <p className="mt-6 text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                CrewCall AI Recruiting
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-6xl">
                AI Worker Matches
              </h1>

              <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-300 md:text-base">
                CrewCall ranks available workers using trade, skills,
                location, availability, credentials, activity, pay
                compatibility, experience, and reputation.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => runMatching(true)}
                disabled={matching}
                className="rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-7 py-4 text-sm font-black text-slate-950 shadow-xl transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {matching
                  ? 'Analyzing Workers...'
                  : 'Run AI Matching Again'}
              </button>

              <Link
                href={`/my-jobs/${jobId}/recruiter`}
                className="rounded-2xl border border-purple-300/30 bg-purple-400/15 px-7 py-4 text-center text-sm font-black text-purple-100 transition hover:bg-purple-400/25"
              >
                🤖 Open AI Recruiter
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-3xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-sm font-bold text-cyan-100">
            {message}
          </div>
        )}

        {job && (
          <section className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-6 shadow-xl md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Matching Workers For
                </p>

                <h2 className="mt-3 text-3xl font-black text-white">
                  {job.title || 'Untitled Job'}
                </h2>

                <p className="mt-3 text-sm font-semibold text-slate-300">
                  {[job.trade, job.location]
                    .filter(Boolean)
                    .join(' • ') || 'Trade and location not listed'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard
                  label="Reviewed"
                  value={totalWorkersReviewed}
                />
                <StatCard
                  label="Matches"
                  value={matches.length}
                />
                <StatCard
                  label="80%+"
                  value={
                    matches.filter((match) => match.match_score >= 80)
                      .length
                  }
                />
              </div>
            </div>
          </section>
        )}

        {matches.length > 0 && (
          <section className="overflow-hidden rounded-[2rem] border border-purple-400/25 bg-gradient-to-br from-purple-500/15 via-blue-500/10 to-cyan-500/10 shadow-2xl backdrop-blur">
            <div className="p-6 md:p-8">
              <div className="flex flex-col gap-7 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-4xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-400/20 text-2xl ring-1 ring-purple-300/20">
                      🤖
                    </span>

                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.25em] text-purple-200">
                        CrewCall AI Hiring Assistant
                      </p>

                      <h2 className="mt-1 text-3xl font-black text-white">
                        Hiring Recommendation
                      </h2>
                    </div>
                  </div>

                  <p className="mt-6 text-base font-semibold leading-7 text-slate-200">
                    CrewCall reviewed {totalWorkersReviewed} worker
                    {totalWorkersReviewed === 1 ? '' : 's'} for{' '}
                    <span className="font-black text-white">
                      {job?.title || 'this job'}
                    </span>
                    .
                    {recommendedMatches.length > 0
                      ? ` Invite the top ${recommendedMatches.length} recommended worker${
                          recommendedMatches.length === 1 ? '' : 's'
                        } first. They have the strongest combination of trade fit, availability, location, credentials, activity, pay compatibility, experience, and CrewCall reputation.`
                      : ' No workers currently meet the recommended 70% match threshold. Review the possible matches below or improve the job details and run matching again.'}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <AssistantStat
                      label="Excellent"
                      value={excellentMatchCount}
                      description="90% or higher"
                    />

                    <AssistantStat
                      label="Strong"
                      value={strongMatchCount}
                      description="80%–89%"
                    />

                    <AssistantStat
                      label="Good"
                      value={goodMatchCount}
                      description="70%–79%"
                    />
                  </div>

                  {recommendedMatches.length > 0 && (
                    <div className="mt-7">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                        Recommended first
                      </p>

                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        {recommendedMatches.map((match) => (
                          <div
                            key={`recommended-${match.worker_id}`}
                            className="rounded-3xl border border-white/10 bg-slate-950/40 p-5"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="truncate text-lg font-black text-white">
                                  {workerName(match.worker)}
                                </p>

                                <p className="mt-1 text-sm font-semibold text-slate-400">
                                  {match.worker.trade || 'Trade not listed'}
                                </p>
                              </div>

                              <span className="shrink-0 rounded-full bg-cyan-400/20 px-3 py-1 text-sm font-black text-cyan-100">
                                {match.match_score}%
                              </span>
                            </div>

                            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-emerald-200">
                              {match.match_label}
                            </p>

                            {match.match_reasons[0] && (
                              <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
                                ✓ {match.match_reasons[0]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="w-full shrink-0 xl:w-72">
                  <button
                    type="button"
                    onClick={inviteRecommendedWorkers}
                    disabled={
                      bulkInviting ||
                      recommendedMatches.length === 0
                    }
                    className="w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-4 text-sm font-black text-slate-950 shadow-xl transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {bulkInviting
                      ? 'Sending Invitations...'
                      : recommendedMatches.length > 0
                        ? `Invite Top ${recommendedMatches.length}`
                        : 'No Recommended Invites'}
                  </button>

                  <p className="mt-4 text-center text-xs font-semibold leading-5 text-slate-400">
                    CrewCall sends each selected worker a job invitation
                    and notification.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {matching && matches.length === 0 ? (
          <div className="rounded-[2rem] border border-cyan-400/20 bg-cyan-400/10 p-10 text-center shadow-2xl">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-cyan-200/20 border-t-cyan-300" />

            <h2 className="mt-6 text-2xl font-black text-white">
              Analyzing CrewCall workers
            </h2>

            <p className="mt-3 text-sm font-semibold text-slate-300">
              Comparing trade, skills, location, availability,
              credentials, pay, activity, and reputation.
            </p>
          </div>
        ) : visibleMatches.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-10 text-center shadow-2xl backdrop-blur">
            <h2 className="text-3xl font-black text-white">
              No visible matches
            </h2>

            <p className="mt-3 text-slate-300">
              Run matching again or update the job trade, description,
              location, or pay information.
            </p>
          </div>
        ) : (
          <section className="grid gap-6">
            {visibleMatches.map((match) => {
              const worker = match.worker
              const name = workerName(worker)
              const tone = matchTone(match.match_score)
              const invited = invitedWorkerIds.includes(match.worker_id)
              const inviting = actionWorkerId === match.worker_id

              return (
                <article
                  key={match.worker_id}
                  className={`rounded-[2rem] border ${tone.ring} ${tone.background} p-6 shadow-2xl backdrop-blur md:p-8`}
                >
                  <div className="flex flex-col gap-7 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-6 sm:flex-row">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 text-4xl font-black text-white shadow-xl">
                        {name.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-200">
                            #{match.rank}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${tone.badge}`}
                          >
                            {match.match_label}
                          </span>

                          {worker.is_online && (
                            <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-100">
                              Online
                            </span>
                          )}

                          {worker.background_verified && (
                            <span className="rounded-full bg-purple-400/20 px-3 py-1 text-xs font-black uppercase tracking-wide text-purple-100">
                              Verified
                            </span>
                          )}

                          {worker.insurance_provider && (
                            <span className="rounded-full bg-blue-400/20 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-100">
                              Insured
                            </span>
                          )}
                        </div>

                        <h2 className="mt-4 truncate text-3xl font-black text-white">
                          {name}
                        </h2>

                        <p className="mt-3 text-sm font-semibold text-slate-300">
                          {[worker.trade, worker.city, worker.state]
                            .filter(Boolean)
                            .join(' • ') || 'Worker details not listed'}
                        </p>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <WorkerDetail
                            label="Experience"
                            value={
                              worker.years_experience
                                ? `${worker.years_experience} years`
                                : 'Not listed'
                            }
                          />

                          <WorkerDetail
                            label="Availability"
                            value={formatStatus(
                              worker.availability_status
                            )}
                          />

                          <WorkerDetail
                            label="CrewCall Score"
                            value={
                              worker.crewcall_score !== null
                                ? `${worker.crewcall_score}/100`
                                : 'Not scored'
                            }
                          />

                          <WorkerDetail
                            label="Preferred Pay"
                            value={formatPayRange(worker)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-3 xl:w-64">
                      <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 text-center">
                        <p className={`text-5xl font-black ${tone.text}`}>
                          {match.match_score}%
                        </p>

                        <p className="mt-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                          AI Match
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => inviteWorker(match)}
                        disabled={inviting || invited}
                        className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {inviting
                          ? 'Sending Invite...'
                          : invited
                            ? 'Invited'
                            : 'Invite Worker'}
                      </button>

                      <Link
                        href={`/profile?user=${match.worker_id}`}
                        className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-center text-sm font-black text-white transition hover:bg-white/20"
                      >
                        View Profile
                      </Link>

                      <button
                        type="button"
                        onClick={() => hideWorker(match.worker_id)}
                        className="rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-3 text-sm font-black text-red-100 transition hover:bg-red-400/20"
                      >
                        Hide Match
                      </button>
                    </div>
                  </div>

                  <div className="mt-7 grid gap-5 lg:grid-cols-2">
                    <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
                        Why CrewCall Recommends This Worker
                      </p>

                      {match.match_reasons.length > 0 ? (
                        <div className="mt-4 space-y-3">
                          {match.match_reasons.map((reason) => (
                            <div
                              key={reason}
                              className="flex items-start gap-3 text-sm font-semibold text-emerald-50"
                            >
                              <span className="mt-0.5 text-emerald-300">
                                ✓
                              </span>
                              <span>{reason}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 text-sm font-semibold text-emerald-50">
                          {match.reason}
                        </p>
                      )}
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                        Match Breakdown
                      </p>

                      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <ScoreItem
                          label="Trade"
                          value={match.trade_score}
                        />
                        <ScoreItem
                          label="Location"
                          value={match.location_score}
                        />
                        <ScoreItem
                          label="Available"
                          value={match.availability_score}
                        />
                        <ScoreItem
                          label="Credentials"
                          value={match.certification_score}
                        />
                        <ScoreItem
                          label="Activity"
                          value={match.online_score}
                        />
                        <ScoreItem
                          label="Pay"
                          value={match.pay_score}
                        />
                      </div>

                      {match.warnings.length > 0 && (
                        <div className="mt-5 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-orange-200">
                            Items to confirm
                          </p>

                          <div className="mt-3 space-y-2">
                            {match.warnings.map((warning) => (
                              <p
                                key={warning}
                                className="text-sm font-semibold text-orange-50"
                              >
                                • {warning}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}

function AssistantStat({
  label,
  value,
  description,
}: {
  label: string
  value: number
  description: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
        {label}
      </p>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        {description}
      </p>
    </div>
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
    <div className="min-w-24 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
    </div>
  )
}

function WorkerDetail({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  )
}

function ScoreItem({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
      <p className="text-2xl font-black text-cyan-200">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
    </div>
  )
}
