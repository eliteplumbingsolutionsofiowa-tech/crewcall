'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { resolveCompanyContext } from '@/lib/company-context'
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

function isActuallyOnline(worker: WorkerProfile) {
  if (!worker.is_online || !worker.last_seen) return false

  const lastSeen = new Date(worker.last_seen).getTime()

  if (Number.isNaN(lastSeen)) return false

  return Date.now() - lastSeen < 90_000
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
  const t = useTranslations('CompanyDashboard')
  const locale = useLocale()

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
        setError(t('loginRequired'))
        return
      }

      const companyContext =
        await resolveCompanyContext(
          supabase,
          user.id
        )

      if (!companyContext.companyId) {
        setError(
          t('notConnected')
        )
        return
      }

      const companyId =
        companyContext.companyId

      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('company_id', companyId)
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
          .eq('reviewee_id', companyId),

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
          .eq('id', companyId)
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
      setError(t('loadFailed'))
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
            isActuallyOnline(worker) ||
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
        title: t('noApplicantsYet'),
        description: t('noApplicantsDescription', { job: job.title || t('untitledJob') }),
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
          title: t('paymentNeeded'),
          description: t('paymentNeededDescription', { job: job.title || t('untitledJob') }),
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
          title: t('startsSoon'),
          description: t('startsSoonDescription', { job: job.title || t('untitledJob') }),
          href: `/my-jobs/${job.id}`,
          tone: 'red',
        })
      })

    if (stats.unreadNotifications > 0) {
      alerts.push({
        id: 'unread-alerts',
        title: t('unreadAlerts'),
        description: t('unreadAlertsDescription', { count: stats.unreadNotifications }),
        href: '/notifications',
        tone: 'blue',
      })
    }

    return alerts.slice(0, 6)
  }, [jobs, jobsNeedingAttention, stats.unreadNotifications, t])

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
        title: t('reviewPending', { count: pendingApplications }),
        description: t('reviewPendingDescription'),
        href: '/company/applications',
        label: t('reviewApplications'),
        tone: 'blue',
      })
    }

    if (stats.unpaidJobs > 0) {
      actions.push({
        id: 'complete-payments',
        title: t('completePayments', { count: stats.unpaidJobs }),
        description: t('completePaymentsDescription'),
        href: '/company/jobs',
        label: t('reviewPayments'),
        tone: 'red',
      })
    }

    if (jobsNeedingAttention.length > 0) {
      actions.push({
        id: 'boost-jobs',
        title: t('improveJobs', { count: jobsNeedingAttention.length }),
        description: t('improveJobsDescription'),
        href: '/company/jobs',
        label: t('manageJobs'),
        tone: 'amber',
      })
    }

    if (stats.unreadNotifications > 0) {
      actions.push({
        id: 'read-notifications',
        title: t('readNotifications', { count: stats.unreadNotifications }),
        description: t('readNotificationsDescription'),
        href: '/notifications',
        label: t('openNotifications'),
        tone: 'blue',
      })
    }

    if (stats.openJobs === 0) {
      actions.push({
        id: 'post-job',
        title: t('postNextJob'),
        description: t('postNextJobDescription'),
        href: '/post-job',
        label: t('postJob'),
        tone: 'green',
      })
    }

    if (actions.length === 0) {
      actions.push({
        id: 'all-clear',
        title: t('companyCaughtUp'),
        description: t('companyCaughtUpDescription'),
        href: '/workers',
        label: t('browseWorkers'),
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
    t,
  ])

  const activityFeed = useMemo(() => {
    const items = [
      ...notifications.map((notification) => ({
        id: `notification-${notification.id}`,
        title: notification.title || t('crewCallUpdate'),
        description:
          notification.body || t('newAccountActivity'),
        created_at: notification.created_at,
        href: notification.link_url || '/notifications',
        tone:
          notification.is_read === false || notification.read === false
            ? 'blue'
            : 'slate',
      })),
      ...applications.slice(0, 8).map((application) => ({
        id: `application-${application.id}`,
        title: t('newApplication'),
        description: t('applicationActivity', { job: getJobTitle(application.job_id) }),
        created_at: application.created_at,
        href: `/my-jobs/${application.job_id}/applicants`,
        tone: 'amber',
      })),
      ...messages.slice(0, 8).map((message) => ({
        id: `message-${message.id}`,
        title: t('newJobMessage'),
        description: t('messageActivity', { job: getJobTitle(message.job_id) }),
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
  }, [applications, jobs, messages, notifications, t])

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

  const greeting = getGreeting(t)

  const companyDisplayName =
    companyProfile?.company_name?.trim() ||
    companyProfile?.full_name?.trim() ||
    t('yourCompany')

  const companyLocation = [
    companyProfile?.city,
    companyProfile?.state,
  ]
    .filter(Boolean)
    .join(', ')

  const lastUpdatedLabel = lastUpdated
    ? t('updated', { time: formatRelativeTime(lastUpdated.toISOString(), locale, t) })
    : t('loadingActivity')

  function getJobTitle(jobId: string | null) {
    if (!jobId) {
      return t('unknownJob')
    }

    return (
      jobs.find((job) => job.id === jobId)?.title ||
      t('untitledJob')
    )
  }

  function formatDate(value: string | null) {
    if (!value) {
      return t('unknownDate')
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return t('unknownDate')
    }

    return date.toLocaleDateString(locale, {
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
          eyebrow={t('eyebrow')}
          greeting={greeting}
          title={t('dashboardTitle', { company: companyDisplayName })}
          description={
            companyLocation
              ? `${companyLocation} • ${lastUpdatedLabel}`
              : lastUpdatedLabel
          }
          actions={
            <div className="flex flex-wrap gap-3">
              <PrimaryButton href="/post-job">
                {t('postJob')}
              </PrimaryButton>

              <SecondaryButton href="/workers">
                {t('findWorkers')}
              </SecondaryButton>

              <SecondaryButton href="/company/invites">
                {t('inviteWorkers')}
              </SecondaryButton>

              <SecondaryButton href="/company/analytics">
                {t('analytics')}
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

                {refreshing ? t('refreshing') : t('refresh')}
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
                  {t('dashboardUnavailable')}
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
                {t('tryAgain')}
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
                {t('buildCrew')}
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
                {t('firstJobTitle')}
              </h2>

              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-300">
                {t('firstJobDescription')}
              </p>

              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <PrimaryButton href="/post-job">
                  {t('postFirstJob')}
                </PrimaryButton>

                <SecondaryButton href="/workers">
                  {t('browseWorkers')}
                </SecondaryButton>
              </div>
            </div>
          </GlassCard>
        )}

        {!error && jobs.length > 0 && (
          <>
            <section>
              <SectionHeader
                eyebrow={t('liveOverview')}
                title={t('atGlance')}
                description={t('overviewDescription')}
              />

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title={t('openJobs')}
                  value={stats.openJobs}
                  description={t('acceptingWorkers')}
                  tone="blue"
                  icon={<span aria-hidden="true">▣</span>}
                />

                <StatCard
                  title={t('applicants')}
                  value={stats.applications}
                  description={t('totalApplications')}
                  tone="blue"
                  icon={<span aria-hidden="true">◎</span>}
                />

                <StatCard
                  title={t('assignedJobs')}
                  value={stats.assignedJobs}
                  description={t('selectedWorker')}
                  tone="purple"
                  icon={<span aria-hidden="true">✓</span>}
                />

                <StatCard
                  title={t('completedJobs')}
                  value={stats.completedJobs}
                  description={t('successfullyCompleted')}
                  tone="green"
                  icon={<span aria-hidden="true">★</span>}
                />

                <StatCard
                  title={t('jobViews')}
                  value={stats.views}
                  description={t('workerInterest')}
                  tone="blue"
                  icon={<span aria-hidden="true">◉</span>}
                />

                <StatCard
                  title={t('messages')}
                  value={stats.messages}
                  description={t('conversationActivity')}
                  tone="blue"
                  icon={<span aria-hidden="true">✉</span>}
                />

                <StatCard
                  title={t('needsPayment')}
                  value={stats.unpaidJobs}
                  description={t('notMarkedPaid')}
                  tone={stats.unpaidJobs > 0 ? 'amber' : 'green'}
                  icon={<span aria-hidden="true">$</span>}
                />

                <StatCard
                  title={t('companyRating')}
                  value={
                    reviews.length > 0
                      ? `${stats.avgRating} ★`
                      : t('new')
                  }
                  description={t('companyReviewsCount', { count: reviews.length })}
                  tone="amber"
                  icon={<span aria-hidden="true">★</span>}
                />
              </div>
            </section>

            <section>
              <SectionHeader
                eyebrow={t('recommendedSteps')}
                title={t('actionCenter')}
                description={t('actionDescription')}
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
                  eyebrow={t('dispatch')}
                  title={t('todaysSchedule')}
                  description={t('scheduleDescription')}
                  action={
                    <SecondaryButton href="/company/operations" size="sm">
                      {t('operationsCenter')}
                    </SecondaryButton>
                  }
                />

                <div className="mt-6">
                  {todaysJobs.length === 0 ? (
                    <EmptyState
                      title={t('noJobsToday')}
                      description={t('noJobsTodayDescription')}
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
                                  {formatTime(job.start_date, locale, t)}
                                </StatusBadge>

                                <p className="truncate font-black text-white">
                                  {job.title || t('untitledJob')}
                                </p>

                                <JobStatusBadge status={job.status} />
                              </div>

                              <p className="mt-2 text-sm font-semibold text-slate-400">
                                {job.location || t('locationNotListed')}
                              </p>

                              {worker && (
                                <div className="mt-3 inline-flex rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2">
                                  <div>
                                    <div className="text-[10px] font-black uppercase tracking-wide text-emerald-200">
                                      {t('assignedWorker')}
                                    </div>
                                    <div className="text-sm font-black text-white">
                                      {worker.full_name || t('worker')}
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
                                  {t('navigate')}
                                </a>
                              ) : null}

                              <Link
                                href="/messages"
                                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
                              >
                                {t('message')}
                              </Link>

                              <Link
                                href={`/my-jobs/${job.id}`}
                                className="rounded-xl bg-blue-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-blue-300"
                              >
                                {t('openJob')}
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
                  eyebrow={t('companyHealth')}
                  title={`${companyHealth.score}/100`}
                  description={t('healthDescription')}
                />

                <div className="mt-6 space-y-3">
                  <HealthMetric
                    label={t('jobFillRate')}
                    value={`${companyHealth.fillRate}%`}
                  />
                  <HealthMetric
                    label={t('paymentCompletion')}
                    value={`${companyHealth.paymentRate}%`}
                  />
                  <HealthMetric
                    label={t('companyRating')}
                    value={
                      reviews.length > 0
                        ? `${stats.avgRating} ★`
                        : t('new')
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
                  eyebrow={t('crewAvailability')}
                  title={t('workersOnline')}
                  description={t('workersOnlineDescription')}
                  action={
                    <SecondaryButton href="/workers" size="sm">
                      {t('viewWorkers')}
                    </SecondaryButton>
                  }
                />

                <div className="mt-6">
                  {onlineWorkers.length === 0 ? (
                    <EmptyState
                      title={t('noWorkersOnline')}
                      description={t('noWorkersOnlineDescription')}
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
                                  isActuallyOnline(worker)
                                    ? 'bg-emerald-400'
                                    : 'bg-amber-400'
                                }`}
                              />

                              <p className="truncate font-black text-white">
                                {worker.full_name || t('crewCallWorker')}
                              </p>
                            </div>

                            <p className="mt-2 truncate text-sm font-semibold text-slate-400">
                              {worker.trade || t('tradeNotListed')} •{' '}
                              {[worker.city, worker.state]
                                .filter(Boolean)
                                .join(', ') || t('locationNotListed')}
                            </p>
                          </div>

                          <span className="text-sm font-black text-blue-300">
                            {t('view')}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>

              <GlassCard padding="lg">
                <SectionHeader
                  eyebrow={t('financialSnapshot')}
                  title={t('paymentsCompletion')}
                  description={t('financialDescription')}
                />

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <RevenueMetric
                    label={t('completedJobsMetric')}
                    value={revenueSnapshot.completed}
                  />
                  <RevenueMetric
                    label={t('markedPaid')}
                    value={revenueSnapshot.paid}
                  />
                  <RevenueMetric
                    label={t('outstanding')}
                    value={revenueSnapshot.outstanding}
                    tone={revenueSnapshot.outstanding > 0 ? 'amber' : 'default'}
                  />
                  <RevenueMetric
                    label={t('payoutsReleased')}
                    value={revenueSnapshot.payoutsReleased}
                  />
                </div>
              </GlassCard>

              <GlassCard padding="lg">
                <SectionHeader
                  eyebrow={t('criticalAlerts')}
                  title={t('needsAttention')}
                  description={t('criticalDescription')}
                  action={
                    <SecondaryButton href="/notifications" size="sm">
                      {t('viewAlerts')}
                    </SecondaryButton>
                  }
                />

                <div className="mt-6">
                  {criticalAlerts.length === 0 ? (
                    <EmptyState
                      title={t('noCriticalAlerts')}
                      description={t('healthyDescription')}
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
                eyebrow={t('liveActivity')}
                title={t('happeningNow')}
                description={t('activityDescription')}
                action={
                  <SecondaryButton href="/company/operations" size="sm">
                    {t('openOperations')}
                  </SecondaryButton>
                }
              />

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {activityFeed.length === 0 ? (
                  <div className="md:col-span-2">
                    <EmptyState
                      title={t('noRecentActivity')}
                      description={t('noRecentActivityDescription')}
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
                            {formatRelativeTime(item.created_at, locale, t)}
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
                eyebrow={t('quickActions')}
                title={t('keepMoving')}
                description={t('quickActionsDescription')}
              />

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <QuickActionCard
                  href="/post-job"
                  icon="+"
                  title={t('postJob')}
                  description={t('postJobDescription')}
                />

                <QuickActionCard
                  href="/workers"
                  icon="⌖"
                  title={t('findWorkers')}
                  description={t('findWorkersDescription')}
                />

                <QuickActionCard
                  href="/messages"
                  icon="✉"
                  title={t('messages')}
                  description={t('messagesDescription')}
                />

                <QuickActionCard
                  href="/company/worker-map"
                  icon="◎"
                  title={t('workerMap')}
                  description={t('workerMapDescription')}
                />

                <QuickActionCard
                  href="/company/jobs"
                  icon="▣"
                  title={t('manageJobs')}
                  description={t('manageJobsDescription')}
                />

                <QuickActionCard
                  href="/company/applications"
                  icon="✓"
                  title={t('applications')}
                  description={t('applicationsDescription')}
                />

                <QuickActionCard
                  href="/company/invites"
                  icon="➜"
                  title={t('workerInvites')}
                  description={t('workerInvitesDescription')}
                />

                <QuickActionCard
                  href="/billing"
                  icon="$"
                  title={t('billing')}
                  description={t('billingDescription')}
                />
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
              <GlassCard padding="lg" accent className="xl:col-span-2">
                <SectionHeader
                  eyebrow={t('hiringPipeline')}
                  title={t('recentApplicants')}
                  description={t('recentApplicantsDescription')}
                  action={
                    <SecondaryButton href="/company/applications" size="sm">
                      {t('viewAll')}
                    </SecondaryButton>
                  }
                />

                <div className="mt-6">
                  {recentApplications.length === 0 ? (
                    <EmptyState
                      title={t('noApplicants')}
                      description={t('noApplicantsLongDescription')}
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
                              {t('applicationReceived', { date: formatDate(application.created_at) })}
                            </p>
                          </div>

                          <span className="shrink-0 text-sm font-black text-blue-300 transition group-hover:translate-x-1">
                            {t('reviewApplicant')}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>

              <GlassCard padding="lg">
                <SectionHeader
                  eyebrow={t('activity')}
                  title={t('accountStatus')}
                  description={t('accountStatusDescription')}
                />

                <div className="mt-6 space-y-3">
                  <ActivityMetric
                    label={t('activeJobs')}
                    value={activeJobs.length}
                  />

                  <ActivityMetric
                    label={t('urgentJobs')}
                    value={stats.urgentJobs}
                    tone={stats.urgentJobs > 0 ? 'amber' : 'default'}
                  />

                  <ActivityMetric
                    label={t('featuredJobs')}
                    value={stats.featuredJobs}
                  />

                  <ActivityMetric
                    label={t('unreadAlertsMetric')}
                    value={stats.unreadNotifications}
                    tone={
                      stats.unreadNotifications > 0
                        ? 'blue'
                        : 'default'
                    }
                  />

                  <ActivityMetric
                    label={t('companyReviews')}
                    value={reviews.length}
                  />
                </div>

                <div className="mt-5">
                  <SecondaryButton href="/notifications">
                    {t('openNotifications')}
                  </SecondaryButton>
                </div>
              </GlassCard>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <GlassCard padding="lg">
                <SectionHeader
                  eyebrow={t('communication')}
                  title={t('recentMessages')}
                  description={t('recentMessagesDescription')}
                  action={
                    <SecondaryButton href="/messages" size="sm">
                      {t('openMessages')}
                    </SecondaryButton>
                  }
                />

                <div className="mt-6">
                  {recentMessages.length === 0 ? (
                    <EmptyState
                      title={t('noRecentMessages')}
                      description={t('noRecentMessagesDescription')}
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
                                {message.body || t('newJobMessage')}
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
                  eyebrow={t('notifications')}
                  title={t('recentAlerts')}
                  description={t('recentAlertsDescription')}
                  action={
                    <SecondaryButton href="/notifications" size="sm">
                      {t('viewAll')}
                    </SecondaryButton>
                  }
                />

                <div className="mt-6">
                  {notifications.length === 0 ? (
                    <EmptyState
                      title={t('noNotifications')}
                      description={t('noNotificationsDescription')}
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
                                      t('crewCallNotification')}
                                  </p>

                                  {isUnread && (
                                    <StatusBadge
                                      tone="blue"
                                      dot
                                      pulse
                                    >
                                      {t('new')}
                                    </StatusBadge>
                                  )}
                                </div>

                                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                                  {notification.body ||
                                    t('newUpdate')}
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
                  eyebrow={t('needsAttention')}
                  title={t('jobsNoApplicants')}
                  description={t('jobsNoApplicantsDescription')}
                  action={
                    <SecondaryButton href="/company/jobs" size="sm">
                      {t('manageJobs')}
                    </SecondaryButton>
                  }
                />

                <div className="mt-6">
                  {jobsNeedingAttention.length === 0 ? (
                    <EmptyState
                      title={t('everythingActive')}
                      description={t('everythingActiveDescription')}
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
                                  {job.title || t('untitledJob')}
                                </p>

                                <StatusBadge tone="amber" dot>
                                  {t('noApplicantsBadge')}
                                </StatusBadge>

                                {job.urgent && (
                                  <StatusBadge tone="red">
                                    {t('urgent')}
                                  </StatusBadge>
                                )}
                              </div>

                              <p className="mt-2 text-sm font-semibold text-amber-100/70">
                                {job.trade || 'Trade not listed'} •{' '}
                                {job.location || t('locationNotListed')}
                              </p>
                            </div>

                            <div className="flex shrink-0 flex-wrap gap-2">
                              <Link
                                href={`/my-jobs/${job.id}`}
                                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
                              >
                                {t('view').replace(' →', '')}
                              </Link>

                              <Link
                                href={`/jobs/${job.id}/boost`}
                                className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-300"
                              >
                                {t('boostJob')}
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
                  eyebrow={t('performance')}
                  title={t('hiringSnapshot')}
                  description={t('hiringSnapshotDescription')}
                />

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <HiringMetric
                    label={t('jobViews')}
                    value={stats.views}
                    description={t('workersViewing')}
                  />

                  <HiringMetric
                    label={t('applications')}
                    value={stats.applications}
                    description={t('workersPipeline')}
                  />

                  <HiringMetric
                    label={t('assigned')}
                    value={stats.assignedJobs}
                    description={t('jobsMatched')}
                  />

                  <HiringMetric
                    label={t('completed')}
                    value={stats.completedJobs}
                    description={t('finishedJobs')}
                  />
                </div>

                <div className="mt-5">
                  <PrimaryButton href="/company/analytics">
                    {t('viewFullAnalytics')}
                  </PrimaryButton>
                </div>
              </GlassCard>
            </section>

            <GlassCard padding="lg">
              <SectionHeader
                eyebrow={t('jobManagement')}
                title={t('recentCompanyJobs')}
                description={t('recentCompanyJobsDescription')}
                action={
                  <SecondaryButton href="/company/jobs" size="sm">
                    {t('viewAllJobs')}
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
                            {job.title || t('untitledJob')}
                          </p>

                          <p className="mt-2 truncate text-sm font-semibold text-slate-400">
                            {job.trade || 'Trade not listed'} •{' '}
                            {job.location || t('locationNotListed')}
                          </p>
                        </div>

                        <JobStatusBadge status={job.status} />
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                            {t('applicants')}
                          </p>

                          <p className="mt-2 text-2xl font-black text-white">
                            {applicationCount}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                            {t('payRate')}
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
                            {t('urgent')}
                          </StatusBadge>
                        )}

                        {job.is_featured && (
                          <StatusBadge tone="purple">
                            {t('featured')}
                          </StatusBadge>
                        )}

                        {job.assigned_worker_id && (
                          <StatusBadge tone="green">
                            {t('workerAssigned')}
                          </StatusBadge>
                        )}

                        {job.payment_status === 'paid' && (
                          <StatusBadge tone="green">
                            {t('paid')}
                          </StatusBadge>
                        )}
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                        <span className="text-xs font-bold text-slate-500">
                          {t('posted', { date: formatDate(job.created_at) })}
                        </span>

                        <span className="text-sm font-black text-blue-300 transition group-hover:translate-x-1">
                          {t('manage')}
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

function getGreeting(
  t: ReturnType<typeof useTranslations>
) {
  const hour = new Date().getHours()

  if (hour < 12) {
    return t('goodMorning')
  }

  if (hour < 17) {
    return t('goodAfternoon')
  }

  return t('goodEvening')
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
  const t = useTranslations('CompanyDashboard')

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
            {t('open')}
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
  const t = useTranslations('CompanyDashboard')
  const normalizedStatus = status?.toLowerCase() || 'pending'

  if (
    normalizedStatus === 'hired' ||
    normalizedStatus === 'accepted'
  ) {
    return (
      <StatusBadge tone="green" dot>
        {translatedStatus(normalizedStatus, t)}
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
        {translatedStatus(normalizedStatus, t)}
      </StatusBadge>
    )
  }

  return (
    <StatusBadge tone="amber" dot>
      {translatedStatus(normalizedStatus, t)}
    </StatusBadge>
  )
}

function JobStatusBadge({
  status,
}: {
  status: string | null
}) {
  const t = useTranslations('CompanyDashboard')
  const normalizedStatus = status?.toLowerCase() || 'open'

  if (normalizedStatus === 'completed') {
    return (
      <StatusBadge tone="green" dot>
        {t('statusCompleted')}
      </StatusBadge>
    )
  }

  if (normalizedStatus === 'in_progress') {
    return (
      <StatusBadge tone="cyan" dot pulse>
        {t('statusInProgress')}
      </StatusBadge>
    )
  }

  if (normalizedStatus === 'assigned') {
    return (
      <StatusBadge tone="purple" dot>
        {t('statusAssigned')}
      </StatusBadge>
    )
  }

  if (
    normalizedStatus === 'closed' ||
    normalizedStatus === 'cancelled'
  ) {
    return (
      <StatusBadge tone="slate">
        {translatedStatus(normalizedStatus, t)}
      </StatusBadge>
    )
  }

  return (
    <StatusBadge tone="blue" dot>
      {t('statusOpen')}
    </StatusBadge>
  )
}

function formatTime(
  value: string | null | undefined,
  locale: string,
  t: ReturnType<typeof useTranslations>
) {
  if (!value) return t('timeTbd')

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return t('timeTbd')

  return date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatRelativeTime(
  value: string | null,
  locale: string,
  t: ReturnType<typeof useTranslations>
) {
  if (!value) return t('recently')

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return t('recently')

  const seconds = Math.round(
    (date.getTime() - Date.now()) / 1000
  )

  const formatter = new Intl.RelativeTimeFormat(
    locale,
    { numeric: 'auto' }
  )

  const ranges: Array<
    [number, Intl.RelativeTimeFormatUnit]
  > = [
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
      return formatter.format(
        Math.round(duration),
        unit
      )
    }

    duration /= amount
  }

  return t('recently')
}

function translatedStatus(
  value: string,
  t: ReturnType<typeof useTranslations>
) {
  const map: Record<string, string> = {
    pending: t('statusPending'),
    hired: t('statusHired'),
    accepted: t('statusAccepted'),
    not_selected: t('statusNotSelected'),
    declined: t('statusDeclined'),
    withdrawn: t('statusWithdrawn'),
    completed: t('statusCompleted'),
    in_progress: t('statusInProgress'),
    assigned: t('statusAssigned'),
    closed: t('statusClosed'),
    cancelled: t('statusCancelled'),
    open: t('statusOpen'),
  }

  return map[value] || formatStatus(value)
}

function formatStatus(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}