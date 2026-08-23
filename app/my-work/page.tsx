'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import MessageJobButton from '@/app/components/MessageJobButton'

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  start_date: string | null
  status: string | null
  payment_status: string | null
  payout_status: string | null
  paid_at: string | null
  company_id: string | null
  company?: {
    full_name: string | null
    company_name: string | null
  } | null
}

type Stats = {
  active: number
  inProgress: number
  completed: number
  paid: number
}

type Filter =
  | 'all'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'paid'

function formatDate(
  value: string | null,
  locale: string,
  noDateSet: string
) {
  if (!value) return noDateSet

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return noDateSet

  return date.toLocaleDateString(locale)
}

function cleanStatus(value: string | null) {
  return (value || 'unknown').replaceAll('_', ' ')
}

function statusTone(value: string | null) {
  const status = value || 'unknown'

  if (status === 'paid' || status === 'completed') {
    return 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
  }

  if (status === 'in_progress') {
    return 'border-orange-300/30 bg-orange-400/10 text-orange-100'
  }

  if (status === 'assigned') {
    return 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100'
  }

  if (status === 'cancelled' || status === 'rejected') {
    return 'border-red-300/30 bg-red-400/10 text-red-100'
  }

  return 'border-white/10 bg-white/10 text-slate-200'
}

function paymentTone(value: string | null) {
  const status = value || 'unpaid'

  if (status === 'paid' || status === 'released') {
    return 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
  }

  if (status === 'pending' || status === 'processing') {
    return 'border-orange-300/30 bg-orange-400/10 text-orange-100'
  }

  if (status === 'unpaid' || status === 'not_released') {
    return 'border-white/10 bg-white/10 text-slate-200'
  }

  return 'border-white/10 bg-white/10 text-slate-200'
}

export default function MyWorkPage() {
  const t = useTranslations('MyWork')
  const locale = useLocale()
  const [jobs, setJobs] = useState<Job[]>([])
  const [reviewedJobIds, setReviewedJobIds] = useState<Set<string>>(
    () => new Set()
  )
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const loadMyWork = useCallback(async () => {
    setRefreshing(true)
    setError('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError('You must be logged in to view your work.')
      setJobs([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data, error } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        trade,
        location,
        pay_rate,
        start_date,
        status,
        payment_status,
        payout_status,
        paid_at,
        company_id,
        company:profiles!jobs_company_id_fkey (
          full_name,
          company_name
        )
      `)
      .eq('assigned_worker_id', user.id)
      .order('start_date', { ascending: false })

    if (error) {
      setError(error.message)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const cleaned = ((data || []) as any[]).map((job) => ({
      ...job,
      company: Array.isArray(job.company)
        ? job.company[0]
        : job.company,
    }))

    const jobIds = cleaned.map((job) => job.id)

    if (jobIds.length > 0) {
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('job_id')
        .eq('reviewer_id', user.id)
        .in('job_id', jobIds)

      setReviewedJobIds(
        new Set(
          (reviewsData || [])
            .map((review) => review.job_id)
            .filter((reviewJobId): reviewJobId is string =>
              Boolean(reviewJobId)
            )
        )
      )
    } else {
      setReviewedJobIds(new Set())
    }

    setJobs(cleaned)

    setLoading(false)
    setRefreshing(false)

    window.dispatchEvent(new Event('crewcall-refresh-nav'))
  }, [])

  useEffect(() => {
    let mounted = true

    async function boot() {
      if (!mounted) return
      await loadMyWork()
    }

    boot()

    const refresh = async () => {
      if (!mounted) return

      await loadMyWork()

      window.dispatchEvent(
        new Event('crewcall-refresh-nav')
      )
    }

    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibility
    )

    const jobsChannel = supabase
      .channel('worker-my-work-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
        },
        refresh
      )
      .subscribe()

    return () => {
      mounted = false

      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)

      document.removeEventListener(
        'visibilitychange',
        handleVisibility
      )

      supabase.removeChannel(jobsChannel)
    }
  }, [loadMyWork])

  const stats = useMemo<Stats>(() => {
    return {
      active: jobs.filter((job) =>
        ['assigned', 'in_progress'].includes(job.status || '')
      ).length,

      inProgress: jobs.filter(
        (job) => job.status === 'in_progress'
      ).length,

      completed: jobs.filter(
        (job) => job.status === 'completed'
      ).length,

      paid: jobs.filter(
        (job) => job.payment_status === 'paid'
      ).length,
    }
  }, [jobs])

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase()

    return jobs.filter((job) => {
      const matchesFilter =
        filter === 'all' ||
        job.status === filter ||
        (filter === 'paid' &&
          job.payment_status === 'paid')

      const haystack = [
        job.title,
        job.trade,
        job.location,
        job.pay_rate,
        job.status,
        job.payment_status,
        job.payout_status,
        job.company?.company_name,
        job.company?.full_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch =
        !term || haystack.includes(term)

      return matchesFilter && matchesSearch
    })
  }, [jobs, filter, search])

  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      const order = [
        'in_progress',
        'assigned',
        'completed',
        'paid',
      ]

      const aIndex =
        order.indexOf(a.status || '') === -1
          ? 999
          : order.indexOf(a.status || '')

      const bIndex =
        order.indexOf(b.status || '') === -1
          ? 999
          : order.indexOf(b.status || '')

      if (aIndex !== bIndex) return aIndex - bIndex

      return (
        new Date(b.start_date || '').getTime() -
        new Date(a.start_date || '').getTime()
      )
    })
  }, [filteredJobs])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black">
            {t('loading')}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/20 backdrop-blur md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                {t('worker')}
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
                {t('title')}
              </h1>

              <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-300">
                {t('description')}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/jobs"
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
              >
                {t('browseJobs')}
              </Link>

              <Link
                href="/completed-jobs"
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
              >
                {t('completedJobs')}
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t('active')}
              value={stats.active}
            />

            <StatCard
              label={t('inProgress')}
              value={stats.inProgress}
            />

            <StatCard
              label={t('completed')}
              value={stats.completed}
            />

            <StatCard
              label={t('paid')}
              value={stats.paid}
            />
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm font-bold text-red-100">
            {error}
          </div>
        )}

        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                {t('search')}
              </label>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                {t('status')}
              </label>

              <select
                value={filter}
                onChange={(event) =>
                  setFilter(
                    event.target.value as Filter
                  )
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none"
              >
                <option value="all">{t('all')}</option>
                <option value="assigned">
                  {t('assigned')}
                </option>
                <option value="in_progress">
                  {t('inProgress')}
                </option>
                <option value="completed">
                  {t('completed')}
                </option>
                <option value="paid">{t('paid')}</option>
              </select>
            </div>

            <button
              type="button"
              onClick={loadMyWork}
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/20"
            >
              {refreshing
                ? t('refreshing')
                : t('refresh')}
            </button>
          </div>
        </section>

        {sortedJobs.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
            <h2 className="text-2xl font-black text-white">
              {t('noAssignedWork')}
            </h2>

            <p className="mt-2 text-slate-300">
              Once a company hires you for a job,
              it will show up here.
            </p>

            <Link
              href="/jobs"
              className="mt-6 inline-flex rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
            >
              {t('findWork')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-5">
            {sortedJobs.map((job) => {
              const companyName =
                job.company?.company_name ||
                job.company?.full_name ||
                t('company')

              return (
                <article
                  key={job.id}
                  className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/20 backdrop-blur transition hover:border-cyan-300/30"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          value={job.status || 'assigned'}
                          label={t(
                            job.status === 'in_progress'
                              ? 'inProgress'
                              : job.status === 'completed'
                                ? 'completed'
                                : job.status === 'cancelled'
                                  ? 'cancelled'
                                  : job.status === 'rejected'
                                    ? 'rejected'
                                    : 'assigned'
                          )}
                        />

                        <Badge
                          value={job.payment_status || 'unpaid'}
                          label={`${t('payment')}: ${
                            job.payment_status === 'paid'
                              ? t('paid')
                              : job.payment_status === 'pending'
                                ? t('pending')
                                : t('unpaid')
                          }`}
                          payment
                        />

                        <Badge
                          value={job.payout_status || 'not_released'}
                          label={`${t('payout')}: ${
                            job.payout_status === 'released'
                              ? t('released')
                              : job.payout_status === 'paid'
                                ? t('paid')
                                : job.payout_status === 'pending'
                                  ? t('pending')
                                  : t('notReleased')
                          }`}
                          payment
                        />
                      </div>

                      <h2 className="mt-4 text-2xl font-black text-white">
                        {job.title || t('untitledJob')}
                      </h2>

                      <p className="mt-2 text-sm font-semibold text-slate-300">
                        {t('company')}: {companyName}
                      </p>

                      <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
                        <Info
                          label={t('trade')}
                          value={
                            job.trade ||
                            'Not listed'
                          }
                        />

                        <Info
                          label={t('location')}
                          value={
                            job.location ||
                            'Not listed'
                          }
                        />

                        <Info
                          label={t('pay')}
                          value={
                            job.pay_rate ||
                            'Not listed'
                          }
                        />

                        <Info
                          label={t('start')}
                          value={formatDate(
                            job.start_date,
                            locale,
                            t('noDateSet')
                          )}
                        />
                      </div>

                      {job.status ===
                        'completed' &&
                        job.payment_status !==
                          'paid' && (
                          <div className="mt-5 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4 text-sm font-bold text-orange-100">
                            Work is complete.
                            Waiting for company
                            payment.
                          </div>
                        )}

                      {job.payment_status ===
                        'paid' && (
                        <div className="mt-5 space-y-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">
                          <p>
                            {job.paid_at
                              ? t('paidOn', {
                                  date: new Date(
                                    job.paid_at
                                  ).toLocaleDateString(locale),
                                })
                              : t('paid')}
                          </p>

                          {job.payout_status === 'released' ? (
                            <p className="text-cyan-200">
                              ✓ {t('paymentReleased')}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 lg:w-[220px] lg:flex-col">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-black text-white hover:bg-white/15"
                      >
                        {t('viewJob')}
                      </Link>

                      {job.company_id && (
                        <MessageJobButton
                          targetUserId={job.company_id}
                          jobId={job.id}
                          label={t('messageCompany')}
                          className="rounded-2xl bg-blue-500 px-5 py-3 text-center text-sm font-black text-white hover:bg-blue-400"
                        />
                      )}

                      {job.status ===
                        'completed' &&
                        job.company_id &&
                        !reviewedJobIds.has(job.id) && (
                          <Link
                            href={`/jobs/${job.id}/review?to=${job.company_id}`}
                            className="rounded-2xl bg-orange-500 px-5 py-3 text-center text-sm font-black text-white hover:bg-orange-400"
                          >
                            {t('leaveReview')}
                          </Link>
                        )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
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
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black text-white">
        {value}
      </p>
    </div>
  )
}

function Badge({
  value,
  label,
  payment = false,
}: {
  value: string
  label?: string
  payment?: boolean
}) {
  const lower = value.toLowerCase()

  const classes = payment
    ? paymentTone(lower)
    : statusTone(lower)

  return (
    <span
      className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide ${classes}`}
    >
      {label || cleanStatus(value)}
    </span>
  )
}

function Info({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-bold text-white">
        {value}
      </p>
    </div>
  )
}