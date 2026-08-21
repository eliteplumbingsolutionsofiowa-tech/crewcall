'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  trade: string | null
  status: string | null
  pay_rate: number | null
  created_at: string | null
  start_date: string | null
  filled_at?: string | null
  is_featured?: boolean | null
  urgent?: boolean | null
  assigned_worker_id?: string | null
  company_id: string
}

type Application = {
  id: string
  job_id: string
  status: string | null
  created_at: string | null
}

type Review = {
  id: string
  rating: number | null
  created_at: string | null
}

type Message = {
  id: string
  job_id: string
  created_at: string | null
}

type JobView = {
  id: string
  job_id: string
  viewer_id: string | null
  created_at: string | null
}

type AnalyticsStats = {
  openJobs: number
  completedJobs: number
  applicants: number
  workersHired: number
  messages: number
  reviews: number
  avgRating: number
  featuredJobs: number
  urgentJobs: number
  totalSpend: number
  jobsFilled: number
  totalViews: number
  avgViewsPerJob: number
  featuredViews: number
  regularViews: number
}

export default function CompanyAnalyticsPage() {
  const t = useTranslations('CompanyAnalytics')
  const locale = useLocale()

  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [jobViews, setJobViews] = useState<JobView[]>([])
  const [error, setError] = useState('')

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setError(t('loginRequired'))
        setLoading(false)
        return
      }

      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('company_id', user.id)
        .order('created_at', { ascending: false })

      if (jobsError) throw jobsError

      const typedJobs = (jobsData || []) as Job[]
      setJobs(typedJobs)

      const jobIds = typedJobs.map((job) => job.id)

      if (jobIds.length === 0) {
        setApplications([])
        setReviews([])
        setMessages([])
        setJobViews([])
        setLoading(false)
        return
      }

      const [applicationsRes, reviewsRes, messagesRes, jobViewsRes] =
        await Promise.all([
          supabase
            .from('applications')
            .select('id, job_id, status, created_at')
            .in('job_id', jobIds),

          supabase
            .from('reviews')
            .select('id, rating, created_at')
            .eq('reviewee_id', user.id),

          supabase
            .from('messages')
            .select('id, job_id, created_at')
            .in('job_id', jobIds),

          supabase
            .from('job_views')
            .select('id, job_id, viewer_id, created_at')
            .in('job_id', jobIds),
        ])

      if (applicationsRes.error) throw applicationsRes.error
      if (reviewsRes.error) throw reviewsRes.error
      if (messagesRes.error) throw messagesRes.error
      if (jobViewsRes.error) throw jobViewsRes.error

      setApplications((applicationsRes.data || []) as Application[])
      setReviews((reviewsRes.data || []) as Review[])
      setMessages((messagesRes.data || []) as Message[])
      setJobViews((jobViewsRes.data || []) as JobView[])
    } catch (err) {
      console.error(err)
      setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadAnalytics()

    const refresh = () => {
      loadAnalytics()
    }

    const channel = supabase
      .channel('company-analytics-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        refresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        refresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        refresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_views' },
        refresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reviews' },
        refresh
      )
      .subscribe()

    window.addEventListener('focus', refresh)

    return () => {
      window.removeEventListener('focus', refresh)
      supabase.removeChannel(channel)
    }
  }, [loadAnalytics])

  const stats: AnalyticsStats = useMemo(() => {
    const completedJobs = jobs.filter((job) => job.status === 'completed')
    const hiredApplications = applications.filter(
      (app) => app.status === 'hired',
    )

    const totalRating = reviews.reduce(
      (sum, review) => sum + Number(review.rating || 0),
      0,
    )

    const avgRating =
      reviews.length > 0 ? Number((totalRating / reviews.length).toFixed(1)) : 0

    const totalSpend = completedJobs.reduce(
      (sum, job) => sum + Number(job.pay_rate || 0),
      0,
    )

    const featuredJobIds = jobs
      .filter((job) => Boolean(job.is_featured))
      .map((job) => job.id)

    const regularJobIds = jobs
      .filter((job) => !job.is_featured)
      .map((job) => job.id)

    const featuredViews = jobViews.filter((view) =>
      featuredJobIds.includes(view.job_id),
    ).length

    const regularViews = jobViews.filter((view) =>
      regularJobIds.includes(view.job_id),
    ).length

    return {
      openJobs: jobs.filter((job) => job.status === 'open').length,
      completedJobs: completedJobs.length,
      applicants: applications.length,
      workersHired: hiredApplications.length,
      messages: messages.length,
      reviews: reviews.length,
      avgRating,
      featuredJobs: featuredJobIds.length,
      urgentJobs: jobs.filter((job) => Boolean(job.urgent)).length,
      totalSpend,
      jobsFilled: jobs.filter(
        (job) => job.assigned_worker_id || job.status === 'completed',
      ).length,
      totalViews: jobViews.length,
      avgViewsPerJob:
        jobs.length > 0 ? Number((jobViews.length / jobs.length).toFixed(1)) : 0,
      featuredViews,
      regularViews,
    }
  }, [jobs, applications, reviews, messages, jobViews])

  const tradeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}

    jobs.forEach((job) => {
      const trade = job.trade || t('other')
      counts[trade] = (counts[trade] || 0) + 1
    })

    return Object.entries(counts)
      .map(([trade, count]) => ({
        trade,
        count,
        percent: jobs.length > 0 ? Math.round((count / jobs.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
  }, [jobs, t])


  const activity = useMemo(() => {
    const jobTitleMap = new Map(
      jobs.map((job) => [job.id, job.title || t('untitledJob')])
    )

    const items = [
      ...jobViews.map((view) => ({
        id: `view-${view.id}`,
        type: t('activity.view'),
        title: jobTitleMap.get(view.job_id) || t('job'),
        created_at: view.created_at,
      })),
      ...applications.map((application) => ({
        id: `application-${application.id}`,
        type:
          application.status === 'hired'
            ? t('activity.workerHired')
            : t('activity.newApplication'),
        title: jobTitleMap.get(application.job_id) || t('job'),
        created_at: application.created_at,
      })),
      ...messages.map((message) => ({
        id: `message-${message.id}`,
        type: t('activity.newMessage'),
        title: jobTitleMap.get(message.job_id) || t('job'),
        created_at: message.created_at,
      })),
      ...reviews.map((review) => ({
        id: `review-${review.id}`,
        type: t('activity.newReview'),
        title: t('activity.starRating', { rating: review.rating || 0 }),
        created_at: review.created_at,
      })),
    ]

    return items
      .filter((item) => item.created_at)
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      )
      .slice(0, 8)
  }, [jobs, jobViews, applications, messages, reviews, t])

  const chartData = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, index) => {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - (13 - index))
      return date
    })

    function countForDay(
      values: Array<{ created_at: string | null }>,
      day: Date
    ) {
      const nextDay = new Date(day)
      nextDay.setDate(nextDay.getDate() + 1)

      return values.filter((value) => {
        if (!value.created_at) return false
        const created = new Date(value.created_at)
        return created >= day && created < nextDay
      }).length
    }

    return days.map((day) => ({
      label: day.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
      }),
      views: countForDay(jobViews, day),
      applications: countForDay(applications, day),
    }))
  }, [jobViews, applications, locale])

  const insights = useMemo(() => {
    const result: string[] = []

    const featuredAverage =
      stats.featuredJobs > 0
        ? stats.featuredViews / stats.featuredJobs
        : 0

    const regularJobs = jobs.length - stats.featuredJobs
    const regularAverage =
      regularJobs > 0 ? stats.regularViews / regularJobs : 0

    if (featuredAverage > regularAverage && regularAverage > 0) {
      result.push(
        t('insights.featuredBetter', {
          multiplier: (featuredAverage / regularAverage).toFixed(1),
        })
      )
    }

    if (stats.totalViews > 0 && stats.applicants === 0) {
      result.push(
        t('insights.viewsNoApplications')
      )
    }

    if (stats.applicants > 0 && stats.workersHired === 0) {
      result.push(
        t('insights.applicantsNoHires')
      )
    }

    const completedWithoutReview = Math.max(
      stats.completedJobs - stats.reviews,
      0
    )

    if (completedWithoutReview > 0) {
      result.push(
        t('insights.needsReview', {
          count: completedWithoutReview,
        })
      )
    }

    if (stats.openJobs === 0) {
      result.push(
        t('insights.noOpenJobs')
      )
    }

    if (result.length === 0) {
      result.push(
        t('insights.healthy')
      )
    }

    return result.slice(0, 4)
  }, [jobs.length, stats, t])

  function getApplicationsForJob(jobId: string) {
    return applications.filter((app) => app.job_id === jobId)
  }

  function getMessagesForJob(jobId: string) {
    return messages.filter((message) => message.job_id === jobId)
  }

  function getViewsForJob(jobId: string) {
    return jobViews.filter((view) => view.job_id === jobId)
  }

  function formatMoney(value: number) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  }

  function formatDate(value: string | null) {
    if (!value) return t('notSet')

    return new Date(value).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-slate-300">{t('loading')}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-500/10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
              {t('eyebrow')}
            </p>

            <h1 className="mt-2 text-3xl font-black md:text-5xl">
              {t('title')}
            </h1>

            <p className="mt-3 max-w-2xl text-slate-300">
              {t('description')}
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/post-job"
              className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300"
            >
              {t('postJob')}
            </Link>

            <Link
              href="/company/jobs"
              className="rounded-xl border border-white/10 bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/15"
            >
              {t('myJobs')}
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        )}

        {!error && jobs.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <h2 className="text-2xl font-black">{t('noAnalytics')}</h2>

            <p className="mx-auto mt-3 max-w-xl text-slate-300">
              {t('noAnalyticsDescription')}
            </p>

            <Link
              href="/post-job"
              className="mt-6 inline-flex rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300"
            >
              {t('postFirstJob')}
            </Link>
          </div>
        )}

        {jobs.length > 0 && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label={t('totalViews')} value={stats.totalViews} />
              <StatCard label={t('avgViewsPerJob')} value={stats.avgViewsPerJob} />
              <StatCard label={t('openJobs')} value={stats.openJobs} />
              <StatCard label={t('completedJobs')} value={stats.completedJobs} />
              <StatCard label={t('applicants')} value={stats.applicants} />
              <StatCard label={t('workersHired')} value={stats.workersHired} />
              <StatCard label={t('messages')} value={stats.messages} />
              <StatCard label={t('reviews')} value={stats.reviews} />
              <StatCard label={t('jobsFilled')} value={stats.jobsFilled} />
              <StatCard label={t('averageRating')} value={`${stats.avgRating} ★`} />
              <StatCard label={t('totalSpend')} value={formatMoney(stats.totalSpend)} />
              <StatCard label={t('featuredJobs')} value={stats.featuredJobs} />
              <StatCard label={t('urgentJobs')} value={stats.urgentJobs} />
              <StatCard label={t('featuredViews')} value={stats.featuredViews} />
              <StatCard label={t('regularViews')} value={stats.regularViews} />              <StatCard
                label={t('avgViewsPerApplicant')}
                value={
                  stats.applicants > 0
                    ? (stats.totalViews / stats.applicants).toFixed(1)
                    : '0'
                }
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:col-span-2">
                <h2 className="text-2xl font-black">{t('hiringFunnel')}</h2>

                <div className="mt-6 grid gap-4 sm:grid-cols-5">
                  <FunnelStep label={t('views')} value={stats.totalViews} />
                  <FunnelStep label={t('jobsPosted')} value={jobs.length} />
                  <FunnelStep label={t('applicants')} value={stats.applicants} />
                  <FunnelStep label={t('hired')} value={stats.workersHired} />
                  <FunnelStep label={t('completed')} value={stats.completedJobs} />
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-2xl font-black">{t('tradeBreakdown')}</h2>

                <div className="mt-5 space-y-4">
                  {tradeBreakdown.map((item) => (
                    <div key={item.trade}>
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-white">
                          {item.trade}
                        </span>
                        <span className="text-slate-300">{item.percent}%</span>
                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-cyan-400"
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>


            <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-2xl font-black">{t('fourteenDayActivity')}</h2>
                <p className="mt-2 text-slate-300">
                  {t('dailyActivityDescription')}
                </p>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <BarChart
                    title={t('views')}
                    values={chartData.map((item) => ({
                      label: item.label,
                      value: item.views,
                    }))}
                  />

                  <BarChart
                    title={t('applications')}
                    values={chartData.map((item) => ({
                      label: item.label,
                      value: item.applications,
                    }))}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-2xl font-black">{t('crewCallInsights')}</h2>
                <p className="mt-2 text-slate-300">
                  {t('insightsDescription')}
                </p>

                <div className="mt-5 space-y-3">
                  {insights.map((insight) => (
                    <div
                      key={insight}
                      className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-4 text-sm font-semibold leading-6 text-cyan-50"
                    >
                      {insight}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-black">{t('recentActivity')}</h2>
              <p className="mt-2 text-slate-300">
                {t('recentActivityDescription')}
              </p>

              <div className="mt-5 space-y-3">
                {activity.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 text-slate-400">
                    {t('noRecentActivity')}
                  </div>
                ) : (
                  activity.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-black text-white">{item.type}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {item.title}
                        </p>
                      </div>

                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        {formatDate(item.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-black">
                    {t('featuredPerformance')}
                  </h2>

                  <p className="mt-2 text-slate-300">
                    {t('featuredPerformanceDescription')}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <ComparisonCard
                  label={t('featuredJobs')}
                  jobs={stats.featuredJobs}
                  views={stats.featuredViews}
                />

                <ComparisonCard
                  label={t('regularJobs')}
                  jobs={jobs.length - stats.featuredJobs}
                  views={stats.regularViews}
                />
              </div>
            </section>


            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-black">{t('topPerformingJobs')}</h2>
              <p className="mt-2 text-slate-300">
                {t('rankedByViews')}
              </p>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="border-b border-white/10 text-sm uppercase text-slate-400">
                    <tr>
                      <th className="py-3">{t('job')}</th>
                      <th className="py-3">{t('views')}</th>
                      <th className="py-3">{t('applicants')}</th>
                      <th className="py-3">{t('messages')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...jobs]
                      .sort(
                        (a,b)=>
                          getViewsForJob(b.id).length-getViewsForJob(a.id).length
                      )
                      .map(job=>(
                        <tr key={job.id} className="border-b border-white/5">
                          <td className="py-3 font-bold">{job.title || t('untitledJob')}</td>
                          <td>{getViewsForJob(job.id).length}</td>
                          <td>{getApplicationsForJob(job.id).length}</td>
                          <td>{getMessagesForJob(job.id).length}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-black">{t('jobPerformance')}</h2>

                  <p className="mt-2 text-slate-300">
                    {t('jobPerformanceDescription')}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {jobs.map((job) => {
                  const jobApplications = getApplicationsForJob(job.id)
                  const jobMessages = getMessagesForJob(job.id)
                  const views = getViewsForJob(job.id)

                  const hiredCount = jobApplications.filter(
                    (app) => app.status === 'hired',
                  ).length

                  return (
                    <div
                      key={job.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-xl font-black">
                            {job.title || t('untitledJob')}
                          </h3>

                          <p className="mt-1 text-sm text-slate-400">
                            {job.trade || t('tradeNotSet')} • {t('posted')}{' '}
                            {formatDate(job.created_at)}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {job.is_featured && (
                            <span className="rounded-full bg-yellow-400/15 px-3 py-1 text-xs font-bold text-yellow-200">
                              {t('featured')}
                            </span>
                          )}

                          {job.urgent && (
                            <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-200">
                              {t('urgent')}
                            </span>
                          )}

                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">
                            {job.status ? t(`statuses.${job.status}` as any) : t('statuses.unknown')}
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                        <MiniMetric label={t('views')} value={views.length} />
                        <MiniMetric
                          label={t('applicants')}
                          value={jobApplications.length}
                        />
                        <MiniMetric label={t('messages')} value={jobMessages.length} />
                        <MiniMetric label={t('hires')} value={hiredCount} />
                        <MiniMetric
                          label={t('pay')}
                          value={job.pay_rate ? formatMoney(job.pay_rate) : t('notAvailable')}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}


function BarChart({
  title,
  values,
}: {
  title: string
  values: Array<{
    label: string
    value: number
  }>
}) {
  const t = useTranslations('CompanyAnalytics')
  const maxValue = Math.max(...values.map((item) => item.value), 1)

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <div className="flex items-end justify-between">
        <p className="font-black text-white">{title}</p>
        <p className="text-sm font-bold text-cyan-200">
          {t('totalCount', { count: values.reduce((sum, item) => sum + item.value, 0) })}
        </p>
      </div>

      <div className="mt-6 flex h-44 items-end gap-1.5">
        {values.map((item) => {
          const height =
            item.value === 0
              ? 4
              : Math.max((item.value / maxValue) * 100, 8)

          return (
            <div
              key={`${title}-${item.label}`}
              className="group flex min-w-0 flex-1 flex-col items-center justify-end"
            >
              <div className="mb-2 hidden text-[10px] font-black text-white group-hover:block">
                {item.value}
              </div>

              <div
                className="w-full rounded-t-md bg-cyan-400/80 transition hover:bg-cyan-300"
                style={{ height: `${height}%` }}
                title={`${item.label}: ${item.value}`}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex justify-between text-[10px] font-bold text-slate-500">
        <span>{values[0]?.label}</span>
        <span>{values[values.length - 1]?.label}</span>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
    </div>
  )
}

function FunnelStep({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5 text-center">
      <p className="text-3xl font-black text-cyan-200">{value}</p>
      <p className="mt-2 text-sm font-bold text-slate-200">{label}</p>
    </div>
  )
}

function MiniMetric({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  )
}

function ComparisonCard({
  label,
  jobs,
  views,
}: {
  label: string
  jobs: number
  views: number
}) {
  const t = useTranslations('CompanyAnalytics')
  const avgViews = jobs > 0 ? Number((views / jobs).toFixed(1)) : 0

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <MiniMetric label={t('jobs')} value={jobs} />
        <MiniMetric label={t('views')} value={views} />
        <MiniMetric label={t('avg')} value={avgViews} />
      </div>
    </div>
  )
}