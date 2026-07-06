'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  status: string | null
  pay_rate: number | null
  created_at: string | null
  company_id: string
  assigned_worker_id: string | null
  is_featured?: boolean | null
  urgent?: boolean | null
  payment_status?: string | null
}

type Application = {
  id: string
  job_id: string
  worker_id: string
  status: string | null
  created_at: string | null
}

type Message = {
  id: string
  job_id: string | null
  body: string | null
  created_at: string | null
}

type Notification = {
  id: string
  title: string | null
  body: string | null
  link_url: string | null
  is_read: boolean | null
  read: boolean | null
  created_at: string | null
}

type JobView = {
  id: string
  job_id: string
  viewer_id: string | null
  created_at: string | null
}

type Review = {
  id: string
  rating: number | null
  created_at: string | null
}

export default function CompanyDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [jobViews, setJobViews] = useState<JobView[]>([])
  const [reviews, setReviews] = useState<Review[]>([])

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    setError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setError('Please log in to view your company dashboard.')
        setLoading(false)
        return
      }

      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('company_id', user.id)
        .order('created_at', { ascending: false })

      if (jobsError) throw jobsError

      const loadedJobs = (jobsData || []) as Job[]
      setJobs(loadedJobs)

      const jobIds = loadedJobs.map((job) => job.id)

      const [notificationsRes, reviewsRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('id, title, body, link_url, is_read, read, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(6),

        supabase
          .from('reviews')
          .select('id, rating, created_at')
          .eq('reviewee_id', user.id),
      ])

      if (notificationsRes.error) throw notificationsRes.error
      if (reviewsRes.error) throw reviewsRes.error

      setNotifications((notificationsRes.data || []) as Notification[])
      setReviews((reviewsRes.data || []) as Review[])

      if (jobIds.length === 0) {
        setApplications([])
        setMessages([])
        setJobViews([])
        setLoading(false)
        return
      }

      const [applicationsRes, messagesRes, viewsRes] = await Promise.all([
        supabase
          .from('applications')
          .select('id, job_id, worker_id, status, created_at')
          .in('job_id', jobIds)
          .order('created_at', { ascending: false }),

        supabase
          .from('messages')
          .select('id, job_id, body, created_at')
          .in('job_id', jobIds)
          .order('created_at', { ascending: false })
          .limit(8),

        supabase
          .from('job_views')
          .select('id, job_id, viewer_id, created_at')
          .in('job_id', jobIds),
      ])

      if (applicationsRes.error) throw applicationsRes.error
      if (messagesRes.error) throw messagesRes.error
      if (viewsRes.error) throw viewsRes.error

      setApplications((applicationsRes.data || []) as Application[])
      setMessages((messagesRes.data || []) as Message[])
      setJobViews((viewsRes.data || []) as JobView[])
    } catch (err) {
      console.error(err)
      setError('Could not load company dashboard.')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const openJobs = jobs.filter((job) => job.status === 'open').length
    const completedJobs = jobs.filter((job) => job.status === 'completed').length
    const assignedJobs = jobs.filter((job) => Boolean(job.assigned_worker_id)).length

    const unreadNotifications = notifications.filter(
      (item) => item.is_read === false || item.read === false,
    ).length

    const avgRating =
      reviews.length > 0
        ? Number(
            (
              reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) /
              reviews.length
            ).toFixed(1),
          )
        : 0

    return {
      openJobs,
      completedJobs,
      assignedJobs,
      applications: applications.length,
      messages: messages.length,
      views: jobViews.length,
      unreadNotifications,
      avgRating,
      featuredJobs: jobs.filter((job) => Boolean(job.is_featured)).length,
      urgentJobs: jobs.filter((job) => Boolean(job.urgent)).length,
      unpaidJobs: jobs.filter(
        (job) => job.assigned_worker_id && job.payment_status !== 'paid',
      ).length,
    }
  }, [jobs, applications, messages, notifications, jobViews, reviews])

  const recentApplications = applications.slice(0, 5)
  const recentMessages = messages.slice(0, 5)

  const jobsNeedingAttention = jobs.filter((job) => {
    const jobApps = applications.filter((app) => app.job_id === job.id)
    return job.status === 'open' && jobApps.length === 0
  })

  function getJobTitle(jobId: string | null) {
    if (!jobId) return 'Unknown job'
    return jobs.find((job) => job.id === jobId)?.title || 'Unknown job'
  }

  function formatDate(value: string | null) {
    if (!value) return 'Unknown date'

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
          <p className="text-slate-300">Loading company dashboard...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-500/10 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                Company Dashboard
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                What needs attention today?
              </h1>

              <p className="mt-3 max-w-2xl text-slate-300">
                Manage jobs, applicants, messages, notifications, and hiring
                performance from one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/post-job"
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
              >
                Post Job
              </Link>

              <Link
                href="/workers"
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
              >
                Find Workers
              </Link>

              <Link
                href="/company/analytics"
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
              >
                Analytics
              </Link>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        )}

        {!error && jobs.length === 0 && (
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center">
            <h2 className="text-3xl font-black">Start by posting your first job</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-300">
              Once you post jobs, this dashboard will show applicants, messages,
              views, payments, and jobs that need attention.
            </p>

            <Link
              href="/post-job"
              className="mt-6 inline-flex rounded-2xl bg-cyan-400 px-6 py-4 text-sm font-black text-slate-950 hover:bg-cyan-300"
            >
              Post Your First Job
            </Link>
          </section>
        )}

        {jobs.length > 0 && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Open Jobs" value={stats.openJobs} />
              <StatCard label="Applicants" value={stats.applications} />
              <StatCard label="Messages" value={stats.messages} />
              <StatCard label="Job Views" value={stats.views} />
              <StatCard label="Assigned Jobs" value={stats.assignedJobs} />
              <StatCard label="Completed Jobs" value={stats.completedJobs} />
              <StatCard label="Urgent Jobs" value={stats.urgentJobs} />
              <StatCard label="Featured Jobs" value={stats.featuredJobs} />
              <StatCard label="Needs Payment" value={stats.unpaidJobs} />
              <StatCard label="Unread Alerts" value={stats.unreadNotifications} />
              <StatCard label="Reviews" value={reviews.length} />
              <StatCard label="Rating" value={`${stats.avgRating} ★`} />
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <DashboardPanel
                title="Recent Applicants"
                description="Latest workers applying to your jobs."
                href="/my-jobs"
                hrefLabel="View Jobs"
              >
                {recentApplications.length === 0 ? (
                  <EmptyText text="No applicants yet." />
                ) : (
                  <div className="space-y-3">
                    {recentApplications.map((app) => (
                      <Link
                        key={app.id}
                        href={`/my-jobs/${app.job_id}/applicants`}
                        className="block rounded-2xl border border-white/10 bg-slate-950/60 p-4 hover:border-cyan-400/30"
                      >
                        <p className="font-black text-white">
                          {getJobTitle(app.job_id)}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Status: {app.status || 'pending'} •{' '}
                          {formatDate(app.created_at)}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </DashboardPanel>

              <DashboardPanel
                title="Recent Messages"
                description="Newest activity from job conversations."
                href="/messages"
                hrefLabel="Open Messages"
              >
                {recentMessages.length === 0 ? (
                  <EmptyText text="No recent messages." />
                ) : (
                  <div className="space-y-3">
                    {recentMessages.map((message) => (
                      <div
                        key={message.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                      >
                        <p className="font-black text-white">
                          {getJobTitle(message.job_id)}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm text-slate-300">
                          {message.body || 'Message'}
                        </p>
                        <p className="mt-2 text-xs font-bold text-slate-500">
                          {formatDate(message.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </DashboardPanel>

              <DashboardPanel
                title="Recent Notifications"
                description="Latest alerts from CrewCall."
                href="/notifications"
                hrefLabel="Open Alerts"
              >
                {notifications.length === 0 ? (
                  <EmptyText text="No notifications yet." />
                ) : (
                  <div className="space-y-3">
                    {notifications.slice(0, 5).map((notification) => (
                      <Link
                        key={notification.id}
                        href={notification.link_url || '/notifications'}
                        className="block rounded-2xl border border-white/10 bg-slate-950/60 p-4 hover:border-cyan-400/30"
                      >
                        <p className="font-black text-white">
                          {notification.title || 'Notification'}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                          {notification.body || 'CrewCall update'}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </DashboardPanel>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <DashboardPanel
                title="Jobs Needing Attention"
                description="Open jobs with no applicants yet."
                href="/company/jobs"
                hrefLabel="Manage Jobs"
              >
                {jobsNeedingAttention.length === 0 ? (
                  <EmptyText text="All open jobs have activity." />
                ) : (
                  <div className="space-y-3">
                    {jobsNeedingAttention.slice(0, 6).map((job) => (
                      <div
                        key={job.id}
                        className="flex flex-col gap-3 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-black text-white">
                            {job.title || 'Untitled job'}
                          </p>
                          <p className="mt-1 text-sm text-orange-100/80">
                            No applicants yet • {job.location || 'No location'}
                          </p>
                        </div>

                        <Link
                          href={`/jobs/${job.id}/boost`}
                          className="rounded-xl bg-orange-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-orange-300"
                        >
                          Boost
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </DashboardPanel>

              <DashboardPanel
                title="Hiring Snapshot"
                description="Quick performance view for your company."
                href="/company/analytics"
                hrefLabel="Full Analytics"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniMetric label="Views" value={stats.views} />
                  <MiniMetric label="Applications" value={stats.applications} />
                  <MiniMetric label="Assigned" value={stats.assignedJobs} />
                  <MiniMetric label="Completed" value={stats.completedJobs} />
                </div>
              </DashboardPanel>
            </section>
          </>
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
  value: string | number
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
    </div>
  )
}

function DashboardPanel({
  title,
  description,
  href,
  hrefLabel,
  children,
}: {
  title: string
  description: string
  href: string
  hrefLabel: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-400">
            {description}
          </p>
        </div>

        <Link
          href={href}
          className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-200 hover:bg-cyan-400/20"
        >
          {hrefLabel}
        </Link>
      </div>

      {children}
    </section>
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
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
    </div>
  )
}

function EmptyText({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-sm font-bold text-slate-400">
      {text}
    </div>
  )
}