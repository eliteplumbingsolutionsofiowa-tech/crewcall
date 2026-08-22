'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { crewCallAuthedFetch } from '@/lib/authed-fetch'

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
  completion_status: string | null
  completion_notes: string | null
  completion_submitted_at: string | null
  completion_approved_at: string | null
}

type JobFile = {
  id: string
  file_name: string | null
  file_url: string | null
  file_type: string | null
  category: string | null
  uploaded_by: string | null
  created_at: string | null
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
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean | null
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

function workerName(
  profile: Profile | null,
  fallback = 'Worker'
) {
  return profile?.company_name || profile?.full_name || fallback
}

function locationText(
  profile: Profile | null,
  fallback = 'Location not listed'
) {
  return (
    [profile?.city, profile?.state].filter(Boolean).join(', ') ||
    fallback
  )
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

function StatusPill({
  value,
  label,
}: {
  value: string | null
  label?: string
}) {
  return (
    <span
      className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide ${statusTone(
        value
      )}`}
    >
      {label || cleanStatus(value)}
    </span>
  )
}

function MatchScoreCircle({
  score,
  label,
}: {
  score: number
  label: string
}) {
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
        {label}
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

function CheckBadge({ label, active }: { label: string; active: boolean }) {
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
  const t = useTranslations('MyJobDetail')
  const params = useParams()
  const jobId = String(params?.id || '')

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [matches, setMatches] = useState<JobMatch[]>([])
  const [assignedWorker, setAssignedWorker] = useState<Profile | null>(null)
  const [jobFiles, setJobFiles] = useState<JobFile[]>([])

  const [loading, setLoading] = useState(true)
  const [matchLoading, setMatchLoading] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [approvalLoading, setApprovalLoading] = useState(false)
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
      setMessage(t('mustBeLoggedIn'))
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
        company_id,
        completion_status,
        completion_notes,
        completion_submitted_at,
        completion_approved_at
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

    const { data: rawJobFiles, error: jobFilesError } =
      await supabase
        .from('job_files')
        .select(
          'id, file_name, file_url, file_type, category, uploaded_by, created_at'
        )
        .eq('job_id', jobId)
        .order('created_at', {
          ascending: false,
        })

    if (jobFilesError) {
      setMessage(jobFilesError.message)
    }

    setJobFiles(
      (rawJobFiles || []) as JobFile[]
    )

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

    const { data: rawMatches, error: matchesError } = await (supabase as any)
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
          stripe_account_id,
          stripe_onboarding_complete
        `
        )
        .in('id', workerIds)

      if (profilesError) {
        setMessage(profilesError.message)
      }

      profiles = (rawProfiles || []) as unknown as Profile[]
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
  }, [jobId, t])

  useEffect(() => {
    void load()
  }, [load])

  async function hireWorker(workerId: string, applicationId?: string) {
    if (!job) return

    setMessage(t('hiringWorker'))

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setMessage(t('sessionExpired'))
        return
      }

      const response = await fetch('/api/jobs/hire', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          jobId: job.id,
          workerId,
          applicationId,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setMessage(
          data?.error || t('unableToHire')
        )
        return
      }

      setMessage(t('workerHired'))
      window.dispatchEvent(
        new Event('crewcall-refresh-nav')
      )

      await load()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t('unableToHire')
      )
    }
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
      setMessage(t('alreadyInvited'))
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

    setMessage(t('workerInvited', { worker: workerName(match.profile) }))
    setInvitingWorkerId(null)
    window.dispatchEvent(new Event('crewcall-refresh-nav'))
  }

  async function regenerateMatches() {
    if (!job) return

    setMatchLoading(true)
    setMessage(t('findingMatches'))

    try {
      const response = await crewCallAuthedFetch('/api/jobs/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: job.id }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setMessage(result?.error || t('unableToRegenerateMatches'))
        setMatchLoading(false)
        return
      }

      setMessage(t('matchesUpdated', { count: result?.matchesCreated || 0 }))
      await load()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t('unableToRegenerateMatches')
      )
    }

    setMatchLoading(false)
  }

  async function approveCompletedWork() {
    if (!job || !currentUserId) return

    if (job.completion_status !== 'submitted') {
      setMessage(
        t('notSubmittedForApproval')
      )
      return
    }

    const completionPhotos =
      jobFiles.filter(
        (file) =>
          file.category ===
            'completion_photo' &&
          file.uploaded_by ===
            job.assigned_worker_id
      )

    if (completionPhotos.length === 0) {
      setMessage(
        t('completionPhotoRequired')
      )
      return
    }

    if (job.payment_status !== 'paid') {
      setMessage(
        t('fundingRequired')
      )
      return
    }

    setApprovalLoading(true)
    setMessage(t('approvingCompletedWork'))

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setMessage(
          'Your login session expired. Please log in again.'
        )
        return
      }

      const response = await fetch(
        '/api/jobs/complete',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            jobId: job.id,
            companyId: currentUserId,
          }),
        }
      )

      const result =
        await response
          .json()
          .catch(() => null)

      if (!response.ok) {
        setMessage(
          result?.error ||
            t('unableToApproveWork')
        )
        return
      }

      setMessage(
        t('workApprovedCompleted')
      )

      window.dispatchEvent(
        new Event(
          'crewcall-refresh-nav'
        )
      )

      await load()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t('unableToApproveWork')
      )
    } finally {
      setApprovalLoading(false)
    }
  }

  async function payWorker() {
    if (!job) return

    setPayLoading(true)
    setMessage('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setMessage(t('sessionExpired'))
        return
      }

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
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
        setMessage(data.error || t('unableToStartCheckout'))
        setPayLoading(false)
        return
      }

      window.location.href = data.url
    } catch {
      setMessage(t('unableToStartCheckout'))
      setPayLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
          <p className="text-sm font-black text-cyan-100">{t('loadingJob')}</p>
        </div>
      </main>
    )
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl rounded-3xl border border-red-400/30 bg-red-500/10 p-6 text-red-100">
          {t('jobNotFound')}
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
          ← {t('backToMyJobs')}
        </Link>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                {t('myJob')}
              </p>

              <h1 className="mt-4 text-4xl font-black text-white">
                {job.title || t('untitledJob')}
              </h1>

              <p className="mt-2 text-lg font-semibold text-slate-400">
                {[job.trade, job.location].filter(Boolean).join(' · ') ||
                  t('noTradeLocation')}
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <StatusPill value={job.status || 'open'} />
                <StatusPill value={job.payment_status || 'unpaid'} />
                <StatusPill value={job.payout_status || 'not released'} />
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-cyan-400/20 bg-cyan-400/10 px-6 py-5 text-left lg:text-right">
              <p className="text-xs font-black uppercase tracking-wide text-cyan-300">
                {t('payRate')}
              </p>

              <p className="mt-2 text-3xl font-black text-cyan-100">
                {job.pay_rate || t('payNotListed')}
              </p>
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-100">
              {message}
            </div>
          )}
        </div>

        {assignedWorker &&
        (
          job.completion_status ===
            'submitted' ||
          job.completion_status ===
            'approved'
        ) ? (
          <section className="rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-6 shadow-2xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  {t('completionPackage')}
                </p>

                <h2 className="mt-3 text-3xl font-black text-white">
                  {t('reviewCompletedWork')}
                </h2>

                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-cyan-100/70">
                  {t('reviewCompletionDescription')}
                </p>
              </div>

              <StatusPill
                value={
                  job.completion_status
                }
              />
            </div>

            {job.completion_notes ? (
              <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/50 p-5">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  {t('workerCompletionNotes')}
                </p>

                <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-200">
                  {job.completion_notes}
                </p>
              </div>
            ) : null}

            <div className="mt-6">
              <p className="text-sm font-black text-white">
                {t('completionPhotos')}
              </p>

              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {jobFiles
                  .filter(
                    (file) =>
                      file.category ===
                        'completion_photo' &&
                      file.uploaded_by ===
                        job.assigned_worker_id
                  )
                  .map((file) => (
                    <a
                      key={file.id}
                      href={
                        file.file_url || '#'
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 transition hover:border-cyan-400/40"
                    >
                      {file.file_url ? (
                        <img
                          src={
                            file.file_url
                          }
                          alt={
                            file.file_name ||
                            t('completionPhoto')
                          }
                          className="h-56 w-full object-cover"
                        />
                      ) : null}

                      <div className="p-4">
                        <p className="truncate text-sm font-black text-white">
                          {file.file_name ||
                            'Completion photo'}
                        </p>
                      </div>
                    </a>
                  ))}
              </div>
            </div>

            {jobFiles.some(
              (file) =>
                file.category ===
                  'inspection_report' &&
                file.uploaded_by ===
                  job.assigned_worker_id
            ) ? (
              <div className="mt-6">
                <p className="text-sm font-black text-white">
                  {t('inspectionReports')}
                </p>

                <div className="mt-3 grid gap-3">
                  {jobFiles
                    .filter(
                      (file) =>
                        file.category ===
                          'inspection_report' &&
                        file.uploaded_by ===
                          job.assigned_worker_id
                    )
                    .map((file) => (
                      <a
                        key={file.id}
                        href={
                          file.file_url ||
                          '#'
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition hover:border-cyan-400/40"
                      >
                        <div>
                          <p className="text-sm font-black text-white">
                            {file.file_name ||
                              t('inspectionReport')}
                          </p>

                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {t('openDocument')}
                          </p>
                        </div>

                        <span className="text-xl">
                          ↗
                        </span>
                      </a>
                    ))}
                </div>
              </div>
            ) : null}

            {job.completion_status ===
            'submitted' ? (
              <div className="mt-7 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5">
                <p className="text-sm font-black text-emerald-200">
                  {t('readyForReview')}
                </p>

                <p className="mt-2 text-sm font-semibold leading-6 text-emerald-100/70">
                  {t('approvalExplanation')}
                </p>

                <button
                  type="button"
                  onClick={
                    approveCompletedWork
                  }
                  disabled={
                    approvalLoading ||
                    !jobFiles.some(
                      (file) =>
                        file.category ===
                          'completion_photo' &&
                        file.uploaded_by ===
                          job.assigned_worker_id
                    )
                  }
                  className="mt-5 w-full rounded-2xl bg-emerald-400 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                >
                  {approvalLoading
                    ? t('approvingWork')
                    : t('approveWork')}
                </button>
              </div>
            ) : (
              <div className="mt-7 rounded-3xl border border-emerald-400/30 bg-emerald-500/15 p-5">
                <p className="text-sm font-black text-emerald-200">
                  ✓ {t('workApproved')}
                </p>

                <p className="mt-2 text-sm font-semibold text-emerald-100/70">
                  {t('completionApproved')}
                </p>
              </div>
            )}
          </section>
        ) : null}

        {assignedWorker ? (
          <div className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-6 shadow-2xl">
            <h2 className="text-xl font-black text-white">{t('assignedWorker')}</h2>

            <p className="mt-3 text-lg font-bold text-emerald-100">
              {workerName(assignedWorker, t('worker'))}
            </p>

            <p className="mt-1 text-sm font-semibold text-emerald-200/80">
              {assignedWorker.trade || t('tradeNotListed')} ·{' '}
              {locationText(assignedWorker, t('locationNotListed'))}
            </p>

            <div className="mt-3">
              {assignedWorker.stripe_account_id &&
              assignedWorker.stripe_onboarding_complete ? (
                <span className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-200">
                  ✓ {t('payoutReady')}
                </span>
              ) : (
                <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/15 px-3 py-1 text-xs font-black text-orange-200">
                  ⚠ {t('payoutSetupRequired')}
                </span>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/messages?start=${assignedWorker.id}`}
                className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950"
              >
                {t('message')}
              </Link>

              <Link
                href={`/profile?user=${assignedWorker.id}`}
                className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white"
              >
                {t('viewProfile')}
              </Link>

              {job.payment_status !== 'paid' ? (
                <button
                  type="button"
                  onClick={payWorker}
                  disabled={payLoading}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {payLoading
                    ? t('openingSecureCheckout')
                    : job.payment_status === 'pending'
                      ? t('continueFundingJob')
                      : t('fundJob')}
                </button>
              ) : job.payout_status === 'released' ? (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-3">
                  <p className="text-sm font-black text-emerald-200">
                    ✓ {t('payoutReleased')}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-emerald-100/70">
                    {t('paymentReleasedDescription')}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-3">
                  <p className="text-sm font-black text-emerald-200">
                    🔒 {t('fundsSecured')}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-emerald-100/70">
                    {t('fundsSecuredDescription')}
                  </p>
                </div>
              )}

              {job.status === 'completed' && (
                <Link
                  href={`/jobs/${job.id}/review?to=${assignedWorker.id}`}
                  className="rounded-2xl bg-gradient-to-r from-orange-400 to-yellow-300 px-5 py-3 text-sm font-black text-slate-950"
                >
                  {t('leaveReview')}
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
                    {t('matchingEngine')}
                  </p>

                  <h2 className="mt-3 text-3xl font-black text-white">
                    {t('bestWorkerMatches')}
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-orange-100/80">
                    {t('matchingDescription')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={regenerateMatches}
                  disabled={matchLoading}
                  className="rounded-2xl bg-orange-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {matchLoading ? t('findingMatchesButton') : t('refreshMatches')}
                </button>
              </div>

              {openMatches.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/50 p-6">
                  <p className="text-lg font-black text-white">
                    {t('noMatchesFound')}
                  </p>

                  <p className="mt-2 text-sm font-semibold text-slate-400">
                    {t('refreshMatchesDescription')}
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
                        <MatchScoreCircle score={Number(match.match_score || 0)} label={t('match')} />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <h3 className="text-2xl font-black text-white">
                                {workerName(match.profile, t('worker'))}
                              </h3>

                              <p className="mt-1 text-sm font-semibold text-slate-400">
                                {match.profile?.trade || t('tradeNotListed')} ·{' '}
                                {locationText(match.profile, t('locationNotListed'))}
                              </p>

                              <p
                                className={`mt-2 text-xs font-black uppercase tracking-wide ${
                                  isActuallyOnline(match.profile)
                                    ? 'text-lime-300'
                                    : 'text-slate-500'
                                }`}
                              >
                                {isActuallyOnline(match.profile)
                                  ? t('onlineNow')
                                  : t('offline')}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <CheckBadge
                                label={t('insured')}
                                active={Boolean(match.profile?.insurance_provider)}
                              />
                              <CheckBadge
                                label={t('liability')}
                                active={Boolean(match.profile?.liability_form_signed)}
                              />
                              <CheckBadge
                                label={t('available')}
                                active={Boolean(match.profile?.available_for_work)}
                              />
                            </div>
                          </div>

                          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                            <SmallStat
                              label={t('trade')}
                              value={Number(match.trade_score || 0)}
                            />
                            <SmallStat
                              label={t('location')}
                              value={Number(match.location_score || 0)}
                            />
                            <SmallStat
                              label={t('available')}
                              value={Number(match.availability_score || 0)}
                            />
                            <SmallStat
                              label={t('verified')}
                              value={Number(match.certification_score || 0)}
                            />
                            <SmallStat
                              label={t('online')}
                              value={Number(match.online_score || 0)}
                            />
                            <SmallStat
                              label={t('pay')}
                              value={Number(match.pay_score || 0)}
                            />
                          </div>

                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-xs font-black uppercase tracking-wide text-orange-200">
                              {t('whyMatched')}
                            </p>

                            <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                              {match.reason || t('goodFitFallback')}
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
                                ? t('inviting')
                                : t('invite')}
                            </button>

                            <Link
                              href={`/messages?start=${match.worker_id}`}
                              className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
                            >
                              {t('message')}
                            </Link>

                            <Link
                              href={`/profile?user=${match.worker_id}`}
                              className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                            >
                              View Profile
                            </Link>

                            {applicantWorkerIds.has(match.worker_id) && (
                              <span className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-100">
                                {t('alreadyApplied')}
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
                {t('applicants', { count: applicants.length })}
              </h2>

              {applicants.length === 0 ? (
                <p className="mt-4 rounded-3xl border border-white/10 bg-slate-950/60 p-5 text-slate-300">
                  No applicants yet. Use {t('bestWorkerMatches')} above to invite
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
                            {workerName(app.profile, t('worker'))}
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-400">
                            {app.profile?.trade || t('tradeNotListed')} ·{' '}
                            {locationText(app.profile, t('locationNotListed'))}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <StatusPill
                              value={app.status || 'pending'}
                              label={t(`status_${app.status || 'pending'}`)}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => hireWorker(app.worker_id, app.id)}
                            className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950"
                          >
                            {t('hire')}
                          </button>

                          <Link
                            href={`/messages?start=${app.worker_id}`}
                            className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-100"
                          >
                            {t('message')}
                          </Link>

                          <Link
                            href={`/profile?user=${app.worker_id}`}
                            className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white"
                          >
                            {t('profile')}
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