'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { crewCallAuthedFetch } from '@/lib/authed-fetch'
import { resolveCompanyContext } from '@/lib/company-context'

type Role = 'company' | 'worker' | 'admin' | null

type Profile = {
  id: string
  role: Role
  company_name: string | null
  full_name: string | null
}

type JobInsert = {
  company_id: string
  title: string
  trade: string
  location: string
  pay_rate: string
  description: string
  status: 'open'
  payment_status: 'unpaid'
}

type JobRow = {
  id: string
}

type GeneratedJob = {
  title: string
  description: string
  requiredSkills: string[]
  recommendedCertifications: string[]
  suggestedPayRange: string
  hiringDifficulty: 'Easy' | 'Moderate' | 'Difficult'
  estimatedMatches: number
}

type GenerateJobResponse = {
  success?: boolean
  generated?: GeneratedJob
  error?: string
}

type QueryError = {
  message: string
}

type MaybeSingleBuilder<T> = {
  maybeSingle: () => Promise<{
    data: T | null
    error: QueryError | null
  }>
}

type SingleBuilder<T> = {
  single: () => Promise<{
    data: T | null
    error: QueryError | null
  }>
}

type SelectEqBuilder<T> = {
  eq: (column: string, value: string) => MaybeSingleBuilder<T>
}

type InsertSelectBuilder<T> = {
  select: (columns: string) => SingleBuilder<T>
}

type SelectTable<T> = {
  select: (columns: string) => SelectEqBuilder<T>
}

type InsertTable<TInsert, TReturn> = {
  insert: (value: TInsert) => InsertSelectBuilder<TReturn>
}

function profilesTable() {
  return supabase.from('profiles') as unknown as SelectTable<Profile>
}

function jobsTable() {
  return supabase.from('jobs') as unknown as InsertTable<JobInsert, JobRow>
}

export default function PostJobPage() {
  const router = useRouter()
  const t = useTranslations('PostJob')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [aiMessage, setAiMessage] = useState('')
  const [jobNotes, setJobNotes] = useState('')
  const [generatedJob, setGeneratedJob] = useState<GeneratedJob | null>(null)

  const [title, setTitle] = useState('')
  const [trade, setTrade] = useState('')
  const [location, setLocation] = useState('')
  const [payRate, setPayRate] = useState('')
  const [description, setDescription] = useState('')

  const canPost = useMemo(() => {
    return (
      (profile?.role === 'company' || profile?.role === 'admin') &&
      title.trim().length > 1 &&
      trade.trim().length > 1 &&
      location.trim().length > 1 &&
      payRate.trim().length > 0 &&
      description.trim().length > 5
    )
  }, [description, location, payRate, profile?.role, title, trade])

  useEffect(() => {
    let active = true

    async function loadProfile() {
      setLoading(true)
      setMessage('')

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (!active) {
        return
      }

      if (userError || !user) {
        router.replace('/login')
        return
      }

      const companyContext =
        await resolveCompanyContext(
          supabase,
          user.id
        )

      if (!active) {
        return
      }

      const resolvedCompanyId =
        companyContext.companyId ||
        (companyContext.isPlatformAdmin
          ? user.id
          : null)

      if (!resolvedCompanyId) {
        router.replace('/worker/dashboard')
        return
      }

      const { data, error } = await profilesTable()
        .select('id, role, company_name, full_name')
        .eq('id', resolvedCompanyId)
        .maybeSingle()

      if (!active) {
        return
      }

      if (error) {
        setMessage(error.message)
        setLoading(false)
        return
      }

      if (!data) {
        setMessage(
          t('companyProfileLoadFailed')
        )
        setLoading(false)
        return
      }

      setProfile({
        ...data,
        role:
          companyContext.isPlatformAdmin &&
          !companyContext.companyId
            ? 'admin'
            : 'company',
      })

      setLoading(false)
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [router, t])

  async function generateJobWithAi() {
    if (generating) {
      return
    }

    if (!trade.trim()) {
      setAiMessage(t('enterTradeFirst'))
      return
    }

    if (!location.trim()) {
      setAiMessage(t('enterLocationFirst'))
      return
    }

    setGenerating(true)
    setAiMessage(t('aiWriting'))

    try {
      const response = await fetch('/api/ai/generate-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trade: trade.trim(),
          location: location.trim(),
          payRate: payRate.trim(),
          notes: jobNotes.trim(),
        }),
      })

      const result = (await response.json().catch(() => null)) as
        | GenerateJobResponse
        | null

      if (!response.ok || !result?.success || !result.generated) {
        setAiMessage(
          result?.error || t('aiGenerateFailed')
        )
        setGenerating(false)
        return
      }

      const generated = result.generated

      setGeneratedJob(generated)
      setTitle(generated.title)
      setDescription(generated.description)

      if (!payRate.trim() && generated.suggestedPayRange) {
        setPayRate(generated.suggestedPayRange)
      }

      setAiMessage(
        t('generatedSuccessfully')
      )
    } catch (error) {
      setAiMessage(
        error instanceof Error
          ? error.message
          : t('aiGenerateFailed')
      )
    } finally {
      setGenerating(false)
    }
  }

  async function generateMatches(jobId: string) {
    try {
      const response = await crewCallAuthedFetch('/api/jobs/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        console.warn('CrewCall matching failed:', result?.error)
        return
      }

      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    } catch (error) {
      console.warn('CrewCall matching failed:', error)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving) {
      return
    }

    if (!profile) {
      setMessage(t('companyProfileUnavailable'))
      return
    }

    if (profile.role !== 'company' && profile.role !== 'admin') {
      router.replace('/worker/dashboard')
      return
    }

    if (!canPost) {
      setMessage(t('fillRequired'))
      return
    }

    setSaving(true)
    setMessage(t('postingJob'))

    try {
      const payload: JobInsert = {
        company_id: profile.id,
        title: title.trim(),
        trade: trade.trim(),
        location: location.trim(),
        pay_rate: payRate.trim(),
        description: description.trim(),
        status: 'open',
        payment_status: 'unpaid',
      }

      const { data, error } = await jobsTable()
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        setMessage(error.message)
        setSaving(false)
        return
      }

      if (!data?.id) {
        setMessage(t('missingJobId'))
        setSaving(false)
        return
      }

      setMessage(t('findingMatches'))

      await generateMatches(data.id)

      window.dispatchEvent(new Event('crewcall-refresh-nav'))

      router.replace(`/my-jobs/${data.id}`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('unableToPost'))
      setSaving(false)
    }
  }

  if (loading || !profile) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <section className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-300">
            CrewCall
          </p>

          <h1 className="mt-3 text-3xl font-black">{t('loadingPostJob')}</h1>

          <p className="mt-3 text-slate-300">
            {t('checkingAccount')}
          </p>

          {message ? (
            <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm font-bold text-red-100">
              {message}
            </div>
          ) : null}
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <section className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/15 via-blue-500/10 to-white/5 p-6 shadow-2xl">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-200">
            {t('companyEyebrow')}
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            {t('postJob')}
          </h1>

          <p className="mt-3 max-w-2xl text-base font-semibold text-slate-300">
            {t('postJobDescription')}
          </p>

          <div className="mt-5 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-slate-200">
            {t('postingAs', { name: profile.company_name || profile.full_name || t('company') })}
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-purple-400/25 bg-gradient-to-br from-purple-500/15 via-blue-500/10 to-cyan-500/10 shadow-2xl">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-purple-200">
                  {t('aiWriter')}
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  {t('generatePosting')}
                </h2>

                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  {t('aiDescription')}
                </p>
              </div>

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-400/20 text-3xl ring-1 ring-purple-300/20">
                ✨
              </div>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-black text-slate-200">
                {t('quickNotes')}
              </span>

              <textarea
                value={jobNotes}
                onChange={(event) => setJobNotes(event.target.value)}
                placeholder={t('quickNotesPlaceholder')}
                rows={4}
                className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none ring-purple-300/40 placeholder:text-slate-500 focus:ring-4"
              />
            </label>

            {aiMessage ? (
              <div className="mt-4 rounded-2xl border border-purple-300/20 bg-purple-300/10 p-4 text-sm font-bold text-purple-100">
                {aiMessage}
              </div>
            ) : null}

            <button
              type="button"
              onClick={generateJobWithAi}
              disabled={generating}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-purple-400 via-cyan-300 to-blue-400 px-6 py-4 text-sm font-black text-slate-950 shadow-xl transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? t('generatingJob') : t('generateWithAi')}
            </button>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl sm:p-6"
        >
          {message ? (
            <div className="mb-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm font-bold text-cyan-100">
              {message}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-black text-slate-200">
                {t('jobTitle')}
              </span>

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('jobTitlePlaceholder')}
                autoComplete="off"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none ring-cyan-300/40 placeholder:text-slate-500 focus:ring-4"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-200">{t('trade')}</span>

              <input
                value={trade}
                onChange={(event) => setTrade(event.target.value)}
                placeholder={t('tradePlaceholder')}
                autoComplete="off"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none ring-cyan-300/40 placeholder:text-slate-500 focus:ring-4"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-200">
                {t('location')}
              </span>

              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder={t('locationPlaceholder')}
                autoComplete="street-address"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none ring-cyan-300/40 placeholder:text-slate-500 focus:ring-4"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-200">
                {t('payRate')}
              </span>

              <input
                value={payRate}
                onChange={(event) => {
                  const value = event.target.value

                  if (/^[0-9$,.\s]*$/.test(value)) {
                    setPayRate(value)
                  }
                }}
                inputMode="decimal"
                placeholder={t('payPlaceholder')}
                autoComplete="off"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none ring-cyan-300/40 placeholder:text-slate-500 focus:ring-4"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-black text-slate-200">
              {t('jobScope')}
            </span>

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('scopePlaceholder')}
              rows={7}
              className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none ring-cyan-300/40 placeholder:text-slate-500 focus:ring-4"
            />
          </label>

          {generatedJob ? (
            <section className="mt-5 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
                    {t('aiForecast')}
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-300">
                    {t('aiSuggestionsNotice')}
                  </p>
                </div>

                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-white">
                  {t('hiringDifficulty', { difficulty: t(generatedJob.hiringDifficulty.toLowerCase() as 'easy' | 'moderate' | 'difficult') })}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    {t('suggestedPay')}
                  </p>

                  <p className="mt-2 text-lg font-black text-white">
                    {generatedJob.suggestedPayRange || t('notEstimated')}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    {t('estimatedMatches')}
                  </p>

                  <p className="mt-2 text-lg font-black text-white">
                    {t('approximately', { count: generatedJob.estimatedMatches })}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    {t('recommendedSkills')}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {generatedJob.requiredSkills.length > 0 ? (
                      generatedJob.requiredSkills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-blue-400/20 px-3 py-1 text-xs font-black text-blue-100"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm font-semibold text-slate-400">
                        {t('noneSuggested')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    {t('recommendedCertifications')}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {generatedJob.recommendedCertifications.length > 0 ? (
                      generatedJob.recommendedCertifications.map(
                        (certification) => (
                          <span
                            key={certification}
                            className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-black text-emerald-100"
                          >
                            {certification}
                          </span>
                        )
                      )
                    ) : (
                      <span className="text-sm font-semibold text-slate-400">
                        {t('noneSuggested')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <div className="mt-5 rounded-2xl border border-orange-400/25 bg-orange-400/10 p-4">
            <p className="text-sm font-black text-orange-100">
              {t('matchingNotice')}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/company/jobs"
              className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white/20"
            >
              {t('cancel')}
            </Link>

            <button
              type="submit"
              disabled={saving || !canPost}
              className="rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/40 transition hover:bg-cyan-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? t('postingMatching') : t('postFindMatches')}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}