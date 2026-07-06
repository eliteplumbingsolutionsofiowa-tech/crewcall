'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  status: string | null
  payment_status: string | null
  payout_status: string | null
  assigned_worker_id: string | null
  company_id: string | null
}

type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  phone: string | null
  years_experience: string | null
  insurance_provider: string | null
  liability_form_signed: boolean | null
  availability_status: string | null
  available_for_work: boolean | null
  is_online: boolean | null
  last_seen: string | null
  crewcall_score: number | null
  osha10: boolean | null
  osha30: boolean | null
  med_gas: boolean | null
  background_verified: boolean | null
  drug_tested: boolean | null
  license_number: string | null
}

type ApplicationRow = {
  id: string
  worker_id: string
  status: string | null
}

type Applicant = ApplicationRow & {
  profile: Profile | null
}

type JobMatch = {
  id: string
  job_id: string
  worker_id: string
  match_score: number | null
  trade_score: number | null
  location_score: number | null
  availability_score: number | null
  certification_score: number | null
  online_score: number | null
  pay_score: number | null
  reason: string | null
  profile: Profile | null
}

type RawJobMatch = {
  id: string
  job_id: string
  worker_id: string
  match_score: number | null
  trade_score: number | null
  location_score: number | null
  availability_score: number | null
  certification_score: number | null
  online_score: number | null
  pay_score: number | null
  reason: string | null
}

function cleanStatus(value: string | null | undefined) {
  return (value || 'open').replaceAll('_', ' ')
}

function workerName(profile: Profile | null) {
  return profile?.company_name || profile?.full_name || 'Worker'
}

function locationText(profile: Profile | null) {
  return [profile?.city, profile?.state].filter(Boolean).join(', ') || 'Location not listed'
}

function formatAvailability(value: string | null | undefined) {
  return cleanStatus(value || 'available')
}

function isActuallyOnline(profile: Profile | null) {
  if (!profile?.is_online || !profile.last_seen) return false

  const lastSeen = new Date(profile.last_seen).getTime()

  if (Number.isNaN(lastSeen)) return false

  return Date.now() - lastSeen < 1000 * 60 * 3
}

function statusTone(value: string | null | undefined) {
  const lowered = String(value || '').toLowerCase()

  if (
    lowered.includes('paid') ||
    lowered.includes('hired') ||
    lowered.includes('assigned') ||
    lowered.includes('released')
  ) {
    return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
  }

  if (
    lowered.includes('pending') ||
    lowered.includes('progress') ||
    lowered.includes('unpaid') ||
    lowered.includes('open')
  ) {
    return 'border-orange-400/30 bg-orange-400/10 text-orange-100'
  }

  if (lowered.includes('completed')) {
    return 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'
  }

  return 'border-white/10 bg-white/5 text-slate-200'
}

function StatusPill({ value }: { value: string | null }) {
  return (
    <span
      className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide ${statusTone(
        value
      )}`}
    >
      {cleanStatus(value)}
    </span>
  )
}

function MatchScoreCircle({ score }: { score: number }) {
  const tone =
    score >= 85
      ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100'
      : score >= 70
        ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-100'
        : 'border-orange-300/40 bg-orange-400/15 text-orange-100'

  return (
    <div
      className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-[1.5rem] border ${tone}`}
    >
      <span className="text-3xl font-black leading-none">{score}</span>
      <span className="mt-1 text-[10px] font-black uppercase tracking-wide">
        Match
      </span>
    </div>
  )
}

function SmallStat({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  )
}

function CheckBadge({
  label,
  active,
}: {
  label: string
  active: boolean
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${
        active
          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
          : 'border-white/10 bg-white/5 text-slate-500'
      }`}
    >
      {label}
    </span>
  )
}

export default function JobDetailPage() {
  const params = useParams()
  const jobId = String(params?.id || '')

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [matches, setMatches] = useState<JobMatch[]>([])
  const [assignedWorker, setAssignedWorker] = useState<Profile | null>(null)

  const [loading, setLoading] = useState(true)
  const [matchLoading, setMatchLoading] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [invitingWorkerId, setInvitingWorkerId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const hiredWorkerIds = useMemo(() => {
    return new Set(
      applicants
        .filter((app) => app.status === 'hired')
        .map((app) => app.worker_id)
    )
  }, [applicants])

  const applicantWorkerIds = useMemo(() => {
    return new Set(applicants.map((app) => app.worker_id))
  }, [applicants])

  const openMatches = useMemo(() => {
    return matches.filter((match) => !hiredWorkerIds.has(match.worker_id))
  }, [hiredWorkerIds, matches])

  const load = useCallback(async () => {
    if (!jobId) return

    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to view this job.')
      setLoading(false)
      return
    }

    setCurrentUserId(user.id)

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select(
        `
        id,
        title,
        trade,
        location,
        pay_rate,
        status,
        payment_status,
        payout_status,
        assigned_worker_id,
        company_id
      `
      )
      .eq('id', jobId)
      .maybeSingle()

    if (jobError) {
      setMessage(jobError.message)
      setLoading(false)
      return
    }

    setJob((jobData as Job | null) || null)
    setAssignedWorker(null)

    const { data: rawApps, error: appsError } = await supabase
      .from('applications')
      .select(
        `
        id,
        worker_id,
        status
      `
      )
      .eq('job_id', jobId)

    if (appsError) {
      setMessage(appsError.message)
      setLoading(false)
      return
    }

    const apps = (rawApps || []) as ApplicationRow[]

    const { data: rawMatches, error: matchesError } = await supabase
      .from('job_matches')
      .select(
        `
        id,
        job_id,
        worker_id,
        match_score,
        trade_score,
        location_score,
        availability_score,
        certification_score,
        online_score,
        pay_score,
        reason
      `
      )
      .eq('job_id', jobId)
      .order('match_score', { ascending: false })
      .limit(20)

    if (matchesError) {
      setMessage(matchesError.message)
    }

    const loadedMatches = ((rawMatches || []) as RawJobMatch[]).filter(Boolean)

    const workerIds = Array.from(
      new Set(
        [
          ...apps.map((app) => app.worker_id),
          ...loadedMatches.map((match) => match.worker_id),
          jobData?.assigned_worker_id,
        ].filter((workerId): workerId is string => Boolean(workerId))
      )
    )

    let profiles: Profile[] = []

    if (workerIds.length > 0) {
      const { data: rawProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select(
          `
          id,
          full_name,
          company_name,
          trade,
          city,
          state,
          phone,
          years_experience,
          insurance_provider,
          liability_form_signed,
          availability_status,
          available_for_work,
          is_online,
          last_seen,
          crewcall_score,
          osha10,
          osha30,
          med_gas,
          background_verified,
          drug_tested,
          license_number
        `
        )
        .in('id', workerIds)

      if (profilesError) {
        setMessage(profilesError.message)
      }

      profiles = (rawProfiles || []) as Profile[]
    }

    const mergedApps: Applicant[] = apps.map((app) => ({
      ...app,
      profile: profiles.find((profile) => profile.id === app.worker_id) || null,
    }))

    const mergedMatches: JobMatch[] = loadedMatches.map((match) => ({
      ...match,
      profile:
        profiles.find((profile) => profile.id === match.worker_id) || null,
    }))

    setApplicants(mergedApps)
    setMatches(mergedMatches)

    if (jobData?.assigned_worker_id) {
      setAssignedWorker(
        profiles.find((profile) => profile.id === jobData.assigned_worker_id) ||
          null
      )
    }

    setLoading(false)
  }, [jobId])

  useEffect(() => {
    void load()
  }, [load])

  async function hireWorker(workerId: string, applicationId?: string) {
    if (!job) return

    setMessage('Hiring worker...')

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        status: 'assigned',
        assigned_worker_id: workerId,
      })
      .eq('id', job.id)

    if (jobError) {
      setMessage(jobError.message)
      return
    }

    if (applicationId) {
      const { error: appError } = await supabase
        .from('applications')
        .update({
          status: 'hired',
        })
        .eq('id', applicationId)

      if (appError) {
        setMessage(appError.message)
        return
      }
    }

    await supabase.from('notifications').insert({
      user_id: workerId,
      title: 'You were hired',
      body: `You were hired for ${job.title || 'a CrewCall job'}.`,
      link_url: `/jobs/${job.id}`,
      read: false,
      is_read: false,
    })

    setMessage('Worker hired successfully.')
    window.dispatchEvent(new Event('crewcall-refresh-nav'))
    await load()
  }

  async function inviteMatchedWorker(match: JobMatch) {
    if (!job || !currentUserId) return

    setInvitingWorkerId(match.worker_id)
    setMessage('')

    const { data: existingInvite } = await supabase
      .from('job_invites')
      .select('id,status')
      .eq('company_id', currentUserId)
      .eq('worker_id', match.worker_id)
      .eq('job_id', job.id)
      .maybeSingle()

    if (existingInvite) {
      setMessage('This worker already has an invite for this job.')
      setInvitingWorkerId(null)
      return
    }

    const { error } = await supabase.from('job_invites').insert({
      company_id: currentUserId,
      worker_id: match.worker_id,
      job_id: job.id,
      status: 'pending',
      company_seen: true,
      worker_seen: false,
    })

    if (error) {
      setMessage(error.message)
      setInvitingWorkerId(null)
      return
    }

    await supabase.from('notifications').insert({
      user_id: match.worker_id,
      title: 'New job invite',
      body: `You were invited to ${job.title || 'a CrewCall job'}.`,
      link_url: '/invites',
      read: false,
      is_read: false,
    })

    setMessage(`${workerName(match.profile)} was invited successfully.`)
    setInvitingWorkerId(null)
    window.dispatchEvent(new Event('crewcall-refresh-nav'))
  }

  async function regenerateMatches() {
    if (!job) return

    setMatchLoading(true)
    setMessage('Finding best worker matches...')

    try {
      const response = await fetch('/api/jobs/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: job.id }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setMessage(result?.error || 'Unable to regenerate matches.')
        setMatchLoading(false)
        return
      }

      setMessage(`Updated matches. Found ${result?.matchesCreated || 0} workers.`)
      await load()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to regenerate matches.'
      )
    }

    setMatchLoading(false)
  }

  async function payWorker() {
    if (!job) return

    setPayLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: job.id,
        }),
      })

      const data = (await response.json()) as {
        url?: string
        error?: string
      }

      if (!response.ok || !data.url) {
        setMessage(data.error || 'Unable to start Stripe Checkout.')
        setPayLoading(false)
        return
      }

      window.location.href = data.url
    } catch {
      setMessage('Unable to start Stripe Checkout.')
      setPayLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
          <p className="text-sm font-black text-cyan-100">Loading job...</p>
        </div>
      </main>
    )
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl rounded-3xl border border-red-400/30 bg-red-500/10 p-6 text-red-100">
          Job not found.
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white">
      <section className="mx-auto max-w-7xl space-y-6">
        <Link
          href="/my-jobs"
          className="inline-flex text-sm font-black text-cyan-300 hover:text-cyan-200"
        >
          ← Back to My Jobs
        </Link>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                My Job
              </p>

              <h1 className="mt-4 text-4xl font-black text-white">
                {job.title || 'Untitled Job'}
              </h1>

              <p className="mt-2 text-lg font-semibold text-slate-400">
                {[job.trade, job.location].filter(Boolean).join(' · ') ||
                  'No trade/location listed'}
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <StatusPill value={job.status || 'open'} />
                <StatusPill value={job.payment_status || 'unpaid'} />
                <StatusPill value={job.payout_status || 'not released'} />
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-cyan-400/20 bg-cyan-400/10 px-6 py-5 text-left lg:text-right">
              <p className="text-xs font-black uppercase tracking-wide text-cyan-300">
                Pay Rate
              </p>

              <p className="mt-2 text-3xl font-black text-cyan-100">
                {job.pay_rate || 'Pay not listed'}
              </p>
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-100">
              {message}
            </div>
          )}
        </div>

        {assignedWorker ? (
          <div className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-6 shadow-2xl">
            <h2 className="text-xl font-black text-white">Assigned Worker</h2>

            <p className="mt-3 text-lg font-bold text-emerald-100">
              {workerName(assignedWorker)}
            </p>

            <p className="mt-1 text-sm font-semibold text-emerald-200/80">
              {assignedWorker.trade || 'Trade not listed'} ·{' '}
              {locationText(assignedWorker)}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/messages?start=${assignedWorker.id}`}
                className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950"
              >
                Message
              </Link>

              <Link
                href={`/profile?user=${assignedWorker.id}`}
                className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white"
              >
                View Profile
              </Link>

              {job.payment_status !== 'paid' && (
                <button
                  type="button"
                  onClick={payWorker}
                  disabled={payLoading}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {payLoading ? 'Opening Stripe...' : 'Pay Worker'}
                </button>
              )}

              {job.status === 'completed' && (
                <Link
                  href={`/reviews/new?jobId=${job.id}&revieweeId=${assignedWorker.id}`}
                  className="rounded-2xl bg-gradient-to-r from-orange-400 to-yellow-300 px-5 py-3 text-sm font-black text-slate-950"
                >
                  Leave Review
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            <section className="rounded-[2rem] border border-orange-400/20 bg-orange-400/10 p-6 shadow-2xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-200">
                    CrewCall Matching Engine
                  </p>

                  <h2 className="mt-3 text-3xl font-black text-white">
                    Best Worker Matches
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-orange-100/80">
                    Ranked by trade fit, location, availability, credentials,
                    online status, pay fit, and CrewCall score.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={regenerateMatches}
                  disabled={matchLoading}
                  className="rounded-2xl bg-orange-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {matchLoading ? 'Finding Matches...' : 'Refresh Matches'}
                </button>
              </div>

              {openMatches.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/50 p-6">
                  <p className="text-lg font-black text-white">
                    No matches found yet.
                  </p>

                  <p className="mt-2 text-sm font-semibold text-slate-400">
                    Click Refresh Matches to run the matching engine again.
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid gap-5">
                  {openMatches.map((match) => (
                    <article
                      key={match.id}
                      className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-5 shadow-xl"
                    >
                      <div className="flex flex-col gap-5 md:flex-row">
                        <MatchScoreCircle score={Number(match.match_score || 0)} />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <h3 className="text-2xl font-black text-white">
                                {workerName(match.profile)}
                              </h3>

                              <p className="mt-1 text-sm font-semibold text-slate-400">
                                {match.profile?.trade || 'Trade not listed'} ·{' '}
                                {locationText(match.profile)}
                              </p>

                              <p
                                className={`mt-2 text-xs font-black uppercase tracking-wide ${
                                  isActuallyOnline(match.profile)
                                    ? 'text-lime-300'
                                    : 'text-slate-500'
                                }`}
                              >
                                {isActuallyOnline(match.profile)
                                  ? 'Online now'
                                  : 'Offline'}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <CheckBadge
                                label="Licensed"
                                active={Boolean(match.profile?.license_number)}
                              />
                              <CheckBadge
                                label="Insured"
                                active={Boolean(match.profile?.insurance_provider)}
                              />
                              <CheckBadge
                                label="OSHA 10"
                                active={Boolean(match.profile?.osha10)}
                              />
                              <CheckBadge
                                label="OSHA 30"
                                active={Boolean(match.profile?.osha30)}
                              />
                              <CheckBadge
                                label="Med Gas"
                                active={Boolean(match.profile?.med_gas)}
                              />
                            </div>
                          </div>

                          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                            <SmallStat
                              label="Trade"
                              value={Number(match.trade_score || 0)}
                            />
                            <SmallStat
                              label="Location"
                              value={Number(match.location_score || 0)}
                            />
                            <SmallStat
                              label="Available"
                              value={Number(match.availability_score || 0)}
                            />
                            <SmallStat
                              label="Verified"
                              value={Number(match.certification_score || 0)}
                            />
                            <SmallStat
                              label="Online"
                              value={Number(match.online_score || 0)}
                            />
                            <SmallStat
                              label="Pay"
                              value={Number(match.pay_score || 0)}
                            />
                          </div>

                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-xs font-black uppercase tracking-wide text-orange-200">
                              Why this worker matched
                            </p>

                            <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                              {match.reason || 'This worker may be a good fit.'}
                            </p>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => inviteMatchedWorker(match)}
                              disabled={invitingWorkerId === match.worker_id}
                              className="rounded-2xl bg-orange-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {invitingWorkerId === match.worker_id
                                ? 'Inviting...'
                                : 'Invite'}
                            </button>

                            <Link
                              href={`/messages?start=${match.worker_id}`}
                              className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
                            >
                              Message
                            </Link>

                            <Link
                              href={`/profile?user=${match.worker_id}`}
                              className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                            >
                              View Profile
                            </Link>

                            {applicantWorkerIds.has(match.worker_id) && (
                              <span className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-100">
                                Already Applied
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl">
              <h2 className="text-2xl font-black text-white">
                Applicants ({applicants.length})
              </h2>

              {applicants.length === 0 ? (
                <p className="mt-4 rounded-3xl border border-white/10 bg-slate-950/60 p-5 text-slate-300">
                  No applicants yet. Use Best Worker Matches above to invite
                  qualified workers directly.
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  {applicants.map((app) => (
                    <div
                      key={app.id}
                      className="rounded-3xl border border-white/10 bg-slate-950/70 p-5"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-lg font-black text-white">
                            {workerName(app.profile)}
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-400">
                            {app.profile?.trade || 'Trade not listed'} ·{' '}
                            {locationText(app.profile)}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <StatusPill value={app.status || 'pending'} />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => hireWorker(app.worker_id, app.id)}
                            className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950"
                          >
                            Hire
                          </button>

                          <Link
                            href={`/messages?start=${app.worker_id}`}
                            className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-100"
                          >
                            Message
                          </Link>

                          <Link
                            href={`/profile?user=${app.worker_id}`}
                            className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white"
                          >
                            Profile
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  )
}