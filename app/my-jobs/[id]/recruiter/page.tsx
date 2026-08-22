'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { crewCallAuthedFetch } from '@/lib/authed-fetch'

type Job = {
  id: string
  company_id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  description: string | null
  status: string | null
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
  insurance_provider: string | null
}

type AiMatch = {
  worker_id: string
  rank: number
  match_score: number
  match_label: string
  reason: string
  match_reasons: string[]
  warnings: string[]
  worker: WorkerProfile
}

type MatchResponse = {
  success?: boolean
  error?: string
  totalWorkersReviewed?: number
  matches?: AiMatch[]
}

type InvitationDraft = {
  workerId: string
  workerName: string
  message: string
}

type RecruiterResult = {
  answer: string
  recommendation: string
  hiringRisk: 'Low' | 'Moderate' | 'High' | 'Unknown'
  confidence: number
  recommendedWorkerIds: string[]
  strengths: string[]
  concerns: string[]
  interviewQuestions: string[]
  invitationDrafts: InvitationDraft[]
}

type RecruiterResponse = {
  success?: boolean
  error?: string
  result?: RecruiterResult
}

type InviteResponse = {
  success?: boolean
  error?: string
  alreadyInvited?: boolean
}

const QUICK_QUESTIONS = [
  'quickBestCandidate',
  'quickCompareTopThree',
  'quickHiringRisks',
  'quickInterviewQuestions',
  'quickDraftInvitations',
] as const

function workerName(
  worker: WorkerProfile,
  fallback = 'CrewCall Worker'
) {
  return (
    worker.full_name?.trim() ||
    worker.company_name?.trim() ||
    fallback
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

function getCredentials(worker: WorkerProfile) {
  const credentials: string[] = []

  if (worker.license_number) credentials.push('License provided')
  if (worker.insurance_provider) credentials.push('Insurance provided')
  if (worker.osha10) credentials.push('OSHA 10')
  if (worker.osha30) credentials.push('OSHA 30')
  if (worker.med_gas) credentials.push('Medical gas')
  if (worker.background_verified) {
    credentials.push('Background verified')
  }
  if (worker.drug_tested) credentials.push('Drug tested')

  return credentials
}

function riskTone(risk: RecruiterResult['hiringRisk']) {
  if (risk === 'Low') {
    return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
  }

  if (risk === 'Moderate') {
    return 'border-orange-400/30 bg-orange-400/10 text-orange-100'
  }

  if (risk === 'High') {
    return 'border-red-400/30 bg-red-400/10 text-red-100'
  }

  return 'border-white/10 bg-white/10 text-slate-200'
}

export default function AiRecruiterPage() {
  const t = useTranslations('AiRecruiter')
  const locale = useLocale()
  const params = useParams()
  const jobId = String(params?.id || '')

  const [job, setJob] = useState<Job | null>(null)
  const [matches, setMatches] = useState<AiMatch[]>([])
  const [question, setQuestion] = useState(
    t('quickBestCandidate')
  )
  const [result, setResult] = useState<RecruiterResult | null>(null)
  const [invitedWorkerIds, setInvitedWorkerIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [asking, setAsking] = useState(false)
  const [matching, setMatching] = useState(false)
  const [invitingWorkerId, setInvitingWorkerId] = useState<string | null>(
    null
  )
  const [totalWorkersReviewed, setTotalWorkersReviewed] = useState(0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const recommendedMatches = useMemo(() => {
    if (!result) {
      return []
    }

    return result.recommendedWorkerIds
      .map((workerId) =>
        matches.find((match) => match.worker_id === workerId)
      )
      .filter((match): match is AiMatch => Boolean(match))
  }, [matches, result])

  useEffect(() => {
    if (!jobId) return

    void loadPage()
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
      setError(t('mustBeLoggedIn'))
      setLoading(false)
      return
    }

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select(
        'id, company_id, title, trade, location, pay_rate, description, status'
      )
      .eq('id', jobId)
      .maybeSingle()

    if (jobError) {
      setError(jobError.message)
      setLoading(false)
      return
    }

    if (!jobData) {
      setError(t('jobNotFound'))
      setLoading(false)
      return
    }

    if (jobData.company_id !== user.id) {
      setError(t('noPermission'))
      setLoading(false)
      return
    }

    setJob(jobData as Job)
    setLoading(false)

    await runMatching()
  }

  async function runMatching() {
    setMatching(true)
    setError('')

    try {
      const response = await crewCallAuthedFetch('/api/jobs/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId }),
      })

      const data = (await response.json().catch(() => null)) as
        | MatchResponse
        | null

      if (!response.ok || !data?.success) {
        setError(data?.error || t('unableToRunMatching'))
        setMatches([])
        return
      }

      setMatches(data.matches || [])
      setTotalWorkersReviewed(data.totalWorkersReviewed || 0)
    } catch (matchingError) {
      setError(
        matchingError instanceof Error
          ? matchingError.message
          : t('unableToRunMatching')
      )
    } finally {
      setMatching(false)
    }
  }

  async function askRecruiter(selectedQuestion?: string) {
    const actualQuestion = (selectedQuestion || question).trim()

    if (!actualQuestion) {
      setError(t('enterQuestion'))
      return
    }

    if (!job) {
      setError(t('jobNotLoaded'))
      return
    }

    if (matches.length === 0) {
      setError(t('runMatchingFirst'))
      return
    }

    setQuestion(actualQuestion)
    setAsking(true)
    setError('')
    setMessage('')
    setResult(null)

    const workers = matches.slice(0, 15).map((match) => ({
      workerId: match.worker_id,
      name: workerName(match.worker, t('crewCallWorker')),
      trade: match.worker.trade || '',
      location: [match.worker.city, match.worker.state]
        .filter(Boolean)
        .join(', '),
      matchScore: match.match_score,
      matchLabel: match.match_label,
      experience: match.worker.years_experience
        ? `${match.worker.years_experience} years`
        : 'Not listed',
      availability: formatStatus(
        match.worker.availability_status
      ),
      crewcallScore: match.worker.crewcall_score,
      preferredPay: formatPayRange(match.worker),
      skills: [
        ...(match.worker.skills || []),
        ...(match.worker.preferred_work || []),
      ],
      credentials: getCredentials(match.worker),
      reasons: match.match_reasons,
      warnings: match.warnings,
    }))

    try {
      const response = await fetch('/api/ai/recruiter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: actualQuestion,
          job: {
            id: job.id,
            title: job.title || '',
            trade: job.trade || '',
            location: job.location || '',
            payRate: job.pay_rate || '',
            description: job.description || '',
          },
          workers,
        }),
      })

      const data = (await response.json().catch(() => null)) as
        | RecruiterResponse
        | null

      if (!response.ok || !data?.success || !data.result) {
        setError(
          data?.error || t('recruiterCouldNotAnswer')
        )
        return
      }

      setResult(data.result)
      setMessage(t('analysisCompleted'))
    } catch (recruiterError) {
      setError(
        recruiterError instanceof Error
          ? recruiterError.message
          : t('recruiterCouldNotAnswer')
      )
    } finally {
      setAsking(false)
    }
  }

  async function inviteWorker(workerId: string) {
    const match = matches.find(
      (candidate) => candidate.worker_id === workerId
    )

    if (!match) {
      setError(t('workerNotFound'))
      return
    }

    const name = workerName(match.worker, t('crewCallWorker'))

    const confirmed = window.confirm(
      t('confirmInvite', {
      worker: name,
      job: job?.title || t('thisJob'),
    })
    )

    if (!confirmed) return

    setInvitingWorkerId(workerId)
    setError('')
    setMessage('')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setError(t('sessionExpired'))
      setInvitingWorkerId(null)
      return
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}/invite`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workerId }),
      })

      const data = (await response.json().catch(() => null)) as
        | InviteResponse
        | null

      if (!response.ok || !data?.success) {
        setError(data?.error || t('unableToInvite'))
        return
      }

      setInvitedWorkerIds((current) =>
        current.includes(workerId)
          ? current
          : [...current, workerId]
      )

      setMessage(
        data.alreadyInvited
          ? t('alreadyInvited', { worker: name })
          : t('invitedSuccessfully', { worker: name })
      )

      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : t('unableToInvite')
      )
    } finally {
      setInvitingWorkerId(null)
    }
  }

  async function copyInvitation(draft: InvitationDraft) {
    try {
      await navigator.clipboard.writeText(draft.message)
      setMessage(t('invitationCopied', { worker: draft.workerName }))
    } catch {
      setError(t('unableToCopy'))
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-lg font-black">
            {t('loading')}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-purple-400/25 bg-gradient-to-br from-purple-500/20 via-blue-500/10 to-cyan-500/10 shadow-2xl">
          <div className="p-6 md:p-9">
            <Link
              href={`/my-jobs/${jobId}/ai`}
              className="text-sm font-black text-cyan-300 transition hover:text-cyan-200"
            >
              ← {t('backToAiMatches')}
            </Link>

            <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-purple-200">
                  {t('crewCallAi')}
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
                  {t('title')}
                </h1>

                <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-slate-300">
                  {t('description')}
                </p>
              </div>

              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-purple-400/20 text-4xl ring-1 ring-purple-300/20">
                🤖
              </div>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-3xl border border-red-400/30 bg-red-400/10 p-5 text-sm font-bold text-red-100">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-5 text-sm font-bold text-cyan-100">
            {message}
          </div>
        ) : null}

        {job ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  {t('recruitingFor')}
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  {job.title || t('untitledJob')}
                </h2>

                <p className="mt-3 font-semibold text-slate-300">
                  {[job.trade, job.location, job.pay_rate]
                    .filter(Boolean)
                    .join(' • ')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label={t('workersReviewed')}
                  value={totalWorkersReviewed}
                />
                <StatCard
                  label={t('matchesLoaded')}
                  value={matches.length}
                />
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-6 shadow-2xl md:p-8">
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                {t('askYourRecruiter')}
              </p>

              <h2 className="mt-2 text-3xl font-black">
                {t('whatDoYouNeed')}
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((quickQuestion) => (
                <button
                  key={quickQuestion}
                  type="button"
                  onClick={() => void askRecruiter(t(quickQuestion))}
                  disabled={asking || matching}
                  className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-left text-xs font-black text-slate-200 transition hover:bg-white/20 disabled:opacity-50"
                >
                  {t(quickQuestion)}
                </button>
              ))}
            </div>

            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t('questionPlaceholder')}
              rows={5}
              className="w-full resize-none rounded-3xl border border-white/10 bg-slate-950/80 px-5 py-4 text-white outline-none ring-cyan-300/40 placeholder:text-slate-500 focus:ring-4"
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void askRecruiter()}
                disabled={asking || matching || matches.length === 0}
                className="flex-1 rounded-2xl bg-gradient-to-r from-purple-400 via-cyan-300 to-blue-400 px-6 py-4 text-sm font-black text-slate-950 shadow-xl transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {asking
                  ? t('analyzing')
                  : t('askRecruiter')}
              </button>

              <button
                type="button"
                onClick={() => void runMatching()}
                disabled={matching || asking}
                className="rounded-2xl border border-white/10 bg-white/10 px-6 py-4 text-sm font-black transition hover:bg-white/20 disabled:opacity-50"
              >
                {matching ? t('matching') : t('refreshMatches')}
              </button>
            </div>
          </div>
        </section>

        {result ? (
          <>
            <section className="rounded-[2rem] border border-cyan-400/20 bg-cyan-400/10 p-6 shadow-2xl md:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-4xl">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
                    {t('recruiterAnswer')}
                  </p>

                  <p className="mt-4 whitespace-pre-wrap text-base font-semibold leading-8 text-slate-100">
                    {result.answer}
                  </p>
                </div>

                <div className="grid shrink-0 grid-cols-2 gap-3">
                  <div
                    className={`rounded-2xl border p-4 text-center ${riskTone(
                      result.hiringRisk
                    )}`}
                  >
                    <p className="text-2xl font-black">
                      {result.hiringRisk}
                    </p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-wide opacity-80">
                      {t('hiringRisk')}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-center">
                    <p className="text-2xl font-black text-white">
                      {result.confidence}%
                    </p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
                      {t('confidence')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/40 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-200">
                  {t('recommendation')}
                </p>

                <p className="mt-3 font-semibold leading-7 text-white">
                  {result.recommendation}
                </p>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <ResultList
                title={t('hiringStrengths')}
                items={result.strengths}
                emptyText={t('noStrengths')}
                symbol="✓"
              />

              <ResultList
                title={t('itemsToConfirm')}
                items={result.concerns}
                emptyText={t('noConcerns')}
                symbol="!"
              />
            </section>

            {recommendedMatches.length > 0 ? (
              <section className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-6 shadow-2xl md:p-8">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200">
                  {t('recommendedCandidates')}
                </p>

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  {recommendedMatches.map((match) => {
                    const invited = invitedWorkerIds.includes(
                      match.worker_id
                    )
                    const inviting =
                      invitingWorkerId === match.worker_id

                    return (
                      <article
                        key={match.worker_id}
                        className="rounded-3xl border border-white/10 bg-slate-950/50 p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="truncate text-xl font-black">
                              {workerName(match.worker, t('crewCallWorker'))}
                            </h3>

                            <p className="mt-1 text-sm font-semibold text-slate-400">
                              {match.worker.trade || t('tradeNotListed')}
                            </p>
                          </div>

                          <span className="rounded-full bg-cyan-400/20 px-3 py-1 text-sm font-black text-cyan-100">
                            {match.match_score}%
                          </span>
                        </div>

                        <p className="mt-4 text-sm font-semibold leading-6 text-slate-300">
                          {match.match_reasons[0] ||
                            match.reason ||
                            t('possibleMatch')}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            void inviteWorker(match.worker_id)
                          }
                          disabled={inviting || invited}
                          className="mt-5 w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-400 disabled:opacity-50"
                        >
                          {inviting
                            ? t('sending')
                            : invited
                              ? t('invited')
                              : t('inviteWorker')}
                        </button>
                      </article>
                    )
                  })}
                </div>
              </section>
            ) : null}

            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl md:p-8">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-200">
                {t('interviewPlan')}
              </p>

              <h2 className="mt-2 text-3xl font-black">
                {t('suggestedInterviewQuestions')}
              </h2>

              <div className="mt-6 grid gap-3">
                {result.interviewQuestions.length > 0 ? (
                  result.interviewQuestions.map((interviewQuestion, index) => (
                    <div
                      key={`${interviewQuestion}-${index}`}
                      className="flex gap-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-400/20 text-sm font-black text-blue-100">
                        {index + 1}
                      </span>

                      <p className="font-semibold leading-7 text-slate-200">
                        {interviewQuestion}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400">
                    {t('noInterviewQuestions')}
                  </p>
                )}
              </div>
            </section>

            {result.invitationDrafts.length > 0 ? (
              <section className="rounded-[2rem] border border-purple-400/20 bg-purple-400/10 p-6 shadow-2xl md:p-8">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-purple-200">
                  {t('personalizedInvitations')}
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  {t('aiInvitationDrafts')}
                </h2>

                <div className="mt-6 grid gap-5">
                  {result.invitationDrafts.map((draft) => {
                    const invited = invitedWorkerIds.includes(
                      draft.workerId
                    )
                    const inviting =
                      invitingWorkerId === draft.workerId

                    return (
                      <article
                        key={`${draft.workerId}-${draft.workerName}`}
                        className="rounded-3xl border border-white/10 bg-slate-950/50 p-5"
                      >
                        <h3 className="text-xl font-black">
                          {draft.workerName}
                        </h3>

                        <p className="mt-4 whitespace-pre-wrap font-semibold leading-7 text-slate-300">
                          {draft.message}
                        </p>

                        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => void copyInvitation(draft)}
                            className="flex-1 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black transition hover:bg-white/20"
                          >
                            {t('copyDraft')}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void inviteWorker(draft.workerId)
                            }
                            disabled={inviting || invited}
                            className="flex-1 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-400 disabled:opacity-50"
                          >
                            {inviting
                              ? t('sending')
                              : invited
                                ? t('invited')
                                : t('sendJobInvite')}
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
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
    <div className="min-w-36 rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-center">
      <p className="text-3xl font-black">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
    </div>
  )
}

function ResultList({
  title,
  items,
  emptyText,
  symbol,
}: {
  title: string
  items: string[]
  emptyText: string
  symbol: string
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl">
      <h2 className="text-2xl font-black">{title}</h2>

      <div className="mt-5 space-y-3">
        {items.length > 0 ? (
          items.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400/20 text-xs font-black text-cyan-100">
                {symbol}
              </span>

              <p className="font-semibold leading-6 text-slate-200">
                {item}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm font-semibold text-slate-400">
            {emptyText}
          </p>
        )}
      </div>
    </section>
  )
}
