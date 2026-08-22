'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import WorkerLocationPresence from '@/app/components/WorkerLocationPresence'
import { supabase } from '@/lib/supabase'

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
}

type Stats = {
  assigned: number
  completed: number
  paid: number
  unpaid: number
}

type QueryError = {
  message: string
}

type OrderedQuery<T> = {
  order: (
    column: string,
    options?: { ascending?: boolean }
  ) => Promise<{ data: T[] | null; error: QueryError | null }>
}

type EqOrderQuery<T> = {
  eq: (column: string, value: string) => OrderedQuery<T>
}

type SelectTable<T> = {
  select: (columns: string) => EqOrderQuery<T>
}

function jobsSelectTable() {
  return supabase.from('jobs') as unknown as SelectTable<Job>
}


function normalize(value: string | null) {
  return String(value || '').toLowerCase().trim()
}

function formatDate(value: string | null, fallback: string) {
  if (!value) {
    return fallback
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  return date.toLocaleDateString()
}

export default function WorkerDashboard() {
  const t = useTranslations('WorkerDashboard')

  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats>({
    assigned: 0,
    completed: 0,
    paid: 0,
    unpaid: 0,
  })

  const [loading, setLoading] = useState(true)
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [reviewedJobIds, setReviewedJobIds] = useState<Set<string>>(
    () => new Set()
  )

  useEffect(() => {
    void loadJobs()
  }, [])

  async function loadJobs() {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage(t('loginRequired'))
      setLoading(false)
      return
    }

    const { data, error } = await jobsSelectTable()
      .select(
        `
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
        company_id
      `
      )
      .eq('assigned_worker_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setJobs([])
      setLoading(false)
      return
    }

    const jobList = (data || []).filter(Boolean)

    const jobIds = jobList.map((job) => job.id)

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
            .filter((jobId): jobId is string => Boolean(jobId))
        )
      )
    } else {
      setReviewedJobIds(new Set())
    }

    setJobs(jobList)

    setStats({
      assigned: jobList.filter(
        (job) => normalize(job.status) !== 'completed'
      ).length,

      completed: jobList.filter(
        (job) => normalize(job.status) === 'completed'
      ).length,

      paid: jobList.filter(
        (job) => normalize(job.payment_status) === 'paid'
      ).length,

      unpaid: jobList.filter(
        (job) => normalize(job.payment_status) !== 'paid'
      ).length,
    })

    setLoading(false)
  }

  async function requestCompletion(job: Job) {
    if (!job.company_id) {
      setMessage(t('noCompany'))
      return
    }

    const confirmed = window.confirm(
      t('confirmCompletion')
    )

    if (!confirmed) {
      return
    }

    setBusyJobId(job.id)
    setMessage(null)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error(
          userError?.message || t('mustLogin')
        )
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error(
          t('sessionExpired')
        )
      }

      const response = await fetch(
        '/api/jobs/request-completion',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            jobId: job.id,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            t('completionFailed')
        )
      }

      setMessage(
        data.message ||
          t('completionSent')
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t('completionFailed')
      )
    } finally {
      setBusyJobId(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-300 shadow-2xl backdrop-blur">
          {t('loading')}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 pb-28 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl">
        <section className="mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-6 bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/10 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                {t('eyebrow')}
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
                {t('title')}
              </h1>

              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                {t('subtitle')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <Link
                href="/jobs"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-500/15"
              >
                {t('browseJobs')}
              </Link>

              <Link
                href="/worker/invites"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
              >
                {t('invites')}
              </Link>

              <Link
                href="/my-work"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
              >
                {t('myWork')}
              </Link>

              <Link
                href="/worker/payments"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-200 transition hover:bg-emerald-500/15"
              >
                {t('payments')}
              </Link>
            </div>
          </div>
        </section>

        <div className="mb-8">
          <WorkerLocationPresence />
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: t('assigned'), value: stats.assigned },
            { label: t('completed'), value: stats.completed },
            { label: t('paid'), value: stats.paid },
            { label: t('unpaid'), value: stats.unpaid },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 text-center shadow-xl backdrop-blur"
            >
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                {stat.label}
              </p>

              <p className="mt-2 text-3xl font-black text-white">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {message ? (
          <div className="mb-6 rounded-2xl border border-orange-400/20 bg-orange-500/10 p-4 text-sm font-bold text-orange-100">
            {message}
          </div>
        ) : null}

        {jobs.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center text-slate-400 shadow-2xl backdrop-blur">
            <p className="font-black text-white">
              {t('noWork')}
            </p>

            <Link
              href="/jobs"
              className="mt-5 inline-flex rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
            >
              {t('findWork')}
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {jobs.map((job) => {
              const jobStatus = normalize(job.status)
              const payStatus = normalize(job.payment_status)
              const payoutStatus = normalize(job.payout_status)
              const isCompleted = jobStatus === 'completed'
              const canMarkComplete = !isCompleted

              return (
                <article
                  key={job.id}
                  className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur sm:p-6"
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className={statusClass(isCompleted)}>
                          {isCompleted
                            ? t('completed')
                            : jobStatus === 'in_progress'
                              ? t('inProgress')
                              : t('assigned')}
                        </span>

                        <span className={paymentClass(payStatus)}>
                          {payStatus === 'paid' ? t('paid') : t('unpaid')}
                        </span>

                        {payoutStatus === 'released' ? (
                          <span className="rounded-full border border-cyan-300/20 bg-cyan-400/15 px-3 py-1 text-xs font-semibold capitalize text-cyan-100">
                            {t('released')}
                          </span>
                        ) : null}
                      </div>

                      <h2 className="text-2xl font-black text-white">
                        {job.title || t('untitledJob')}
                      </h2>

                      <p className="mt-1 text-sm font-semibold text-slate-400">
                        {job.trade || t('tradeNotSet')} •{' '}
                        {job.location || t('locationNotSet')}
                      </p>

                      <p className="mt-3 text-sm font-semibold text-slate-300">
                        {t('pay')}: {job.pay_rate || t('notSet')}
                      </p>

                      <p className="text-sm font-semibold text-slate-300">
                        {t('start')}: {formatDate(job.start_date, t('notScheduled'))}
                      </p>

                      {payStatus === 'paid' ? (
                        <p className="mt-3 text-sm font-black text-emerald-300">
                          {job.paid_at
                            ? t('paidOn', { date: formatDate(job.paid_at, t('notScheduled')) })
                            : t('paid')}
                        </p>
                      ) : null}

                      {isCompleted && payStatus !== 'paid' ? (
                        <p className="mt-3 text-sm font-black text-orange-300">
                          {t('completedWaiting')}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-3 md:justify-end">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-500/15"
                      >
                        {t('viewJob')}
                      </Link>

                      {job.company_id ? (
                        <Link
                          href={`/messages?start=${job.company_id}`}
                          className="rounded-2xl bg-blue-500 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-400"
                        >
                          {t('messageCompany')}
                        </Link>
                      ) : null}

                      {canMarkComplete ? (
                        <button
                          type="button"
                          onClick={() => void requestCompletion(job)}
                          disabled={busyJobId === job.id}
                          className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyJobId === job.id
                            ? t('sending')
                            : t('requestCompletion')}
                        </button>
                      ) : null}

                      {isCompleted &&
                      job.company_id &&
                      !reviewedJobIds.has(job.id) ? (
                        <Link
                          href={`/jobs/${job.id}/review?to=${job.company_id}`}
                          className="rounded-2xl bg-gradient-to-r from-orange-400 to-yellow-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:opacity-90"
                        >
                          {t('leaveReview')}
                        </Link>
                      ) : null}
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

function statusClass(isCompleted: boolean) {
  const base =
    'rounded-full px-3 py-1 text-xs font-semibold capitalize '

  if (isCompleted) {
    return base + 'bg-green-100 text-green-700'
  }

  return base + 'bg-blue-100 text-blue-700'
}

function paymentClass(status: string) {
  const base =
    'rounded-full px-3 py-1 text-xs font-semibold capitalize '

  if (status === 'paid') {
    return base + 'bg-green-100 text-green-700'
  }

  if (status === 'pending') {
    return base + 'bg-yellow-100 text-yellow-700'
  }

  return base + 'bg-gray-100 text-gray-700'
}