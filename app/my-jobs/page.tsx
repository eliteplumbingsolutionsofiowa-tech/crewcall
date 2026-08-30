'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  description: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  start_date: string | null
  status: string | null
  payment_status: string | null
  payout_status: string | null
  company_id: string
  assigned_worker_id: string | null
  assigned_worker: {
    id: string
    full_name: string | null
    trade: string | null
  } | null
  created_at: string
  applicant_count: number
  view_count: number
}

type Filter =
  | 'all'
  | 'open'
  | 'assigned'
  | 'completed'
  | 'paid'
  | 'unpaid'
  | 'not_released'

function formatDate(value: string | null, locale: string, notSet: string) {
  if (!value) return notSet

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return notSet
  }

  return date.toLocaleDateString(locale)
}

function statusClasses(status: string | null) {
  const value = status || 'open'

  if (value === 'completed') {
    return 'border-emerald-300/20 bg-emerald-400/15 text-emerald-100'
  }

  if (value === 'assigned') {
    return 'border-cyan-300/20 bg-cyan-400/15 text-cyan-100'
  }

  if (value === 'cancelled') {
    return 'border-red-300/20 bg-red-400/15 text-red-100'
  }

  return 'border-yellow-300/20 bg-yellow-400/15 text-yellow-100'
}

function paymentClasses(status: string | null) {
  const value = status || 'unpaid'

  if (value === 'paid') {
    return 'border-emerald-300/20 bg-emerald-400/15 text-emerald-100'
  }

  if (value === 'pending') {
    return 'border-orange-300/20 bg-orange-400/15 text-orange-100'
  }

  return 'border-slate-300/20 bg-slate-400/10 text-slate-200'
}

function payoutClasses(status: string | null) {
  const value = status || 'not_released'

  if (value === 'released') {
    return 'border-emerald-300/20 bg-emerald-400/15 text-emerald-100'
  }

  if (value === 'pending') {
    return 'border-orange-300/20 bg-orange-400/15 text-orange-100'
  }

  return 'border-blue-300/20 bg-blue-400/15 text-blue-100'
}

export default function MyJobsPage() {
  const router = useRouter()
  const t = useTranslations('MyJobs')
  const locale = useLocale()

  const [jobs, setJobs] = useState<Job[]>([])
  const [reviewedJobIds, setReviewedJobIds] = useState<Set<string>>(
    () => new Set()
  )
  const [completionRequestedJobIds, setCompletionRequestedJobIds] =
    useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const loadJobs = useCallback(async () => {
    setRefreshing(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.push('/login')
      return
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      router.push('/login')
      return
    }

    const response = await fetch('/api/company/jobs', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    const responseText = await response.text()

    let data: {
      jobs?: Omit<Job, 'applicant_count' | 'view_count'>[]
      error?: string
    } = {}

    if (responseText) {
      try {
        data = JSON.parse(responseText)
      } catch {
        data = {}
      }
    }

    if (!response.ok) {
      if (response.status === 403) {
        router.push('/worker/dashboard')
        return
      }

      setMessage(data.error || 'Unable to load company jobs.')
      setJobs([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const cleanJobs = (data.jobs || []) as Omit<
      Job,
      'applicant_count' | 'view_count'
    >[]
    const jobIds = cleanJobs.map((job) => job.id)
    if (jobIds.length > 0) {
      const {
        data: completionNotifications,
        error: completionNotificationsError,
      } = await supabase
        .from('notifications')
        .select('title, link_url')
        .eq('user_id', user.id)
        .eq('type', 'job')
        .eq('title', 'Worker says job is complete')

      if (completionNotificationsError) {
        console.error(
          'Unable to load completion request notifications:',
          completionNotificationsError
        )
        setCompletionRequestedJobIds(new Set())
      } else {
        const requestedIds = new Set<string>()

        ;(completionNotifications || []).forEach((notification: any) => {
          const match = String(notification.link_url || '').match(
            /^\/my-jobs\/([^/?#]+)/
          )

          if (match?.[1] && jobIds.includes(match[1])) {
            requestedIds.add(match[1])
          }
        })

        setCompletionRequestedJobIds(requestedIds)
      }
    } else {
      setCompletionRequestedJobIds(new Set())
    }

    const countMap = new Map<string, number>()
    const viewMap = new Map<string, number>()

    if (jobIds.length > 0) {
      const { data: applicationsData } = await supabase
        .from('applications')
        .select('id, job_id')
        .in('job_id', jobIds)

      ;(applicationsData || []).forEach((app: any) => {
        countMap.set(app.job_id, (countMap.get(app.job_id) || 0) + 1)
      })

      const { data: viewsData } = await supabase
        .from('job_views')
        .select('job_id')
        .in('job_id', jobIds)

      ;(viewsData || []).forEach((view: any) => {
        viewMap.set(
          view.job_id,
          (viewMap.get(view.job_id) || 0) + 1
        )
      })
    }

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

    const workerIds = cleanJobs
      .map((job) => job.assigned_worker_id)
      .filter(Boolean) as string[]

    const { data: workersData } =
      workerIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name, trade')
            .in('id', workerIds)
        : { data: [] }

    const workerMap = new Map(
      (workersData || []).map((worker) => [
        worker.id,
        worker,
      ])
    )

    const mergedJobs: Job[] = cleanJobs.map((job) => ({
      ...job,
      assigned_worker: job.assigned_worker_id
        ? workerMap.get(job.assigned_worker_id) || null
        : null,
      payout_status: job.payout_status || 'not_released',
      applicant_count: countMap.get(job.id) || 0,
      view_count: viewMap.get(job.id) || 0,
    }))

    setJobs(mergedJobs)
    setLoading(false)
    setRefreshing(false)

    window.dispatchEvent(new Event('crewcall-refresh-nav'))
  }, [router])

  useEffect(() => {
    let mounted = true

    async function boot() {
      if (!mounted) return
      await loadJobs()
    }

    boot()

    const refresh = async () => {
      if (!mounted) return
      await loadJobs()
      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    }

    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    const jobsChannel = supabase
      .channel('my-jobs-live-sync-upgraded')
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

    const applicationsChannel = supabase
      .channel('my-jobs-applications-sync-upgraded')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
        },
        refresh
      )
      .subscribe()

    return () => {
      mounted = false

      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', handleVisibility)

      supabase.removeChannel(jobsChannel)
      supabase.removeChannel(applicationsChannel)
    }
  }, [loadJobs])

  const dedupedJobs = useMemo(() => {
    const seen = new Set<string>()

    return jobs.filter((job) => {
      if (seen.has(job.id)) return false
      seen.add(job.id)
      return true
    })
  }, [jobs])

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase()

    return dedupedJobs.filter((job) => {
      const matchesFilter =
        filter === 'all' ||
        job.status === filter ||
        (filter === 'paid' && job.payment_status === 'paid') ||
        (filter === 'unpaid' && job.payment_status !== 'paid') ||
        (filter === 'not_released' &&
          job.status === 'completed' &&
          job.payment_status === 'paid' &&
          job.payout_status !== 'released')

      const haystack = [
        job.title,
        job.description,
        job.trade,
        job.location,
        job.pay_rate,
        job.status,
        job.payment_status,
        job.payout_status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !term || haystack.includes(term)

      return matchesFilter && matchesSearch
    })
  }, [dedupedJobs, filter, search])

  const stats = useMemo(() => {
    const totalViews = dedupedJobs.reduce(
      (total, job) => total + job.view_count,
      0
    )

    const totalApplicants = dedupedJobs.reduce(
      (total, job) => total + job.applicant_count,
      0
    )

    const averageViews =
      dedupedJobs.length > 0
        ? totalViews / dedupedJobs.length
        : 0

    const conversionRate =
      totalViews > 0
        ? (totalApplicants / totalViews) * 100
        : 0

    return {
      total: dedupedJobs.length,
      open: dedupedJobs.filter((job) => job.status === 'open').length,
      assigned: dedupedJobs.filter((job) => job.status === 'assigned').length,
      completed: dedupedJobs.filter((job) => job.status === 'completed').length,
      paid: dedupedJobs.filter((job) => job.payment_status === 'paid').length,
      needsPayout: dedupedJobs.filter(
        (job) =>
          job.status === 'completed' &&
          job.payment_status === 'paid' &&
          job.payout_status !== 'released'
      ).length,
      totalViews,
      totalApplicants,
      averageViews,
      conversionRate,
    }
  }, [dedupedJobs])

  async function deleteJob(job: Job) {
    const canDelete =
      job.status === 'open' &&
      !job.assigned_worker_id &&
      job.payment_status !== 'paid' &&
      job.payment_status !== 'pending'

    if (!canDelete) {
      setMessage('Only open, unpaid, unassigned jobs can be deleted.')
      return
    }

    const confirmed = window.confirm(
      `Delete "${job.title || 'this job'}"? This cannot be undone.`
    )

    if (!confirmed) return

    setMessage(null)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      router.push('/login')
      return
    }

    const response = await fetch('/api/jobs/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ jobId: job.id }),
    })

    const responseText = await response.text()
    let payload: { error?: string } = {}

    if (responseText) {
      try {
        payload = JSON.parse(responseText)
      } catch {
        payload = {}
      }
    }

    if (!response.ok) {
      setMessage(payload.error || 'Unable to delete job.')
      return
    }

    await loadJobs()
  }

  function clearFilters() {
    setSearch('')
    setFilter('all')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black">{t('loadingJobs')}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/10 p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  {t('companyDashboard')}
                </p>

                <h1 className="mt-3 text-5xl font-black tracking-tight text-white">
                  {t('myJobs')}
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  {t('description')}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/completed-jobs"
                  className="rounded-2xl border border-white/10 bg-white/10 px-6 py-4 text-sm font-black text-white transition hover:bg-white/20"
                >
                  {t('completedJobs')}
                </Link>

                <Link
                  href="/post-job"
                  className="rounded-2xl bg-cyan-400 px-6 py-4 text-sm font-black text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-[1.02] hover:bg-cyan-300"
                >
                  {t('postNewJob')}
                </Link>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <StatCard label={t('total')} value={String(stats.total)} />
              <StatCard label={t('open')} value={String(stats.open)} />
              <StatCard label={t('assigned')} value={String(stats.assigned)} />
              <StatCard label={t('completed')} value={String(stats.completed)} />
              <StatCard label={t('paid')} value={String(stats.paid)} />
              <StatCard label={t('needsPayout')} value={String(stats.needsPayout)} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <AnalyticsCard
                label={t('totalViews')}
                value={String(stats.totalViews)}
                helper={t('acrossAllPostedJobs')}
              />

              <AnalyticsCard
                label={t('totalApplicants')}
                value={String(stats.totalApplicants)}
                helper={t('acrossAllPostedJobs')}
              />

              <AnalyticsCard
                label={t('averageViews')}
                value={stats.averageViews.toFixed(1)}
                helper={t('averageViewsPerJob')}
              />

              <AnalyticsCard
                label={t('conversionRate')}
                value={`${stats.conversionRate.toFixed(1)}%`}
                helper={t('applicantsDividedByViews')}
              />
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_auto_auto] lg:items-end">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                {t('searchJobs')}
              </label>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                {t('filter')}
              </label>

              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as Filter)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none"
              >
                <option value="all">{t('all')}</option>
                <option value="open">{t('open')}</option>
                <option value="assigned">{t('assigned')}</option>
                <option value="completed">{t('completed')}</option>
                <option value="paid">{t('paid')}</option>
                <option value="unpaid">{t('unpaid')}</option>
                <option value="not_released">{t('needsPayout')}</option>
              </select>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
            >
              {t('clear')}
            </button>

            <button
              type="button"
              onClick={loadJobs}
              className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-[1.02] hover:bg-cyan-300"
            >
              {refreshing ? t('refreshing') : t('refresh')}
            </button>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        )}

        {filteredJobs.length === 0 && (
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-10 text-center shadow-2xl backdrop-blur">
            <h2 className="text-3xl font-black text-white">{t('noJobsFound')}</h2>

            <p className="mt-3 text-slate-300">
              {t('noJobsDescription')}
            </p>

            <Link
              href="/post-job"
              className="mt-6 inline-flex rounded-2xl bg-cyan-400 px-6 py-4 text-sm font-black text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-[1.02] hover:bg-cyan-300"
            >
              {t('postAJob')}
            </Link>
          </div>
        )}

        <div className="grid gap-5">
          {filteredJobs.map((job) => {
            const isPaid = job.payment_status === 'paid'
            const isCompleted = job.status === 'completed'
            const completionRequested =
              !isCompleted && completionRequestedJobIds.has(job.id)
            const payoutReleased = job.payout_status === 'released'
            const canPay = !isPaid && Boolean(job.assigned_worker_id)
            const canReleasePayout = isPaid && isCompleted && !payoutReleased
            const canReview =
              isCompleted &&
              payoutReleased &&
              Boolean(job.assigned_worker_id)

            return (
              <div
                key={job.id}
                className="group rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:border-cyan-300/20"
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-black text-white">
                          {job.title || t('untitledJob')}
                        </h2>

                        <Badge
                          value={job.status || 'open'}
                          label={t(`status_${job.status || 'open'}`)}
                          type="status"
                        />

                        <Badge
                          value={job.payment_status || 'unpaid'}
                          label={t(`payment_${job.payment_status || 'unpaid'}`)}
                          type="payment"
                        />
                        {completionRequested && (
                          <span className="rounded-full border border-orange-300/20 bg-orange-400/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-orange-100">
                            {t('completionRequested')}
                          </span>
                        )}

                        {isCompleted && (
                          <Badge
                            value={job.payout_status || 'not_released'}
                            label={t(`payout_${job.payout_status || 'not_released'}`)}
                            type="payout"
                          />
                        )}
                      </div>

                      <p className="mt-2 text-sm font-semibold text-slate-400">
                        {job.trade || t('tradeNotSet')} •{' '}
                        {job.location || t('locationNotSet')}
                      </p>
                    </div>

                    {job.description && (
                      <p className="max-w-3xl text-sm leading-6 text-slate-300">
                        {job.description}
                      </p>
                    )}

                    <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
                      <Info label={t('pay')} value={job.pay_rate || t('notSet')} />

                      <Info label={t('start')} value={formatDate(job.start_date, locale, t('notSet'))} />

                      <Info
                        label={t('applicants')}
                        value={String(job.applicant_count)}
                      />

                      <Info
                        label={t('views')}
                        value={String(job.view_count)}
                      />

                      <Info label={t('posted')} value={formatDate(job.created_at, locale, t('notSet'))} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 lg:w-[260px] lg:flex-col">

                    {job.assigned_worker && (
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-5 py-4 text-center">
                        <div className="text-xs font-black uppercase tracking-wide text-emerald-200">
                          {t('assignedWorker')}
                        </div>
                        <div className="mt-1 text-sm font-black text-white">
                          {job.assigned_worker.full_name || t('worker')}
                        </div>
                        {job.assigned_worker.trade && (
                          <div className="mt-1 text-xs font-bold text-emerald-100">
                            {job.assigned_worker.trade}
                          </div>
                        )}
                      </div>
                    )}

                    {!isCompleted && (
                      <Link
                        href={`/my-jobs/${job.id}/applicants`}
                        className={
                          job.assigned_worker_id
                            ? "rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white/20"
                            : "rounded-2xl bg-cyan-500 px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-cyan-400"
                        }
                      >
                        {job.assigned_worker_id
                          ? t('viewApplicants')
                          : t('reviewNegotiate')}
                      </Link>
                    )}

                    {completionRequested && (
                      <Link
                        href={`/my-jobs/${job.id}`}
                        className="rounded-2xl bg-orange-500 px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-orange-400"
                      >
                        {t('reviewCompleteJob')}
                      </Link>
                    )}
                    <Link
                      href={`/my-jobs/${job.id}`}
                      className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white/20"
                    >
                      {t('viewJob')}
                    </Link>

                    {job.status === 'open' &&
                      !job.assigned_worker_id &&
                      job.payment_status !== 'paid' &&
                      job.payment_status !== 'pending' && (
                        <button
                          type="button"
                          onClick={() => deleteJob(job)}
                          className="rounded-2xl border border-red-400/30 bg-red-500/15 px-5 py-3 text-center text-sm font-black text-red-100 transition hover:bg-red-500/25"
                        >
                          Delete Job
                        </button>
                      )}

                    {canPay && (
                      <Link
                        href={`/jobs/${job.id}/pay`}
                        className="rounded-2xl bg-green-600 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-green-500"
                      >
                        {t('fundJob')}
                      </Link>
                    )}

                    {canReleasePayout && (
                      <Link
                        href={`/jobs/${job.id}/release-payout`}
                        className="rounded-2xl bg-emerald-600 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-emerald-500"
                      >
                        {t('releasePayout')}
                      </Link>
                    )}

                    {isCompleted && (
                      <>
                        <Link
                          href="/completed-jobs"
                          className="rounded-2xl bg-purple-600 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-purple-500"
                        >
                          {t('viewCompleted')}
                        </Link>

                        {canReview &&
                          !reviewedJobIds.has(job.id) && (
                          <Link
                            href={`/jobs/${job.id}/review?to=${job.assigned_worker_id}`}
                            className="rounded-2xl bg-orange-500 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-orange-400"
                          >
                            {t('leaveReview')}
                          </Link>
                        )}
                      </>
                    )}

                    {job.assigned_worker_id && (
                      <Link
                        href={`/messages?workerId=${job.assigned_worker_id}&jobId=${job.id}`}
                        className="rounded-2xl bg-blue-500 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-blue-400"
                      >
                        {t('messageWorker')}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-3 text-4xl font-black tracking-tight text-white">
        {value}
      </p>
    </div>
  )
}

function AnalyticsCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-3xl border border-cyan-300/10 bg-cyan-400/5 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-cyan-200">
        {label}
      </p>

      <p className="mt-3 text-3xl font-black tracking-tight text-white">
        {value}
      </p>

      <p className="mt-2 text-xs font-semibold text-slate-400">
        {helper}
      </p>
    </div>
  )
}

function Badge({
  value,
  label,
  type,
}: {
  value: string
  label: string
  type: 'status' | 'payment' | 'payout'
}) {
  const classes =
    type === 'payment'
      ? paymentClasses(value)
      : type === 'payout'
        ? payoutClasses(value)
        : statusClasses(value)

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${classes}`}
    >
      {label}
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

      <p className="mt-2 text-sm font-bold text-white">{value}</p>
    </div>
  )
}