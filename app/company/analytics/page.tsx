'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
        setError('Please log in to view analytics.')
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
      setError('Could not load company analytics.')
    } finally {
      setLoading(false)
    }
  }, [])

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
      const trade = job.trade || 'Other'
      counts[trade] = (counts[trade] || 0) + 1
    })

    return Object.entries(counts)
      .map(([trade, count]) => ({
        trade,
        count,
        percent: jobs.length > 0 ? Math.round((count / jobs.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
  }, [jobs])


  const activity = useMemo(() => {
    const jobTitleMap = new Map(
      jobs.map((job) => [job.id, job.title || 'Untitled Job'])
    )

    const items = [
      ...jobViews.map((view) => ({
        id: `view-${view.id}`,
        type: 'View',
        title: jobTitleMap.get(view.job_id) || 'Job',
        created_at: view.created_at,
      })),
      ...applications.map((application) => ({
        id: `application-${application.id}`,
        type:
          application.status === 'hired'
            ? 'Worker hired'
            : 'New application',
        title: jobTitleMap.get(application.job_id) || 'Job',
        created_at: application.created_at,
      })),
      ...messages.map((message) => ({
        id: `message-${message.id}`,
        type: 'New message',
        title: jobTitleMap.get(message.job_id) || 'Job',
        created_at: message.created_at,
      })),
      ...reviews.map((review) => ({
        id: `review-${review.id}`,
        type: 'New review',
        title: `${review.rating || 0} star rating`,
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
  }, [jobs, jobViews, applications, messages, reviews])

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
      label: day.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      views: countForDay(jobViews, day),
      applications: countForDay(applications, day),
    }))
  }, [jobViews, applications])

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
        `Featured jobs average ${(featuredAverage / regularAverage).toFixed(
          1
        )}× more views than regular jobs.`
      )
    }

    if (stats.totalViews > 0 && stats.applicants === 0) {
      result.push(
        'Your jobs are receiving views but no applications yet. Consider improving pay, title, or job details.'
      )
    }

    if (stats.applicants > 0 && stats.workersHired === 0) {
      result.push(
        'You have applicants waiting but no recorded hires yet.'
      )
    }

    const completedWithoutReview = Math.max(
      stats.completedJobs - stats.reviews,
      0
    )

    if (completedWithoutReview > 0) {
      result.push(
        `${completedWithoutReview} completed ${
          completedWithoutReview === 1 ? 'job still needs' : 'jobs still need'
        } a review.`
      )
    }

    if (stats.openJobs === 0) {
      result.push(
        'You have no open jobs. Post a new job to keep your worker pipeline active.'
      )
    }

    if (result.length === 0) {
      result.push(
        'Your company activity looks healthy. Keep monitoring views and applications as more jobs are posted.'
      )
    }

    return result.slice(0, 4)
  }, [jobs.length, stats])

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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  }

  function formatDate(value: string | null) {
    if (!value) return 'Not set'

    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-slate-300">Loading analytics...</p>
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
              Company Analytics
            </p>

            <h1 className="mt-2 text-3xl font-black md:text-5xl">
              Hiring performance
            </h1>

            <p className="mt-3 max-w-2xl text-slate-300">
              Track job views, applicants, hires, messages, reviews, and paid
              upgrades in one place.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/post-job"
              className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300"
            >
              Post Job
            </Link>

            <Link
              href="/company/jobs"
              className="rounded-xl border border-white/10 bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/15"
            >
              My Jobs
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
            <h2 className="text-2xl font-black">No analytics yet</h2>

            <p className="mx-auto mt-3 max-w-xl text-slate-300">
              Once you post jobs and start getting views, applicants, and hires,
              your company analytics will show here.
            </p>

            <Link
              href="/post-job"
              className="mt-6 inline-flex rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300"
            >
              Post Your First Job
            </Link>
          </div>
        )}

        {jobs.length > 0 && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total Views" value={stats.totalViews} />
              <StatCard label="Avg Views / Job" value={stats.avgViewsPerJob} />
              <StatCard label="Open Jobs" value={stats.openJobs} />
              <StatCard label="Completed Jobs" value={stats.completedJobs} />
              <StatCard label="Applicants" value={stats.applicants} />
              <StatCard label="Workers Hired" value={stats.workersHired} />
              <StatCard label="Messages" value={stats.messages} />
              <StatCard label="Reviews" value={stats.reviews} />
              <StatCard label="Jobs Filled" value={stats.jobsFilled} />
              <StatCard label="Average Rating" value={`${stats.avgRating} ★`} />
              <StatCard label="Total Spend" value={formatMoney(stats.totalSpend)} />
              <StatCard label="Featured Jobs" value={stats.featuredJobs} />
              <StatCard label="Urgent Jobs" value={stats.urgentJobs} />
              <StatCard label="Featured Views" value={stats.featuredViews} />
              <StatCard label="Regular Views" value={stats.regularViews} />              <StatCard
                label="Average Views / Applicant"
                value={
                  stats.applicants > 0
                    ? (stats.totalViews / stats.applicants).toFixed(1)
                    : '0'
                }
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:col-span-2">
                <h2 className="text-2xl font-black">Hiring Funnel</h2>

                <div className="mt-6 grid gap-4 sm:grid-cols-5">
                  <FunnelStep label="Views" value={stats.totalViews} />
                  <FunnelStep label="Jobs Posted" value={jobs.length} />
                  <FunnelStep label="Applicants" value={stats.applicants} />
                  <FunnelStep label="Hired" value={stats.workersHired} />
                  <FunnelStep label="Completed" value={stats.completedJobs} />
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-2xl font-black">Trade Breakdown</h2>

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
                <h2 className="text-2xl font-black">14-Day Activity</h2>
                <p className="mt-2 text-slate-300">
                  Daily job views and applications.
                </p>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <BarChart
                    title="Views"
                    values={chartData.map((item) => ({
                      label: item.label,
                      value: item.views,
                    }))}
                  />

                  <BarChart
                    title="Applications"
                    values={chartData.map((item) => ({
                      label: item.label,
                      value: item.applications,
                    }))}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-2xl font-black">CrewCall Insights</h2>
                <p className="mt-2 text-slate-300">
                  Actionable observations from your current data.
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
              <h2 className="text-2xl font-black">Recent Activity</h2>
              <p className="mt-2 text-slate-300">
                The latest activity across your jobs.
              </p>

              <div className="mt-5 space-y-3">
                {activity.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 text-slate-400">
                    No recent activity yet.
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
                    Featured Job Performance
                  </h2>

                  <p className="mt-2 text-slate-300">
                    Compare paid featured listings against regular job posts.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <ComparisonCard
                  label="Featured Jobs"
                  jobs={stats.featuredJobs}
                  views={stats.featuredViews}
                />

                <ComparisonCard
                  label="Regular Jobs"
                  jobs={jobs.length - stats.featuredJobs}
                  views={stats.regularViews}
                />
              </div>
            </section>


            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-black">Top Performing Jobs</h2>
              <p className="mt-2 text-slate-300">
                Ranked by total job views.
              </p>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="border-b border-white/10 text-sm uppercase text-slate-400">
                    <tr>
                      <th className="py-3">Job</th>
                      <th className="py-3">Views</th>
                      <th className="py-3">Applicants</th>
                      <th className="py-3">Messages</th>
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
                          <td className="py-3 font-bold">{job.title || 'Untitled Job'}</td>
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
                  <h2 className="text-2xl font-black">Job Performance</h2>

                  <p className="mt-2 text-slate-300">
                    See which jobs are getting views, applicants, messages, and
                    hires.
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
                            {job.title || 'Untitled Job'}
                          </h3>

                          <p className="mt-1 text-sm text-slate-400">
                            {job.trade || 'Trade not set'} • Posted{' '}
                            {formatDate(job.created_at)}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {job.is_featured && (
                            <span className="rounded-full bg-yellow-400/15 px-3 py-1 text-xs font-bold text-yellow-200">
                              Featured
                            </span>
                          )}

                          {job.urgent && (
                            <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-200">
                              Urgent
                            </span>
                          )}

                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">
                            {job.status || 'unknown'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                        <MiniMetric label="Views" value={views.length} />
                        <MiniMetric
                          label="Applicants"
                          value={jobApplications.length}
                        />
                        <MiniMetric label="Messages" value={jobMessages.length} />
                        <MiniMetric label="Hires" value={hiredCount} />
                        <MiniMetric
                          label="Pay"
                          value={job.pay_rate ? formatMoney(job.pay_rate) : 'N/A'}
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
  const maxValue = Math.max(...values.map((item) => item.value), 1)

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <div className="flex items-end justify-between">
        <p className="font-black text-white">{title}</p>
        <p className="text-sm font-bold text-cyan-200">
          {values.reduce((sum, item) => sum + item.value, 0)} total
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
  const avgViews = jobs > 0 ? Number((views / jobs).toFixed(1)) : 0

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <MiniMetric label="Jobs" value={jobs} />
        <MiniMetric label="Views" value={views} />
        <MiniMetric label="Avg" value={avgViews} />
      </div>
    </div>
  )
}