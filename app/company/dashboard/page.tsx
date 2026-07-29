'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import SubscriptionGate from '@/app/components/SubscriptionGate'

import GlassCard from '@/app/components/ui/GlassCard'
import PageHeader from '@/app/components/ui/PageHeader'
import PrimaryButton from '@/app/components/ui/PrimaryButton'
import SecondaryButton from '@/app/components/ui/SecondaryButton'
import SectionHeader from '@/app/components/ui/SectionHeader'
import StatCard from '@/app/components/ui/StatCard'
import StatusBadge from '@/app/components/ui/StatusBadge'

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  status: string | null
  pay_rate: number | null
  created_at: string | null
  start_date?: string | null
  company_id: string
  assigned_worker_id: string | null
  is_featured?: boolean | null
  urgent?: boolean | null
  payment_status?: string | null
  payout_status?: string | null
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

type WorkerProfile = {
  id: string
  full_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  available_for_work: boolean | null
  currently_working: boolean | null
  is_online: boolean | null
  last_seen: string | null
  booked_until: string | null
  latitude: number | null
  longitude: number | null
}

type CompanyProfile = {
  company_name: string | null
  full_name: string | null
  city: string | null
  state: string | null
}

type DashboardStats = {
  openJobs: number
  completedJobs: number
  assignedJobs: number
  applications: number
  messages: number
  views: number
  unreadNotifications: number
  avgRating: number
  featuredJobs: number
  urgentJobs: number
  unpaidJobs: number
}

export default function CompanyDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState('')

  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [jobViews, setJobViews] = useState<JobView[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [workers, setWorkers] = useState<WorkerProfile[]>([])
  const [companyProfile, setCompanyProfile] =
    useState<CompanyProfile | null>(null)

  useEffect(() => {
    void loadDashboard()

    const refreshInterval = window.setInterval(() => {
      void loadDashboard(true)
    }, 60_000)

    return () => {
      window.clearInterval(refreshInterval)
    }
  }, [])

  async function loadDashboard(silent = false) {
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setError('Please log in to view your company dashboard.')
        return
      }

      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('company_id', user.id)
        .order('created_at', { ascending: false })

      if (jobsError) {
        throw jobsError
      }

      const loadedJobs = (jobsData || []) as Job[]
      const jobIds = loadedJobs.map((job) => job.id)

      setJobs(loadedJobs)

      const [
        notificationsRes,
        reviewsRes,
        workersRes,
        companyProfileRes,
      ] = await Promise.all([
        supabase
          .from('notifications')
          .select('id, title, body, link_url, is_read, read, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(12),

        supabase
          .from('reviews')
          .select('id, rating, created_at')
          .eq('reviewee_id', user.id),

        supabase
          .from('profiles')
          .select(
            'id, full_name, trade, city, state, available_for_work, currently_working, is_online, last_seen, booked_until, latitude, longitude',
          )
          .eq('role', 'worker')
          .order('is_online', { ascending: false })
          .limit(12),

        supabase
          .from('profiles')
          .select('company_name, full_name, city, state')
          .eq('id', user.id)
          .maybeSingle(),
      ])

      if (notificationsRes.error) {
        throw notificationsRes.error
      }

      if (reviewsRes.error) {
        throw reviewsRes.error
      }

      if (workersRes.error) {
        console.warn('Could not load workers:', workersRes.error)
      }

      if (companyProfileRes.error) {
        console.warn(
          'Could not load company profile:',
          companyProfileRes.error,
        )
      }

      setNotifications((notificationsRes.data || []) as Notification[])
      setReviews((reviewsRes.data || []) as Review[])
      setWorkers((workersRes.data || []) as WorkerProfile[])
      setCompanyProfile(
        (companyProfileRes.data as CompanyProfile | null) || null,
      )

      if (jobIds.length === 0) {
        setApplications([])
        setMessages([])
        setJobViews([])
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

      if (applicationsRes.error) {
        throw applicationsRes.error
      }

      if (messagesRes.error) {
        throw messagesRes.error
      }

      if (viewsRes.error) {
        throw viewsRes.error
      }

      setApplications((applicationsRes.data || []) as Application[])
      setMessages((messagesRes.data || []) as Message[])
      setJobViews((viewsRes.data || []) as JobView[])
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Company dashboard error:', err)
      setError('Could not load the company dashboard.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const stats = useMemo<DashboardStats>(() => {
    const openJobs = jobs.filter((job) => job.status === 'open').length

    const completedJobs = jobs.filter(
      (job) => job.status === 'completed',
    ).length

    const assignedJobs = jobs.filter((job) =>
      Boolean(job.assigned_worker_id),
    ).length

    const unreadNotifications = notifications.filter(
      (notification) =>
        notification.is_read === false || notification.read === false,
    ).length

    const avgRating =
      reviews.length > 0
        ? Number(
            (
              reviews.reduce(
                (total, review) => total + Number(review.rating || 0),
                0,
              ) / reviews.length
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
        (job) =>
          Boolean(job.assigned_worker_id) &&
          job.payment_status !== 'paid',
      ).length,
    }
  }, [
    applications,
    jobViews,
    jobs,
    messages,
    notifications,
    reviews,
  ])

  const recentApplications = applications.slice(0, 5)
  const recentMessages = messages.slice(0, 5)

  const pendingApplications = useMemo(
    () =>
      applications.filter((application) => {
        const status = application.status?.toLowerCase() || 'pending'

        return status === 'pending'
      }).length,
    [applications],
  )

  const jobsNeedingAttention = useMemo(() => {
    return jobs.filter((job) => {
      if (job.status !== 'open') {
        return false
      }

      return !applications.some(
        (application) => application.job_id === job.id,
      )
    })
  }, [applications, jobs])

  const activeJobs = useMemo(() => {
    return jobs.filter(
      (job) =>
        job.status === 'open' ||
        job.status === 'assigned' ||
        job.status === 'in_progress',
    )
  }, [jobs])

  const todaysJobs = useMemo(() => {
    const today = new Date()

    return jobs
      .filter((job) => {
        if (!job.start_date) return false
        const start = new Date(job.start_date)

        return (
          !Number.isNaN(start.getTime()) &&
          start.getFullYear() === today.getFullYear() &&
          start.getMonth() === today.getMonth() &&
          start.getDate() === today.getDate()
        )
      })
      .sort((a, b) => {
        const aTime = a.start_date ? new Date(a.start_date).getTime() : 0
        const bTime = b.start_date ? new Date(b.start_date).getTime() : 0
        return aTime - bTime
      })
  }, [jobs])

  const onlineWorkers = useMemo(
    () =>
      workers
        .filter(
          (worker) =>
            worker.is_online ||
            worker.available_for_work ||
            worker.currently_working,
        )
        .slice(0, 6),
    [workers],
  )

  const workerMap = useMemo(
    () => new Map(workers.map((worker) => [worker.id, worker])),
    [workers],
  )

  const criticalAlerts = useMemo(() => {
    const alerts: Array<{
      id: string
      title: string
      description: string
      href: string
      tone: 'red' | 'amber' | 'blue'
    }> = []

    jobsNeedingAttention.slice(0, 3).forEach((job) => {
      alerts.push({
        id: `no-applicants-${job.id}`,
        title: 'No applicants yet',
        description: `${job.title || 'Untitled job'} is still open without worker interest.`,
        href: `/my-jobs/${job.id}`,
        tone: 'amber',
      })
    })

    jobs
      .filter(
        (job) =>
          job.status === 'completed' &&
          Boolean(job.assigned_worker_id) &&
          job.payment_status !== 'paid',
      )
      .slice(0, 3)
      .forEach((job) => {
        alerts.push({
          id: `payment-${job.id}`,
          title: 'Payment still needed',
          description: `${job.title || 'Untitled job'} is complete but has not been marked paid.`,
          href: `/jobs/${job.id}/pay`,
          tone: 'red',
        })
      })

    jobs
      .filter((job) => {
        if (!job.start_date || job.assigned_worker_id) return false
        const start = new Date(job.start_date)
        const hours = (start.getTime() - Date.now()) / 36e5
        return hours >= 0 && hours <= 24
      })
      .slice(0, 3)
      .forEach((job) => {
        alerts.push({
          id: `unassigned-${job.id}`,
          title: 'Job starts within 24 hours',
          description: `${job.title || 'Untitled job'} has no assigned worker.`,
          href: `/my-jobs/${job.id}`,
          tone: 'red',
        })
      })

    if (stats.unreadNotifications > 0) {
      alerts.push({
        id: 'unread-alerts',
        title: 'Unread account alerts',
        description: `${stats.unreadNotifications} CrewCall alert${
          stats.unreadNotifications === 1 ? '' : 's'
        } need review.`,
        href: '/notifications',
        tone: 'blue',
      })
    }

    return alerts.slice(0, 6)
  }, [jobs, jobsNeedingAttention, stats.unreadNotifications])

  const recommendedActions = useMemo(() => {
    const actions: Array<{
      id: string
      title: string
      description: string
      href: string
      label: string
      tone: 'blue' | 'amber' | 'red' | 'green'
    }> = []

    if (pendingApplications > 0) {
      actions.push({
        id: 'review-applications',
        title: `Review ${pendingApplications} pending application${
          pendingApplications === 1 ? '' : 's'
        }`,
        description:
          'Workers are waiting for a response on your active job postings.',
        href: '/company/applications',
        label: 'Review Applications',
        tone: 'blue',
      })
    }

    if (stats.unpaidJobs > 0) {
      actions.push({
        id: 'complete-payments',
        title: `Complete ${stats.unpaidJobs} outstanding payment${
          stats.unpaidJobs === 1 ? '' : 's'
        }`,
        description:
          'Keep workers paid promptly and protect your company rating.',
        href: '/company/jobs',
        label: 'Review Payments',
        tone: 'red',
      })
    }

    if (jobsNeedingAttention.length > 0) {
      actions.push({
        id: 'boost-jobs',
        title: `Improve ${jobsNeedingAttention.length} job posting${
          jobsNeedingAttention.length === 1 ? '' : 's'
        }`,
        description:
          'These open jobs have not received an application yet.',
        href: '/company/jobs',
        label: 'Manage Jobs',
        tone: 'amber',
      })
    }

    if (stats.unreadNotifications > 0) {
      actions.push({
        id: 'read-notifications',
        title: `Read ${stats.unreadNotifications} new notification${
          stats.unreadNotifications === 1 ? '' : 's'
        }`,
        description:
          'Review recent job, payment, application, and account activity.',
        href: '/notifications',
        label: 'Open Notifications',
        tone: 'blue',
      })
    }

    if (stats.openJobs === 0) {
      actions.push({
        id: 'post-job',
        title: 'Post your next job',
        description:
          'Create a new opportunity and start connecting with available workers.',
        href: '/post-job',
        label: 'Post a Job',
        tone: 'green',
      })
    }

    if (actions.length === 0) {
      actions.push({
        id: 'all-clear',
        title: 'Your company is caught up',
        description:
          'There are no urgent applications, payments, alerts, or inactive postings.',
        href: '/workers',
        label: 'Browse Workers',
        tone: 'green',
      })
    }

    return actions.slice(0, 4)
  }, [
    jobsNeedingAttention.length,
    pendingApplications,
    stats.openJobs,
    stats.unpaidJobs,
    stats.unreadNotifications,
  ])

  const activityFeed = useMemo(() => {
    const items = [
      ...notifications.map((notification) => ({
        id: `notification-${notification.id}`,
        title: notification.title || 'CrewCall update',
        description:
          notification.body || 'New activity on your CrewCall account.',
        created_at: notification.created_at,
        href: notification.link_url || '/notifications',
        tone:
          notification.is_read === false || notification.read === false
            ? 'blue'
            : 'slate',
      })),
      ...applications.slice(0, 8).map((application) => ({
        id: `application-${application.id}`,
        title: 'New job application',
        description: `${getJobTitle(application.job_id)} received an application.`,
        created_at: application.created_at,
        href: `/my-jobs/${application.job_id}/applicants`,
        tone: 'amber',
      })),
      ...messages.slice(0, 8).map((message) => ({
        id: `message-${message.id}`,
        title: 'New job message',
        description: `${getJobTitle(message.job_id)} has recent conversation activity.`,
        created_at: message.created_at,
        href: '/messages',
        tone: 'purple',
      })),
    ]

    return items
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
        return bTime - aTime
      })
      .slice(0, 10)
  }, [applications, jobs, messages, notifications])

  const revenueSnapshot = useMemo(() => {
    const completed = jobs.filter((job) => job.status === 'completed')

    return {
      completed: completed.length,
      paid: completed.filter((job) => job.payment_status === 'paid').length,
      outstanding: completed.filter(
        (job) => job.payment_status !== 'paid',
      ).length,
      payoutsReleased: completed.filter(
        (job) => job.payout_status === 'released',
      ).length,
    }
  }, [jobs])

  const companyHealth = useMemo(() => {
    const filled = jobs.filter((job) => Boolean(job.assigned_worker_id)).length
    const fillRate =
      jobs.length > 0 ? Math.round((filled / jobs.length) * 100) : 0
    const paymentRate =
      stats.completedJobs > 0
        ? Math.round(
            (jobs.filter(
              (job) =>
                job.status === 'completed' &&
                job.payment_status === 'paid',
            ).length /
              stats.completedJobs) *
              100,
          )
        : 100

    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          fillRate * 0.4 +
            paymentRate * 0.35 +
            Math.min(stats.avgRating / 5, 1) * 25,
        ),
      ),
    )

    return { score, fillRate, paymentRate }
  }, [jobs, stats.avgRating, stats.completedJobs])

  const greeting = getGreeting()

  const companyDisplayName =
    companyProfile?.company_name?.trim() ||
    companyProfile?.full_name?.trim() ||
    'Your Company'

  const companyLocation = [
    companyProfile?.city,
    companyProfile?.state,
  ]
    .filter(Boolean)
    .join(', ')

  const lastUpdatedLabel = lastUpdated
    ? `Updated ${formatRelativeTime(lastUpdated.toISOString())}`
    : 'Loading latest activity'

  function getJobTitle(jobId: string | null) {
    if (!jobId) {
      return 'Unknown job'
    }

    return (
      jobs.find((job) => job.id === jobId)?.title ||
      'Untitled job'
    )
  }

  function formatDate(value: string | null) {
    if (!value) {
      return 'Unknown date'
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return 'Unknown date'
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <GlassCard padding="xl" accent>
            <div className="animate-pulse space-y-4">
              <div className="h-3 w-36 rounded-full bg-white/10" />
              <div className="h-12 w-full max-w-xl rounded-2xl bg-white/10" />
              <div className="h-5 w-full max-w-2xl rounded-xl bg-white/10" />
            </div>
          </GlassCard>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <GlassCard key={index} padding="lg">
                <div className="animate-pulse space-y-4">
                  <div className="h-3 w-24 rounded-full bg-white/10" />
                  <div className="h-9 w-20 rounded-xl bg-white/10" />
                  <div className="h-3 w-32 rounded-full bg-white/10" />
                </div>
              </GlassCard>
            ))}
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[34rem] w-[60rem] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-80 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl space-y-8">
        <PageHeader
          eyebrow="CrewCall Company Command Center"
          greeting={greeting}
          title={`${companyDisplayName} Dashboard`}
          description={
            companyLocation
              ? `${companyLocation} • ${lastUpdatedLabel}`
              : lastUpdatedLabel
          }
          actions={
            <div className="flex flex-wrap gap-3">
              <PrimaryButton href="/post-job">
                Post a Job
              </PrimaryButton>

              <SecondaryButton href="/workers">
                Find Workers
              </SecondaryButton>

              <SecondaryButton href="/company/invites">
                Invite Workers
              </SecondaryButton>

              <SecondaryButton href="/company/analytics">
                Analytics
              </SecondaryButton>

              <button
                type="button"
                onClick={() => void loadDashboard(true)}
                disabled={refreshing}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:border-blue-400/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  aria-hidden="true"
                  className={`mr-2 inline-block ${
                    refreshing ? 'animate-spin' : ''
                  }`}
                >
                  ↻
                </span>

                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          }
        />

        {error && (
          <GlassCard
            padding="lg"
            className="border-red-400/30 bg-red-500/10"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-red-100">
                  Dashboard unavailable
                </p>

                <p className="mt-1 text-sm font-semibold text-red-200/80">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadDashboard()}
                className="rounded-xl border border-red-300/20 bg-red-300/10 px-4 py-2 text-sm font-black text-red-100 transition hover:bg-red-300/20"
              >
                Try Again
              </button>
            </div>
          </GlassCard>
        )}

        {!error && jobs.length === 0 && (
          <GlassCard padding="xl" accent>
            <div className="mx-auto max-w-2xl py-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-400/10 text-3xl">
                +
              </div>

              <p className="mt-6 text-xs font-black uppercase tracking-[0.25em] text-blue-300">
                Build Your Crew
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
                Start by posting your first job
              </h2>

              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-300">
                Once your first job is live, this dashboard will show
                applicants, messages, job views, notifications, payments,
                worker assignments, and hiring activity.
              </p>

              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <PrimaryButton href="/post-job">
                  Post Your First Job
                </PrimaryButton>

                <SecondaryButton href="/workers">
                  Browse Workers
                </SecondaryButton>
              </div>
            </div>
          </GlassCard>
        )}

        {!error && jobs.length > 0 && (
          <>
            <section>
              <SectionHeader
                eyebrow="Live Overview"
                title="Your company at a glance"
                description="The most important activity across your CrewCall account."
              />

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="Open Jobs"
                  value={stats.openJobs}
                  description="Currently accepting workers"
                  tone="blue"
                  icon={<span aria-hidden="true">▣</span>}
                />

                <StatCard
                  title="Applicants"
                  value={stats.applications}
                  description="Total job applications"
                  tone="blue"
                  icon={<span aria-hidden="true">◎</span>}
                />

                <StatCard
                  title="Assigned Jobs"
                  value={stats.assignedJobs}
                  description="Jobs with a selected worker"
                  tone="purple"
                  icon={<span aria-hidden="true">✓</span>}
                />

                <StatCard
                  title="Completed Jobs"
                  value={stats.completedJobs}
                  description="Successfully completed"
                  tone="green"
                  icon={<span aria-hidden="true">★</span>}
                />

                <StatCard
                  title="Job Views"
                  value={stats.views}
                  description="Worker interest across jobs"
                  tone="blue"
                  icon={<span aria-hidden="true">◉</span>}
                />

                <StatCard
                  title="Messages"
                  value={stats.messages}
                  description="Recent job conversation activity"
                  tone="blue"
                  icon={<span aria-hidden="true">✉</span>}
                />

                <StatCard
                  title="Needs Payment"
                  value={stats.unpaidJobs}
                  description="Assigned jobs not marked paid"
                  tone={stats.unpaidJobs > 0 ? 'amber' : 'green'}
                  icon={<span aria-hidden="true">$</span>}
                />

                <StatCard
                  title="Company Rating"
                  value={
                    reviews.length > 0
                      ? `${stats.avgRating} ★`
                      : 'New'
                  }
                  description={`${reviews.length} company review${
                    reviews.length === 1 ? '' : 's'
                  }`}
                  tone="amber"
                  icon={<span aria-hidden="true">★</span>}
                />
              </div>
            </section>

            <section>
              <SectionHeader
                eyebrow="Recommended Next Steps"
                title="Action center"
                description="The most important things your company can do right now."
              />

              <div
                className={`mt-5 grid gap-4 ${
                  recommendedActions.length === 1
                    ? 'grid-cols-1'
                    : recommendedActions.length === 2
                      ? 'md:grid-cols-2'
                      : recommendedActions.length === 3
                        ? 'md:grid-cols-2 xl:grid-cols-3'
                        : 'md:grid-cols-2 xl:grid-cols-4'
                }`}
              >
                {recommendedActions.map((action) => (
                  <ActionCenterCard
                    key={action.id}
                    title={action.title}
                    description={action.description}
                    href={action.href}
                    label={action.label}
                    tone={action.tone}
                    wide={recommendedActions.length === 1}
                  />
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
              <GlassCard padding="lg" accent className="xl:col-span-2">
                <SectionHeader
                  eyebrow="Dispatch"
                  title="Today's schedule"
                  description="Jobs scheduled for today, assigned workers, and the next action."
                  action={
                    <SecondaryButton href="/company/operations" size="sm">
                      Operations Center
                    </SecondaryButton>
                  }
                />

                <div className="mt-6">
                  {todaysJobs.length === 0 ? (
                    <EmptyState
                      title="No jobs scheduled for today"
                      description="Jobs with today's start date will appear here automatically."
                    />
                  ) : (
                    <div className="space-y-3">
                      {todaysJobs.slice(0, 6).map((job) => {
                        const worker = job.assigned_worker_id
                          ? workerMap.get(job.assigned_worker_id)
                          : null

                        return (
                          <div
                            key={job.id}
                            className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4 lg:flex-row lg:items-center lg:justify-between"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge tone="cyan" dot>
                                  {formatTime(job.start_date)}
                                </StatusBadge>

                                <p className="truncate font-black text-white">
                                  {job.title || 'Untitled job'}
                                </p>

                                <JobStatusBadge status={job.status} />
                              </div>

                              <p className="mt-2 text-sm font-semibold text-slate-400">
                                {job.location || 'Location not listed'}
                              </p>

                              {worker && (
                                <div className="mt-3 inline-flex rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2">
                                  <div>
                                    <div className="text-[10px] font-black uppercase tracking-wide text-emerald-200">
                                      Assigned Worker
                                    </div>
                                    <div className="text-sm font-black text-white">
                                      {worker.full_name || 'Worker'}
                                    </div>
                                    {worker.trade && (
                                      <div className="text-xs font-bold text-emerald-100">
                                        {worker.trade}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex shrink-0 flex-wrap gap-2">
                              {job.location ? (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                    job.location,
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
                                >
                                  Navigate
                                </a>
                              ) : null}

                              <Link
                                href="/messages"
                                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
                              >
                                Message
                              </Link>

                              <Link
                                href={`/my-jobs/${job.id}`}
                                className="rounded-xl bg-blue-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-blue-300"
                              >
                                Open Job
                              </Link>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </GlassCard>

              <GlassCard padding="lg">
                <SectionHeader
                  eyebrow="Company Health"
                  title={`${companyHealth.score}/100`}
                  description="Calculated from fill rate, payments, and reviews."
                />

                <div className="mt-6 space-y-3">
                  <HealthMetric
                    label="Job fill rate"
                    value={`${companyHealth.fillRate}%`}
                  />
                  <HealthMetric
                    label="Payment completion"
                    value={`${companyHealth.paymentRate}%`}
                  />
                  <HealthMetric
                    label="Company rating"
                    value={
                      reviews.length > 0
                        ? `${stats.avgRating} ★`
                        : 'New'
                    }
                  />
                </div>

                <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-blue-400 transition-all"
                    style={{ width: `${companyHealth.score}%` }}
                  />
                </div>
              </GlassCard>
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
              <GlassCard padding="lg">
                <SectionHeader
                  eyebrow="Crew Availability"
                  title="Workers online now"
                  description="Workers who are online, available, or currently working."
                  action={
                    <SecondaryButton href="/workers" size="sm">
                      View Workers
                    </SecondaryButton>
                  }
                />

                <div className="mt-6">
                  {onlineWorkers.length === 0 ? (
                    <EmptyState
                      title="No workers online"
                      description="Available and online workers will appear here."
                    />
                  ) : (
                    <div className="space-y-3">
                      {onlineWorkers.map((worker) => (
                        <Link
                          key={worker.id}
                          href={`/profile/${worker.id}`}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4 transition hover:border-blue-400/30 hover:bg-slate-900/80"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${
                                  worker.is_online
                                    ? 'bg-emerald-400'
                                    : 'bg-amber-400'
                                }`}
                              />

                              <p className="truncate font-black text-white">
                                {worker.full_name || 'CrewCall worker'}
                              </p>
                            </div>

                            <p className="mt-2 truncate text-sm font-semibold text-slate-400">
                              {worker.trade || 'Trade not listed'} •{' '}
                              {[worker.city, worker.state]
                                .filter(Boolean)
                                .join(', ') || 'Location not listed'}
                            </p>
                          </div>

                          <span className="text-sm font-black text-blue-300">
                            View →
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>

              <GlassCard padding="lg">
                <SectionHeader
                  eyebrow="Financial Snapshot"
                  title="Payments and completion"
                  description="A quick operational view using current job records."
                />

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <RevenueMetric
                    label="Completed jobs"
                    value={revenueSnapshot.completed}
                  />
                  <RevenueMetric
                    label="Marked paid"
                    value={revenueSnapshot.paid}
                  />
                  <RevenueMetric
                    label="Outstanding"
                    value={revenueSnapshot.outstanding}
                    tone={revenueSnapshot.outstanding > 0 ? 'amber' : 'default'}
                  />
                  <RevenueMetric
                    label="Payouts released"
                    value={revenueSnapshot.payoutsReleased}
                  />
                </div>
              </GlassCard>

              <GlassCard padding="lg">
                <SectionHeader
                  eyebrow="Critical Alerts"
                  title="Needs attention"
                  description="Items most likely to slow down jobs or payments."
                  action={
                    <SecondaryButton href="/notifications" size="sm">
                      View Alerts
                    </SecondaryButton>
                  }
                />

                <div className="mt-6">
                  {criticalAlerts.length === 0 ? (
                    <EmptyState
                      title="No critical alerts"
                      description="Your active jobs and account activity look healthy."
                    />
                  ) : (
                    <div className="space-y-3">
                      {criticalAlerts.map((alert) => (
                        <Link
                          key={alert.id}
                          href={alert.href}
                          className={`block rounded-2xl border p-4 transition hover:-translate-y-0.5 ${
                            alert.tone === 'red'
                              ? 'border-red-400/20 bg-red-400/[0.07]'
                              : alert.tone === 'amber'
                                ? 'border-amber-400/20 bg-amber-400/[0.07]'
                                : 'border-blue-400/20 bg-blue-400/[0.07]'
                          }`}
                        >
                          <p className="font-black text-white">
                            {alert.title}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            {alert.description}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>
            </section>

            <GlassCard padding="lg">
              <SectionHeader
                eyebrow="Live Activity"
                title="What is happening now"
                description="Recent applications, messages, and alerts in one feed."
                action={
                  <SecondaryButton href="/company/operations" size="sm">
                    Open Operations
                  </SecondaryButton>
                }
              />

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {activityFeed.length === 0 ? (
                  <div className="md:col-span-2">
                    <EmptyState
                      title="No recent activity"
                      description="Applications, messages, and notifications will appear here."
                    />
                  </div>
                ) : (
                  activityFeed.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="group rounded-2xl border border-white/10 bg-slate-950/55 p-4 transition hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-slate-900/80"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                            item.tone === 'blue'
                              ? 'bg-blue-400'
                              : item.tone === 'amber'
                                ? 'bg-amber-400'
                                : item.tone === 'purple'
                                  ? 'bg-purple-400'
                                  : 'bg-slate-500'
                          }`}
                        />

                        <div className="min-w-0">
                          <p className="font-black text-white">
                            {item.title}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {item.description}
                          </p>
                          <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                            {formatRelativeTime(item.created_at)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </GlassCard>

            <section>
              <SectionHeader
                eyebrow="Quick Actions"
                title="Keep work moving"
                description="Jump directly to the tools your company uses most."
              />

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <QuickActionCard
                  href="/post-job"
                  icon="+"
                  title="Post a Job"
                  description="Create a new opportunity and start finding skilled workers."
                />

                <QuickActionCard
                  href="/workers"
                  icon="⌖"
                  title="Find Workers"
                  description="Browse qualified workers by trade, location, and availability."
                />

                <QuickActionCard
                  href="/messages"
                  icon="✉"
                  title="Messages"
                  description="Continue conversations with applicants and assigned workers."
                />

                <QuickActionCard
                  href="/company/worker-map"
                  icon="◎"
                  title="Worker Map"
                  description="See available workers and their general work locations."
                />

                <QuickActionCard
                  href="/company/jobs"
                  icon="▣"
                  title="Manage Jobs"
                  description="Review open, assigned, active, and completed jobs."
                />

                <QuickActionCard
                  href="/company/applications"
                  icon="✓"
                  title="Applications"
                  description="Review workers who have applied to your job postings."
                />

                <QuickActionCard
                  href="/company/invites"
                  icon="➜"
                  title="Worker Invites"
                  description="Track pending, accepted, and declined worker invitations."
                />

                <QuickActionCard
                  href="/billing"
                  icon="$"
                  title="Billing"
                  description="Manage your CrewCall billing and subscription settings."
                />
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
              <GlassCard padding="lg" accent className="xl:col-span-2">
                <SectionHeader
                  eyebrow="Hiring Pipeline"
                  title="Recent applicants"
                  description="The newest workers interested in your open jobs."
                  action={
                    <SecondaryButton href="/company/applications" size="sm">
                      View All
                    </SecondaryButton>
                  }
                />

                <div className="mt-6">
                  {recentApplications.length === 0 ? (
                    <EmptyState
                      title="No applicants yet"
                      description="New worker applications will appear here after workers apply to your jobs."
                    />
                  ) : (
                    <div className="space-y-3">
                      {recentApplications.map((application) => (
                        <Link
                          key={application.id}
                          href={`/my-jobs/${application.job_id}/applicants`}
                          className="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4 transition hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-slate-900/80 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-black text-white">
                                {getJobTitle(application.job_id)}
                              </p>

                              <ApplicationStatusBadge
                                status={application.status}
                              />
                            </div>

                            <p className="mt-2 text-sm font-semibold text-slate-400">
                              Application received{' '}
                              {formatDate(application.created_at)}
                            </p>
                          </div>

                          <span className="shrink-0 text-sm font-black text-blue-300 transition group-hover:translate-x-1">
                            Review Applicant →
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>

              <GlassCard padding="lg">
                <SectionHeader
                  eyebrow="Activity"
                  title="Account status"
                  description="Important company totals and alerts."
                />

                <div className="mt-6 space-y-3">
                  <ActivityMetric
                    label="Active jobs"
                    value={activeJobs.length}
                  />

                  <ActivityMetric
                    label="Urgent jobs"
                    value={stats.urgentJobs}
                    tone={stats.urgentJobs > 0 ? 'amber' : 'default'}
                  />

                  <ActivityMetric
                    label="Featured jobs"
                    value={stats.featuredJobs}
                  />

                  <ActivityMetric
                    label="Unread alerts"
                    value={stats.unreadNotifications}
                    tone={
                      stats.unreadNotifications > 0
                        ? 'blue'
                        : 'default'
                    }
                  />

                  <ActivityMetric
                    label="Company reviews"
                    value={reviews.length}
                  />
                </div>

                <div className="mt-5">
                  <SecondaryButton href="/notifications">
                    Open Notifications
                  </SecondaryButton>
                </div>
              </GlassCard>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <GlassCard padding="lg">
                <SectionHeader
                  eyebrow="Communication"
                  title="Recent messages"
                  description="Newest activity from your job conversations."
                  action={
                    <SecondaryButton href="/messages" size="sm">
                      Open Messages
                    </SecondaryButton>
                  }
                />

                <div className="mt-6">
                  {recentMessages.length === 0 ? (
                    <EmptyState
                      title="No recent messages"
                      description="Messages from applicants and hired workers will appear here."
                    />
                  ) : (
                    <div className="space-y-3">
                      {recentMessages.map((message) => (
                        <Link
                          key={message.id}
                          href="/messages"
                          className="group block rounded-2xl border border-white/10 bg-slate-950/55 p-4 transition hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-slate-900/80"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="truncate font-black text-white">
                                {getJobTitle(message.job_id)}
                              </p>

                              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">
                                {message.body || 'New job message'}
                              </p>
                            </div>

                            <span className="shrink-0 text-blue-300 transition group-hover:translate-x-1">
                              →
                            </span>
                          </div>

                          <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                            {formatDate(message.created_at)}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>

              <GlassCard padding="lg">
                <SectionHeader
                  eyebrow="Notifications"
                  title="Recent alerts"
                  description="The latest updates requiring your attention."
                  action={
                    <SecondaryButton href="/notifications" size="sm">
                      View All
                    </SecondaryButton>
                  }
                />

                <div className="mt-6">
                  {notifications.length === 0 ? (
                    <EmptyState
                      title="No notifications"
                      description="Important CrewCall activity and account alerts will appear here."
                    />
                  ) : (
                    <div className="space-y-3">
                      {notifications.slice(0, 5).map((notification) => {
                        const isUnread =
                          notification.is_read === false ||
                          notification.read === false

                        return (
                          <Link
                            key={notification.id}
                            href={
                              notification.link_url ||
                              '/notifications'
                            }
                            className="group block rounded-2xl border border-white/10 bg-slate-950/55 p-4 transition hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-slate-900/80"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-black text-white">
                                    {notification.title ||
                                      'CrewCall notification'}
                                  </p>

                                  {isUnread && (
                                    <StatusBadge
                                      tone="blue"
                                      dot
                                      pulse
                                    >
                                      New
                                    </StatusBadge>
                                  )}
                                </div>

                                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                                  {notification.body ||
                                    'You have a new CrewCall update.'}
                                </p>
                              </div>

                              <span className="shrink-0 text-blue-300 transition group-hover:translate-x-1">
                                →
                              </span>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              </GlassCard>
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
              <GlassCard
                padding="lg"
                accent
                className="xl:col-span-2"
              >
                <SectionHeader
                  eyebrow="Needs Attention"
                  title="Jobs with no applicants"
                  description="These open jobs may need a boost or additional promotion."
                  action={
                    <SecondaryButton href="/company/jobs" size="sm">
                      Manage Jobs
                    </SecondaryButton>
                  }
                />

                <div className="mt-6">
                  {jobsNeedingAttention.length === 0 ? (
                    <EmptyState
                      title="Everything has activity"
                      description="Every open job currently has at least one applicant."
                    />
                  ) : (
                    <div className="space-y-3">
                      {jobsNeedingAttention
                        .slice(0, 6)
                        .map((job) => (
                          <div
                            key={job.id}
                            className="flex flex-col gap-4 rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-black text-white">
                                  {job.title || 'Untitled job'}
                                </p>

                                <StatusBadge tone="amber" dot>
                                  No Applicants
                                </StatusBadge>

                                {job.urgent && (
                                  <StatusBadge tone="red">
                                    Urgent
                                  </StatusBadge>
                                )}
                              </div>

                              <p className="mt-2 text-sm font-semibold text-amber-100/70">
                                {job.trade || 'Trade not listed'} •{' '}
                                {job.location || 'Location not listed'}
                              </p>
                            </div>

                            <div className="flex shrink-0 flex-wrap gap-2">
                              <Link
                                href={`/my-jobs/${job.id}`}
                                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
                              >
                                View
                              </Link>

                              <Link
                                href={`/jobs/${job.id}/boost`}
                                className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-300"
                              >
                                Boost Job
                              </Link>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </GlassCard>

              <GlassCard padding="lg">
                <SectionHeader
                  eyebrow="Performance"
                  title="Hiring snapshot"
                  description="A quick view of your hiring funnel."
                />

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <HiringMetric
                    label="Job views"
                    value={stats.views}
                    description="Workers viewing your postings"
                  />

                  <HiringMetric
                    label="Applications"
                    value={stats.applications}
                    description="Workers entering your pipeline"
                  />

                  <HiringMetric
                    label="Assigned"
                    value={stats.assignedJobs}
                    description="Jobs matched with workers"
                  />

                  <HiringMetric
                    label="Completed"
                    value={stats.completedJobs}
                    description="Finished CrewCall jobs"
                  />
                </div>

                <div className="mt-5">
                  <PrimaryButton href="/company/analytics">
                    View Full Analytics
                  </PrimaryButton>
                </div>
              </GlassCard>
            </section>

            <GlassCard padding="lg">
              <SectionHeader
                eyebrow="Job Management"
                title="Recent company jobs"
                description="Quick access to your newest job postings."
                action={
                  <SecondaryButton href="/company/jobs" size="sm">
                    View All Jobs
                  </SecondaryButton>
                }
              />

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {jobs.slice(0, 6).map((job) => {
                  const applicationCount = applications.filter(
                    (application) =>
                      application.job_id === job.id,
                  ).length

                  return (
                    <Link
                      key={job.id}
                      href={`/my-jobs/${job.id}`}
                      className="group rounded-2xl border border-white/10 bg-slate-950/55 p-5 transition hover:-translate-y-1 hover:border-blue-400/30 hover:bg-slate-900/80"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black text-white">
                            {job.title || 'Untitled job'}
                          </p>

                          <p className="mt-2 truncate text-sm font-semibold text-slate-400">
                            {job.trade || 'Trade not listed'} •{' '}
                            {job.location || 'Location not listed'}
                          </p>
                        </div>

                        <JobStatusBadge status={job.status} />
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                            Applicants
                          </p>

                          <p className="mt-2 text-2xl font-black text-white">
                            {applicationCount}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                            Pay Rate
                          </p>

                          <p className="mt-2 truncate text-2xl font-black text-white">
                            {job.pay_rate != null
                              ? `$${Number(job.pay_rate).toLocaleString()}`
                              : '—'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {job.urgent && (
                          <StatusBadge tone="red" dot>
                            Urgent
                          </StatusBadge>
                        )}

                        {job.is_featured && (
                          <StatusBadge tone="purple">
                            Featured
                          </StatusBadge>
                        )}

                        {job.assigned_worker_id && (
                          <StatusBadge tone="green">
                            Worker Assigned
                          </StatusBadge>
                        )}

                        {job.payment_status === 'paid' && (
                          <StatusBadge tone="green">
                            Paid
                          </StatusBadge>
                        )}
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                        <span className="text-xs font-bold text-slate-500">
                          Posted {formatDate(job.created_at)}
                        </span>

                        <span className="text-sm font-black text-blue-300 transition group-hover:translate-x-1">
                          Manage →
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </GlassCard>
          </>
        )}
      </div>
    </main>
  )
}

function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) {
    return 'Good morning'
  }

  if (hour < 17) {
    return 'Good afternoon'
  }

  return 'Good evening'
}

function ActionCenterCard({
  title,
  description,
  href,
  label,
  tone,
  wide = false,
}: {
  title: string
  description: string
  href: string
  label: string
  tone: 'blue' | 'amber' | 'red' | 'green'
  wide?: boolean
}) {
  const toneClasses = {
    blue: {
      card: 'border-blue-400/20 bg-blue-400/[0.07]',
      icon: 'border-blue-400/20 bg-blue-400/10 text-blue-200',
      button: 'bg-blue-400 text-slate-950 hover:bg-blue-300',
      symbol: '→',
    },
    amber: {
      card: 'border-amber-400/20 bg-amber-400/[0.07]',
      icon: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
      button: 'bg-amber-400 text-slate-950 hover:bg-amber-300',
      symbol: '!',
    },
    red: {
      card: 'border-red-400/20 bg-red-400/[0.07]',
      icon: 'border-red-400/20 bg-red-400/10 text-red-200',
      button: 'bg-red-400 text-white hover:bg-red-300',
      symbol: '$',
    },
    green: {
      card: 'border-emerald-400/20 bg-emerald-400/[0.07]',
      icon:
        'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
      button: 'bg-emerald-400 text-slate-950 hover:bg-emerald-300',
      symbol: '✓',
    },
  }

  const styles = toneClasses[tone]

  return (
    <Link
      href={href}
      className={`group flex h-full rounded-2xl border p-5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/20 ${styles.card} ${
        wide
          ? 'flex-col gap-5 md:flex-row md:items-center md:p-6'
          : 'flex-col'
      }`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-lg font-black ${styles.icon}`}
      >
        {styles.symbol}
      </div>

      <div className={wide ? 'min-w-0 flex-1' : ''}>
        <h3
          className={`font-black leading-7 text-white ${
            wide ? 'text-xl' : 'mt-5 text-lg'
          }`}
        >
          {title}
        </h3>

        <p
          className={`text-sm leading-6 text-slate-300 ${
            wide ? 'mt-1 max-w-2xl' : 'mt-2 flex-1'
          }`}
        >
          {description}
        </p>
      </div>

      <span
        className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl px-5 py-2 text-sm font-black transition ${styles.button} ${
          wide ? 'md:ml-auto' : 'mt-5'
        }`}
      >
        {label}
      </span>
    </Link>
  )
}

function QuickActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: string
  title: string
  description: string
}) {
  return (
    <Link href={href} className="group block">
      <GlassCard
        padding="lg"
        hover
        className="h-full"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-400/10 text-xl font-black text-blue-200 transition group-hover:scale-105 group-hover:bg-blue-400/20">
            {icon}
          </div>

          <h3 className="mt-5 text-lg font-black text-white">
            {title}
          </h3>

          <p className="mt-2 flex-1 text-sm leading-6 text-slate-400">
            {description}
          </p>

          <span className="mt-5 text-sm font-black text-blue-300 transition group-hover:translate-x-1">
            Open →
          </span>
        </div>
      </GlassCard>
    </Link>
  )
}

function ActivityMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: 'default' | 'blue' | 'amber'
}) {
  const toneClasses = {
    default:
      'border-white/10 bg-slate-950/55 text-white',
    blue:
      'border-blue-400/20 bg-blue-400/[0.07] text-blue-100',
    amber:
      'border-amber-400/20 bg-amber-400/[0.07] text-amber-100',
  }

  return (
    <div
      className={`flex items-center justify-between rounded-2xl border p-4 ${toneClasses[tone]}`}
    >
      <p className="text-sm font-bold text-slate-300">
        {label}
      </p>

      <p className="text-xl font-black">{value}</p>
    </div>
  )
}

function HiringMetric({
  label,
  value,
  description,
}: {
  label: string
  value: string | number
  description: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-sm font-semibold text-slate-400">
            {description}
          </p>
        </div>

        <p className="shrink-0 text-3xl font-black text-white">
          {value}
        </p>
      </div>
    </div>
  )
}

function HealthMetric({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <p className="text-sm font-bold text-slate-300">{label}</p>
      <p className="text-xl font-black text-white">{value}</p>
    </div>
  )
}

function RevenueMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: 'default' | 'amber'
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl border p-4 ${
        tone === 'amber'
          ? 'border-amber-400/20 bg-amber-400/[0.07]'
          : 'border-white/10 bg-slate-950/55'
      }`}
    >
      <p className="text-sm font-bold text-slate-300">{label}</p>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/45 p-6 text-center">
      <p className="font-black text-white">{title}</p>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
        {description}
      </p>
    </div>
  )
}

function ApplicationStatusBadge({
  status,
}: {
  status: string | null
}) {
  const normalizedStatus = status?.toLowerCase() || 'pending'

  if (
    normalizedStatus === 'hired' ||
    normalizedStatus === 'accepted'
  ) {
    return (
      <StatusBadge tone="green" dot>
        {formatStatus(normalizedStatus)}
      </StatusBadge>
    )
  }

  if (
    normalizedStatus === 'not_selected' ||
    normalizedStatus === 'declined' ||
    normalizedStatus === 'withdrawn'
  ) {
    return (
      <StatusBadge tone="red">
        {formatStatus(normalizedStatus)}
      </StatusBadge>
    )
  }

  return (
    <StatusBadge tone="amber" dot>
      {formatStatus(normalizedStatus)}
    </StatusBadge>
  )
}

function JobStatusBadge({
  status,
}: {
  status: string | null
}) {
  const normalizedStatus = status?.toLowerCase() || 'open'

  if (normalizedStatus === 'completed') {
    return (
      <StatusBadge tone="green" dot>
        Completed
      </StatusBadge>
    )
  }

  if (normalizedStatus === 'in_progress') {
    return (
      <StatusBadge tone="cyan" dot pulse>
        In Progress
      </StatusBadge>
    )
  }

  if (normalizedStatus === 'assigned') {
    return (
      <StatusBadge tone="purple" dot>
        Assigned
      </StatusBadge>
    )
  }

  if (
    normalizedStatus === 'closed' ||
    normalizedStatus === 'cancelled'
  ) {
    return (
      <StatusBadge tone="slate">
        {formatStatus(normalizedStatus)}
      </StatusBadge>
    )
  }

  return (
    <StatusBadge tone="blue" dot>
      Open
    </StatusBadge>
  )
}

function formatTime(value: string | null | undefined) {
  if (!value) return 'Time TBD'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Time TBD'

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatRelativeTime(value: string | null) {
  if (!value) return 'Recently'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'

  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  const ranges: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.34524, 'week'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ]

  let duration = seconds

  for (const [amount, unit] of ranges) {
    if (Math.abs(duration) < amount) {
      return formatter.format(Math.round(duration), unit)
    }

    duration /= amount
  }

  return 'Recently'
}

function formatStatus(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}