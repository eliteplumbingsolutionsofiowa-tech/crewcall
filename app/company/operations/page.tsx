'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { resolveCompanyContext } from '@/lib/company-context'
import AIRecruiterHeartbeat from '@/app/components/AIRecruiterHeartbeat'

import GlassCard from '@/app/components/ui/GlassCard'
import PageHeader from '@/app/components/ui/PageHeader'
import PrimaryButton from '@/app/components/ui/PrimaryButton'
import SecondaryButton from '@/app/components/ui/SecondaryButton'
import SectionHeader from '@/app/components/ui/SectionHeader'
import StatCard from '@/app/components/ui/StatCard'
import StatusBadge from '@/app/components/ui/StatusBadge'
import AIRecruiterCommandCenter from '@/app/components/AIRecruiterCommandCenter'

type Job = {
  id: string
  company_id: string
  title: string | null
  description: string | null
  trade: string | null
  location: string | null
  pay_rate: number | null
  start_date: string | null
  created_at: string | null
  status: string | null
  assigned_worker_id: string | null
  payment_status: string | null
  payout_status: string | null
  urgent: boolean | null
  is_featured: boolean | null
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
  sender_id: string | null
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

type WorkerProfile = {
  id: string
  full_name: string | null
  company_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  available_for_work: boolean | null
  currently_working: boolean | null
  is_online: boolean | null
  last_seen: string | null
  crewcall_score: number | null
}

type AutoRecruitAction =
  | 'start'
  | 'pause'
  | 'stop'
  | 'restart'
  | 'send_next'
  | 'status'

type AutoRecruitStatus = {
  success?: boolean
  jobId?: string
  recruiting?: boolean
  complete?: boolean
  startedAt?: string | null
  lastInviteAt?: string | null
  nextWorkerIndex?: number
  inviteCount?: number
  totalMatches?: number
  assignedWorkerId?: string | null
  message?: string
  error?: string
  invitedWorker?: {
    id: string
    name: string
    matchScore: number
    rank: number
  }
}

type ActivityItem = {
  id: string
  title: string
  description: string
  createdAt: string | null
  href: string
  tone: 'blue' | 'green' | 'amber' | 'purple' | 'cyan'
  icon: string
}

type AlertItem = {
  id: string
  title: string
  description: string
  href: string
  actionLabel: string
  severity: 'high' | 'medium' | 'low'
}

type OperationsStats = {
  openJobs: number
  activeJobs: number
  assignedWorkers: number
  applications: number
  unreadNotifications: number
  paymentsDue: number
  urgentJobs: number
  completedJobs: number
}

export default function CompanyOperationsPage() {
  const t = useTranslations('CompanyOperations')
  const locale = useLocale()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState(t('yourCompany'))

  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [workers, setWorkers] = useState<WorkerProfile[]>([])

  const loadOperations = useCallback(
    async (options?: { background?: boolean }) => {
      const background = options?.background === true

      if (background) {
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

        setCurrentUserId(user.id)

        const companyContext =
          await resolveCompanyContext(
            supabase,
            user.id
          )

        if (!companyContext.companyId) {
          setError(
            t('companyOnly'),
          )
          return
        }

        const companyId =
          companyContext.companyId

        const { data: companyProfile, error: companyProfileError } =
          await supabase
            .from('profiles')
            .select('id, role, full_name, company_name')
            .eq('id', companyId)
            .maybeSingle()

        if (companyProfileError) {
          throw companyProfileError
        }

        setCompanyName(
          companyProfile?.company_name ||
            companyProfile?.full_name ||
            t('yourCompany'),
        )

        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select(
            `
              id,
              company_id,
              title,
              description,
              trade,
              location,
              pay_rate,
              start_date,
              created_at,
              status,
              assigned_worker_id,
              payment_status,
              payout_status,
              urgent,
              is_featured
            `,
          )
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })

        if (jobsError) {
          throw jobsError
        }

        const loadedJobs = (jobsData || []) as Job[]
        const jobIds = loadedJobs.map((job) => job.id)

        setJobs(loadedJobs)

        const { data: notificationsData, error: notificationsError } =
          await supabase
            .from('notifications')
            .select(
              'id, title, body, link_url, is_read, read, created_at',
            )
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20)

        if (notificationsError) {
          throw notificationsError
        }

        setNotifications(
          (notificationsData || []) as Notification[],
        )

        if (jobIds.length === 0) {
          setApplications([])
          setMessages([])
          setWorkers([])
          return
        }

        const [applicationsResult, messagesResult] = await Promise.all([
          supabase
            .from('applications')
            .select('id, job_id, worker_id, status, created_at')
            .in('job_id', jobIds)
            .order('created_at', { ascending: false }),

          supabase
            .from('messages')
            .select('id, job_id, sender_id, body, created_at')
            .in('job_id', jobIds)
            .order('created_at', { ascending: false })
            .limit(30),
        ])

        if (applicationsResult.error) {
          throw applicationsResult.error
        }

        if (messagesResult.error) {
          throw messagesResult.error
        }

        const loadedApplications =
          (applicationsResult.data || []) as Application[]

        const loadedMessages =
          (messagesResult.data || []) as Message[]

        setApplications(loadedApplications)
        setMessages(loadedMessages)

        const assignedWorkerIds = Array.from(
          new Set(
            loadedJobs
              .map((job) => job.assigned_worker_id)
              .filter((workerId): workerId is string =>
                Boolean(workerId),
              ),
          ),
        )

        if (assignedWorkerIds.length === 0) {
          setWorkers([])
          return
        }

        const { data: workerData, error: workerError } =
          await supabase
            .from('profiles')
            .select(
              `
                id,
                full_name,
                company_name,
                trade,
                city,
                state,
                available_for_work,
                currently_working,
                is_online,
                last_seen,
                crewcall_score
              `,
            )
            .in('id', assignedWorkerIds)

        if (workerError) {
          console.error(
            'Could not load assigned worker profiles:',
            workerError,
          )

          setWorkers([])
        } else {
          setWorkers((workerData || []) as WorkerProfile[])
        }
      } catch (caughtError) {
        console.error('Company operations error:', caughtError)

        setError(t('loadFailed'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t],
  )

  const updateJobStatus = useCallback(
    async (jobId: string, nextStatus: 'in_progress' | 'completed') => {
      if (updatingJobId) {
        return
      }

      setUpdatingJobId(jobId)
      setError('')

      try {
        const { error: updateError } = await supabase
          .from('jobs')
          .update({ status: nextStatus })
          .eq('id', jobId)
          .eq('company_id', currentUserId || '')

        if (updateError) {
          throw updateError
        }

        setJobs((currentJobs) =>
          currentJobs.map((job) =>
            job.id === jobId
              ? { ...job, status: nextStatus }
              : job,
          ),
        )

        window.dispatchEvent(new Event('crewcall-refresh-nav'))
        void loadOperations({ background: true })
      } catch (caughtError) {
        console.error('Could not update job status:', caughtError)
        setError(t('updateFailed'))
      } finally {
        setUpdatingJobId(null)
      }
    },
    [currentUserId, loadOperations, updatingJobId],
  )

  useEffect(() => {
    void loadOperations()
  }, [loadOperations])

  useEffect(() => {
    if (!currentUserId) {
      return
    }

    const channel = supabase
      .channel(`company-operations-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `company_id=eq.${currentUserId}`,
        },
        () => void loadOperations({ background: true }),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
        },
        () => void loadOperations({ background: true }),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => void loadOperations({ background: true }),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUserId}`,
        },
        () => void loadOperations({ background: true }),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [currentUserId, loadOperations])

  const stats = useMemo<OperationsStats>(() => {
    const openJobs = jobs.filter(
      (job) => normalizeStatus(job.status) === 'open',
    ).length

    const activeJobs = jobs.filter((job) =>
      ['assigned', 'in_progress'].includes(
        normalizeStatus(job.status),
      ),
    ).length

    const assignedWorkers = new Set(
      jobs
        .map((job) => job.assigned_worker_id)
        .filter((workerId): workerId is string =>
          Boolean(workerId),
        ),
    ).size

    const unreadNotifications = notifications.filter(
      (notification) =>
        notification.is_read === false ||
        notification.read === false,
    ).length

    const paymentsDue = jobs.filter((job) => {
      const status = normalizeStatus(job.status)

      return (
        Boolean(job.assigned_worker_id) &&
        ['assigned', 'in_progress', 'completed'].includes(status) &&
        normalizeStatus(job.payment_status) !== 'paid'
      )
    }).length

    return {
      openJobs,
      activeJobs,
      assignedWorkers,
      applications: applications.length,
      unreadNotifications,
      paymentsDue,
      urgentJobs: jobs.filter((job) => Boolean(job.urgent)).length,
      completedJobs: jobs.filter(
        (job) => normalizeStatus(job.status) === 'completed',
      ).length,
    }
  }, [applications, jobs, notifications])

  const applicationsByJobId = useMemo(() => {
    const map = new Map<string, Application[]>()

    applications.forEach((application) => {
      const existing = map.get(application.job_id) || []
      existing.push(application)
      map.set(application.job_id, existing)
    })

    return map
  }, [applications])

  const messagesByJobId = useMemo(() => {
    const map = new Map<string, Message[]>()

    messages.forEach((message) => {
      if (!message.job_id) {
        return
      }

      const existing = map.get(message.job_id) || []
      existing.push(message)
      map.set(message.job_id, existing)
    })

    return map
  }, [messages])

  const workerById = useMemo(() => {
    return new Map(
      workers.map((worker) => [worker.id, worker]),
    )
  }, [workers])

  const operationalJobs = useMemo(() => {
    return jobs
      .filter((job) =>
        ['open', 'assigned', 'in_progress'].includes(
          normalizeStatus(job.status),
        ),
      )
      .sort((firstJob, secondJob) => {
        if (firstJob.urgent && !secondJob.urgent) {
          return -1
        }

        if (!firstJob.urgent && secondJob.urgent) {
          return 1
        }

        const firstStart = toTimestamp(firstJob.start_date)
        const secondStart = toTimestamp(secondJob.start_date)

        return firstStart - secondStart
      })
  }, [jobs])

  const todaysJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        if (!job.start_date) {
          return false
        }

        const status = normalizeStatus(job.status)

        return (
          isSameLocalDay(job.start_date, new Date()) &&
          !['closed', 'cancelled'].includes(status)
        )
      })
      .sort((firstJob, secondJob) => {
        if (firstJob.urgent && !secondJob.urgent) {
          return -1
        }

        if (!firstJob.urgent && secondJob.urgent) {
          return 1
        }

        return (
          toTimestamp(firstJob.start_date) -
          toTimestamp(secondJob.start_date)
        )
      })
  }, [jobs])

  const todaysCrew = useMemo(() => {
    return jobs
      .filter(
        (job) =>
          Boolean(job.assigned_worker_id) &&
          ['assigned', 'in_progress'].includes(
            normalizeStatus(job.status),
          ),
      )
      .map((job) => ({
        job,
        worker: job.assigned_worker_id
          ? workerById.get(job.assigned_worker_id) || null
          : null,
      }))
      .sort((firstItem, secondItem) => {
        return (
          toTimestamp(firstItem.job.start_date) -
          toTimestamp(secondItem.job.start_date)
        )
      })
  }, [jobs, workerById])

  const alerts = useMemo<AlertItem[]>(() => {
    const results: AlertItem[] = []

    jobs.forEach((job) => {
      const status = normalizeStatus(job.status)
      const jobApplications =
        applicationsByJobId.get(job.id) || []

      if (status === 'open' && jobApplications.length === 0) {
        results.push({
          id: `no-applicants-${job.id}`,
          title: job.title || t('untitledJob'),
          description:
            t('noApplicationsAlert'),
          href: `/jobs/${job.id}/boost`,
          actionLabel: t('boostJob'),
          severity: job.urgent ? 'high' : 'medium',
        })
      }

      if (
        job.assigned_worker_id &&
        status === 'completed' &&
        normalizeStatus(job.payment_status) !== 'paid'
      ) {
        results.push({
          id: `payment-${job.id}`,
          title: job.title || t('untitledJob'),
          description:
            t('paymentOutstanding'),
          href: `/jobs/${job.id}/pay`,
          actionLabel: t('payWorker'),
          severity: 'high',
        })
      }

      if (
        job.urgent &&
        status === 'open' &&
        jobApplications.length < 2
      ) {
        results.push({
          id: `urgent-${job.id}`,
          title: job.title || t('urgentJob'),
          description:
            t('urgentFewApplicants'),
          href: `/my-jobs/${job.id}`,
          actionLabel: t('reviewJob'),
          severity: 'high',
        })
      }
    })

    return results
      .sort((firstAlert, secondAlert) => {
        const priorities = {
          high: 0,
          medium: 1,
          low: 2,
        }

        return (
          priorities[firstAlert.severity] -
          priorities[secondAlert.severity]
        )
      })
      .slice(0, 8)
  }, [applicationsByJobId, jobs, t])

  const aiOperationsSummary = useMemo(() => {
    const recommendations: Array<{
      id: string
      title: string
      description: string
      href: string
      actionLabel: string
      severity: 'high' | 'medium' | 'low'
    }> = []

    const unstaffedJobs = jobs.filter((job) => {
      const status = normalizeStatus(job.status)

      return (
        ['open', 'assigned'].includes(status) &&
        !job.assigned_worker_id
      )
    })

    const urgentUnstaffedJobs = unstaffedJobs.filter((job) =>
      Boolean(job.urgent),
    )

    const jobsStartingSoonWithoutWorkers = unstaffedJobs.filter(
      (job) => {
        if (!job.start_date) {
          return false
        }

        const startTime = toTimestamp(job.start_date)
        const now = Date.now()
        const fortyEightHours = 48 * 60 * 60 * 1000

        return (
          startTime >= now &&
          startTime <= now + fortyEightHours
        )
      },
    )

    if (urgentUnstaffedJobs.length > 0) {
      recommendations.push({
        id: 'urgent-staffing',
        title: t('urgentStaffingRisk'),
        description: t('urgentJobsNeedWorkers', { count: urgentUnstaffedJobs.length }),
        href: '/company/jobs',
        actionLabel: t('staffJobs'),
        severity: 'high',
      })
    }

    if (jobsStartingSoonWithoutWorkers.length > 0) {
      recommendations.push({
        id: 'starting-soon',
        title: t('jobsStartingSoon'),
        description: t('startingSoonNoWorkers', { count: jobsStartingSoonWithoutWorkers.length }),
        href: '/workers',
        actionLabel: t('findWorkers'),
        severity: 'high',
      })
    }

    if (stats.paymentsDue > 0) {
      recommendations.push({
        id: 'payments-due',
        title: t('paymentsNeedAttention'),
        description: t('paymentsNotPaid', { count: stats.paymentsDue }),
        href: '/admin/payments',
        actionLabel: t('reviewPayments'),
        severity: 'medium',
      })
    }

    if (stats.unreadNotifications > 0) {
      recommendations.push({
        id: 'unread-notifications',
        title: t('unreadCompanyAlerts'),
        description: t('notificationsToReview', { count: stats.unreadNotifications }),
        href: '/notifications',
        actionLabel: t('viewAlerts'),
        severity: 'low',
      })
    }

    if (
      stats.openJobs > 0 &&
      stats.applications === 0
    ) {
      recommendations.push({
        id: 'low-candidate-flow',
        title: t('candidateFlowLow'),
        description:
          t('candidateFlowLowDescription'),
        href: '/company/worker-map',
        actionLabel: t('runRecruiter'),
        severity: 'medium',
      })
    }

    if (recommendations.length === 0) {
      recommendations.push({
        id: 'healthy-operation',
        title: t('operationHealthy'),
        description:
          t('operationHealthyDescription'),
        href: '/company/jobs',
        actionLabel: t('viewJobs'),
        severity: 'low',
      })
    }

    let healthScore = 100

    healthScore -= urgentUnstaffedJobs.length * 12
    healthScore -= jobsStartingSoonWithoutWorkers.length * 8
    healthScore -= stats.paymentsDue * 4
    healthScore -= Math.min(stats.unreadNotifications, 10)
    healthScore -=
      stats.openJobs > 0 && stats.applications === 0 ? 8 : 0

    healthScore = Math.max(
      35,
      Math.min(100, healthScore),
    )

    const highPriorityCount = recommendations.filter(
      (recommendation) =>
        recommendation.severity === 'high',
    ).length

    const mediumPriorityCount = recommendations.filter(
      (recommendation) =>
        recommendation.severity === 'medium',
    ).length

    const status =
      healthScore >= 90
        ? t('excellent')
        : healthScore >= 75
          ? t('stable')
          : healthScore >= 60
            ? t('needsAttention')
            : t('atRisk')

    return {
      healthScore,
      status,
      highPriorityCount,
      mediumPriorityCount,
      recommendations: recommendations.slice(0, 5),
    }
  }, [
    jobs,
    stats.applications,
    stats.openJobs,
    stats.paymentsDue,
    stats.unreadNotifications,
    t,
  ])

  const activityFeed = useMemo<ActivityItem[]>(() => {
    const applicationActivity = applications
      .slice(0, 10)
      .map((application) => {
        const job = jobs.find(
          (item) => item.id === application.job_id,
        )

        return {
          id: `application-${application.id}`,
          title: t('newJobApplication'),
          description: t('receivedApplication', {
            job: job?.title || t('companyJob'),
          }),
          createdAt: application.created_at,
          href: `/my-jobs/${application.job_id}/applicants`,
          tone: 'blue' as const,
          icon: '◎',
        }
      })

    const messageActivity = messages
      .filter(
        (message) =>
          !currentUserId || message.sender_id !== currentUserId,
      )
      .slice(0, 10)
      .map((message) => ({
        id: `message-${message.id}`,
        title: t('newMessageReceived'),
        description:
          message.body || t('workerSentMessage'),
        createdAt: message.created_at,
        href: '/messages',
        tone: 'cyan' as const,
        icon: '✉',
      }))

    const notificationActivity = notifications
      .slice(0, 10)
      .map((notification) => ({
        id: `notification-${notification.id}`,
        title:
          notification.title || t('crewCallNotification'),
        description:
          notification.body ||
          t('companyNewUpdate'),
        createdAt: notification.created_at,
        href:
          notification.link_url &&
          notification.link_url.startsWith('/')
            ? notification.link_url
            : '/notifications',
        tone: notificationTone(notification),
        icon: '✓',
      }))

    return [
      ...applicationActivity,
      ...messageActivity,
      ...notificationActivity,
    ]
      .sort(
        (firstItem, secondItem) =>
          toTimestamp(secondItem.createdAt) -
          toTimestamp(firstItem.createdAt),
      )
      .slice(0, 12)
  }, [
    applications,
    currentUserId,
    jobs,
    messages,
    notifications,
    t,
  ])

  const recentApplications = applications.slice(0, 6)

  if (loading) {
    return <OperationsLoading />
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
      <AIRecruiterHeartbeat />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[34rem] w-[65rem] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-80 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-[55rem] h-96 w-96 rounded-full bg-purple-500/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl space-y-8">
        <PageHeader
          eyebrow={t('eyebrow')}
          greeting={getGreeting(t)}
          title={t('operationsTitle', { company: companyName })}
          description={t('description')}
          actions={
            <div className="flex flex-wrap gap-3">
              <PrimaryButton href="/post-job">
                {t('postJob')}
              </PrimaryButton>

              <SecondaryButton href="/workers">
                {t('findWorkers')}
              </SecondaryButton>

              <button
                type="button"
                onClick={() =>
                  void loadOperations({ background: true })
                }
                disabled={refreshing}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:border-blue-400/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? t('refreshing') : t('refresh')}
              </button>
            </div>
          }
        />

        {!error && (
          <section className="mb-6">
            <GlassCard
              padding="lg"
              accent
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-300">
                    {t('aiOperations')}
                  </p>

                  <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
                    {t('liveBriefing')}
                  </h2>

                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
                    {t('liveBriefingDescription')}
                  </p>
                </div>

                <div className="grid min-w-full gap-3 sm:grid-cols-3 xl:min-w-[520px]">
                  <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-300">
                      Health Score
                    </p>

                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-4xl font-black text-white">
                        {aiOperationsSummary.healthScore}
                      </span>

                      <span className="pb-1 text-sm font-bold text-slate-400">
                        / 100
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-black text-blue-200">
                      {aiOperationsSummary.status}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">
                      Critical
                    </p>

                    <p className="mt-3 text-4xl font-black text-white">
                      {aiOperationsSummary.highPriorityCount}
                    </p>

                    <p className="mt-2 text-sm font-semibold text-red-100/70">
                      High-priority actions
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">
                      Watchlist
                    </p>

                    <p className="mt-3 text-4xl font-black text-white">
                      {aiOperationsSummary.mediumPriorityCount}
                    </p>

                    <p className="mt-2 text-sm font-semibold text-amber-100/70">
                      {t('itemsNeedingReview')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-7 grid gap-3 lg:grid-cols-2">
                {aiOperationsSummary.recommendations.map(
                  (recommendation) => (
                    <Link
                      key={recommendation.id}
                      href={recommendation.href}
                      className="group rounded-2xl border border-white/10 bg-slate-950/55 p-5 transition hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-slate-900/80"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                recommendation.severity === 'high'
                                  ? 'bg-red-400'
                                  : recommendation.severity ===
                                      'medium'
                                    ? 'bg-amber-400'
                                    : 'bg-emerald-400'
                              }`}
                            />

                            <p className="font-black text-white">
                              {recommendation.title}
                            </p>
                          </div>

                          <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
                            {recommendation.description}
                          </p>
                        </div>

                        <span className="shrink-0 text-sm font-black text-blue-300 transition group-hover:translate-x-1">
                          {recommendation.actionLabel} →
                        </span>
                      </div>
                    </Link>
                  ),
                )}
              </div>
            </GlassCard>
          </section>
        )}

        {error && (
          <GlassCard
            padding="lg"
            className="border-red-400/30 bg-red-500/10"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-red-100">
                  {t('operationsUnavailable')}
                </p>

                <p className="mt-1 text-sm font-semibold text-red-200/80">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadOperations()}
                className="rounded-xl border border-red-300/20 bg-red-300/10 px-4 py-2 text-sm font-black text-red-100 transition hover:bg-red-300/20"
              >
                {t('tryAgain')}
              </button>
            </div>
          </GlassCard>
        )}

        {!error && (
          <>
            <section>
              <SectionHeader
                eyebrow={t('liveSnapshot')}
                title={t('operationNow')}
                description={t('realtimeDescription')}
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
                  title={t('activeJobs')}
                  value={stats.activeJobs}
                  description={t('assignedOrProgress')}
                  tone="blue"
                  icon={<span aria-hidden="true">⚒</span>}
                />

                <StatCard
                  title={t('assignedWorkers')}
                  value={stats.assignedWorkers}
                  description={t('workersOnJobs')}
                  tone="purple"
                  icon={<span aria-hidden="true">◎</span>}
                />

                <StatCard
                  title={t('applications')}
                  value={stats.applications}
                  description={t('workersPipeline')}
                  tone="blue"
                  icon={<span aria-hidden="true">✓</span>}
                />

                <StatCard
                  title={t('paymentsDue')}
                  value={stats.paymentsDue}
                  description={t('workNotPaid')}
                  tone={stats.paymentsDue > 0 ? 'amber' : 'green'}
                  icon={<span aria-hidden="true">$</span>}
                />

                <StatCard
                  title={t('urgentJobs')}
                  value={stats.urgentJobs}
                  description={t('jobsMarkedUrgent')}
                  tone={stats.urgentJobs > 0 ? 'red' : 'green'}
                  icon={<span aria-hidden="true">!</span>}
                />

                <StatCard
                  title={t('unreadAlerts')}
                  value={stats.unreadNotifications}
                  description={t('notificationsReview')}
                  tone={
                    stats.unreadNotifications > 0
                      ? 'amber'
                      : 'green'
                  }
                  icon={<span aria-hidden="true">●</span>}
                />

                <StatCard
                  title={t('completed')}
                  value={stats.completedJobs}
                  description={t('finishedJobs')}
                  tone="green"
                  icon={<span aria-hidden="true">★</span>}
                />
              </div>
            </section>

            {jobs.length === 0 ? (
              <FirstJobState />
            ) : (
              <>
                <section>
                  <SectionHeader
                    eyebrow={t('todaysSchedule')}
                    title={t('jobsScheduledToday')}
                    description={t('scheduleDescription')}
                    action={
                      <SecondaryButton href="/company/jobs" size="sm">
                        {t('fullSchedule')}
                      </SecondaryButton>
                    }
                  />

                  <div className="mt-5">
                    {todaysJobs.length === 0 ? (
                      <GlassCard padding="lg">
                        <EmptyState
                          title={t('nothingScheduled')}
                          description={t('nothingScheduledDescription')}
                        />
                      </GlassCard>
                    ) : (
                      <div className="grid gap-4 xl:grid-cols-2">
                        {todaysJobs.map((job) => (
                          <TodayScheduleCard
                            key={job.id}
                            job={job}
                            worker={
                              job.assigned_worker_id
                                ? workerById.get(job.assigned_worker_id) || null
                                : null
                            }
                            updating={updatingJobId === job.id}
                            onStart={() =>
                              void updateJobStatus(job.id, 'in_progress')
                            }
                            onComplete={() =>
                              void updateJobStatus(job.id, 'completed')
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <SectionHeader
                    eyebrow={t('quickActions')}
                    title={t('moveWorkForward')}
                    description={t('quickActionsDescription')}
                  />

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    <QuickAction
                      href="/post-job"
                      icon="+"
                      title={t('postJobShort')}
                      description={t('createNewWork')}
                    />

                    <QuickAction
                      href="/workers"
                      icon="⌖"
                      title={t('findWorkers')}
                      description={t('searchAvailableHelp')}
                    />

                    <QuickAction
                      href="/company/applications"
                      icon="✓"
                      title={t('applicants')}
                      description={t('reviewCandidates')}
                    />

                    <QuickAction
                      href="/messages"
                      icon="✉"
                      title={t('messages')}
                      description={t('openConversations')}
                    />

                    <QuickAction
                      href="/company/jobs"
                      icon="▣"
                      title={t('jobs')}
                      description={t('manageAllJobs')}
                    />

                    <QuickAction
                      href="/company/analytics"
                      icon="↗"
                      title={t('analytics')}
                      description={t('viewPerformance')}
                    />
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
                  <GlassCard padding="lg" accent>
                    <SectionHeader
                      eyebrow={t('dispatchBoard')}
                      title={t('activeCompanyJobs')}
                      description={t('dispatchDescription')}
                      action={
                        <SecondaryButton
                          href="/company/jobs"
                          size="sm"
                        >
                          {t('viewAllJobs')}
                        </SecondaryButton>
                      }
                    />

                    <div className="mt-6">
                      {operationalJobs.length === 0 ? (
                        <EmptyState
                          title={t('noActiveJobs')}
                          description={t('noActiveJobsDescription')}
                        />
                      ) : (
                        <div className="space-y-4">
                          {operationalJobs
                            .slice(0, 8)
                            .map((job) => (
                              <OperationsJobCard
                                key={job.id}
                                job={job}
                                applicationCount={
                                  applicationsByJobId.get(
                                    job.id,
                                  )?.length || 0
                                }
                                messageCount={
                                  messagesByJobId.get(job.id)
                                    ?.length || 0
                                }
                                worker={
                                  job.assigned_worker_id
                                    ? workerById.get(
                                        job.assigned_worker_id,
                                      ) || null
                                    : null
                                }
                              />
                            ))}
                        </div>
                      )}
                    </div>
                  </GlassCard>

                  <GlassCard padding="lg">
                    <SectionHeader
                      eyebrow={t('needsAttention')}
                      title={t('operationalAlerts')}
                      description={t('alertsDescription')}
                    />

                    <div className="mt-6">
                      {alerts.length === 0 ? (
                        <EmptyState
                          title={t('everythingLooksGood')}
                          description={t('noAlertsDescription')}
                        />
                      ) : (
                        <div className="space-y-3">
                          {alerts.map((alert) => (
                            <AlertCard
                              key={alert.id}
                              alert={alert}
                            />
                          ))}
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
                      eyebrow={t('crewBoard')}
                      title={t('assignedWorkersTitle')}
                      description={t('assignedWorkersDescription')}
                    />

                    <div className="mt-6">
                      {todaysCrew.length === 0 ? (
                        <EmptyState
                          title={t('noWorkersAssigned')}
                          description={t('noWorkersAssignedDescription')}
                        />
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {todaysCrew
                            .slice(0, 8)
                            .map(({ job, worker }) => (
                              <CrewMemberCard
                                key={job.id}
                                job={job}
                                worker={worker}
                              />
                            ))}
                        </div>
                      )}
                    </div>
                  </GlassCard>

                  <GlassCard padding="lg">
                    <SectionHeader
                      eyebrow={t('hiringPipeline')}
                      title={t('recentApplicants')}
                      description={t('recentApplicantsDescription')}
                      action={
                        <SecondaryButton
                          href="/company/applications"
                          size="sm"
                        >
                          {t('viewAll')}
                        </SecondaryButton>
                      }
                    />

                    <div className="mt-6">
                      {recentApplications.length === 0 ? (
                        <EmptyState
                          title={t('noApplicants')}
                          description={t('noApplicantsDescription')}
                        />
                      ) : (
                        <div className="space-y-3">
                          {recentApplications.map(
                            (application) => {
                              const job = jobs.find(
                                (item) =>
                                  item.id ===
                                  application.job_id,
                              )

                              return (
                                <Link
                                  key={application.id}
                                  href={`/my-jobs/${application.job_id}/applicants`}
                                  className="group block rounded-2xl border border-white/10 bg-slate-950/55 p-4 transition hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-slate-900/80"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate font-black text-white">
                                        {job?.title ||
                                          t('untitledJob')}
                                      </p>

                                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                        {formatDate(application.created_at, locale, t)}
                                      </p>
                                    </div>

                                    <ApplicationBadge
                                      status={
                                        application.status
                                      }
                                    />
                                  </div>
                                </Link>
                              )
                            },
                          )}
                        </div>
                      )}
                    </div>
                  </GlassCard>
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                  <GlassCard padding="lg">
                    <SectionHeader
                      eyebrow={t('liveActivity')}
                      title={t('recentCompanyActivity')}
                      description={t('recentCompanyActivityDescription')}
                      action={
                        <SecondaryButton
                          href="/notifications"
                          size="sm"
                        >
                          {t('notifications')}
                        </SecondaryButton>
                      }
                    />

                    <div className="mt-6">
                      {activityFeed.length === 0 ? (
                        <EmptyState
                          title={t('noRecentActivity')}
                          description={t('noRecentActivityDescription')}
                        />
                      ) : (
                        <div className="relative space-y-3 before:absolute before:bottom-5 before:left-[1.42rem] before:top-5 before:w-px before:bg-white/10">
                          {activityFeed.map((activity) => (
                            <ActivityFeedItem
                              key={activity.id}
                              activity={activity}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </GlassCard>

                  <GlassCard padding="lg">
                    <SectionHeader
                      eyebrow={t('companyPerformance')}
                      title={t('hiringFunnel')}
                      description={t('hiringFunnelDescription')}
                    />

                    <div className="mt-6 space-y-3">
                      <FunnelMetric
                        label={t('jobsPosted')}
                        value={jobs.length}
                        maximum={Math.max(jobs.length, 1)}
                      />

                      <FunnelMetric
                        label={t('applications')}
                        value={applications.length}
                        maximum={Math.max(
                          applications.length,
                          jobs.length,
                          1,
                        )}
                      />

                      <FunnelMetric
                        label={t('assignedJobs')}
                        value={stats.assignedWorkers}
                        maximum={Math.max(jobs.length, 1)}
                      />

                      <FunnelMetric
                        label={t('completedJobs')}
                        value={stats.completedJobs}
                        maximum={Math.max(jobs.length, 1)}
                      />
                    </div>

                    <div className="mt-6">
                      <PrimaryButton href="/company/analytics">
                        {t('viewFullAnalytics')}
                      </PrimaryButton>
                    </div>
                  </GlassCard>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function TodayScheduleCard({
  job,
  worker,
  updating,
  onStart,
  onComplete,
}: {
  job: Job
  worker: WorkerProfile | null
  updating: boolean
  onStart: () => void
  onComplete: () => void
}) {
  const t = useTranslations('CompanyOperations')
  const locale = useLocale()
  const status = normalizeStatus(job.status)
  const workerName = worker
    ? getWorkerName(worker)
    : t('noWorkerAssigned')
  const directionsHref = getDirectionsHref(job.location)
  const canStart = ['assigned', 'open'].includes(status)
  const canComplete = status === 'in_progress'
  const isCompleted = status === 'completed'

  return (
    <GlassCard
      padding="lg"
      accent={Boolean(job.urgent)}
      className={
        job.urgent
          ? 'border-red-400/25 bg-red-400/[0.05]'
          : ''
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <JobStatusBadge status={job.status} />

              {job.urgent && (
                <StatusBadge tone="red" dot pulse>
                  Urgent
                </StatusBadge>
              )}
            </div>

            <Link
              href={`/my-jobs/${job.id}`}
              className="mt-3 block truncate text-xl font-black text-white transition hover:text-blue-200"
            >
              {job.title || t('untitledJob')}
            </Link>
          </div>

          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-right">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200/70">
              Start
            </p>
            <p className="mt-1 text-lg font-black text-cyan-100">
              {formatTime(job.start_date, locale, t)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ScheduleDetail
            label={t('assignedWorker')}
            value={workerName}
            icon="◎"
            tone={worker ? 'green' : 'amber'}
          />

          <ScheduleDetail
            label={t('jobLocation')}
            value={job.location || t('locationNotListed')}
            icon="⌖"
            tone="blue"
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {canStart && (
            <ScheduleActionButton
              onClick={onStart}
              disabled={updating}
              emphasis
            >
              {updating ? t('updating') : t('startJob')}
            </ScheduleActionButton>
          )}

          {canComplete && (
            <ScheduleActionButton
              onClick={onComplete}
              disabled={updating}
              emphasis
            >
              {updating ? t('updating') : t('complete')}
            </ScheduleActionButton>
          )}

          {isCompleted && (
            <Link
              href={`/jobs/${job.id}/pay`}
              className="rounded-xl bg-green-400 px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-green-300"
            >
              Payment
            </Link>
          )}

          <Link
            href={`/my-jobs/${job.id}`}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-white/10"
          >
            Open Job
          </Link>

          {job.assigned_worker_id ? (
            <Link
              href={`/messages?workerId=${job.assigned_worker_id}&jobId=${job.id}`}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-white/10"
            >
              Message Worker
            </Link>
          ) : (
            <Link
              href="/workers"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-white/10"
            >
              Find Worker
            </Link>
          )}

          {directionsHref ? (
            <a
              href={directionsHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-white/10"
            >
              Navigate
            </a>
          ) : (
            <span className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-center text-sm font-black text-slate-600">
              No Address
            </span>
          )}
        </div>
      </div>
    </GlassCard>
  )
}

function ScheduleDetail({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: string
  icon: string
  tone: 'blue' | 'green' | 'amber'
}) {
  const tones = {
    blue: 'border-blue-400/20 bg-blue-400/[0.07] text-blue-200',
    green:
      'border-green-400/20 bg-green-400/[0.07] text-green-200',
    amber:
      'border-amber-400/20 bg-amber-400/[0.07] text-amber-200',
  }

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/10 font-black">
          {icon}
        </span>

        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">
            {label}
          </p>
          <p className="mt-1 truncate font-black text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  )
}

function ScheduleActionButton({
  children,
  onClick,
  disabled,
  emphasis = false,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  emphasis?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
        emphasis
          ? 'bg-blue-500 text-white hover:bg-blue-400'
          : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

function OperationsJobCard({
  job,
  applicationCount,
  messageCount,
  worker,
}: {
  job: Job
  applicationCount: number
  messageCount: number
  worker: WorkerProfile | null
}) {
  const t = useTranslations('CompanyOperations')
  const locale = useLocale()
  const status = normalizeStatus(job.status)
  const paymentDue =
    Boolean(job.assigned_worker_id) &&
    normalizeStatus(job.payment_status) !== 'paid'

  const [autoRecruitStatus, setAutoRecruitStatus] =
    useState<AutoRecruitStatus | null>(null)

  const [autoRecruitLoading, setAutoRecruitLoading] =
    useState(false)

  const [autoRecruitMessage, setAutoRecruitMessage] =
    useState('')

  const [autoRecruitError, setAutoRecruitError] =
    useState('')

  const runAutoRecruitAction = useCallback(
    async (
      action: AutoRecruitAction,
      options?: {
        automaticallySendFirst?: boolean
      },
    ) => {
      if (autoRecruitLoading) {
        return
      }

      setAutoRecruitLoading(true)
      setAutoRecruitMessage('')
      setAutoRecruitError('')

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session?.access_token) {
          throw new Error(t('loginAgainRecruiter'))
        }

        const sendAction = async (
          requestedAction: AutoRecruitAction,
        ) => {
          const response = await fetch(
            `/api/jobs/${job.id}/auto-recruit`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                action: requestedAction,
              }),
            },
          )

          const result =
            (await response.json().catch(() => null)) as
              | AutoRecruitStatus
              | null

          if (!response.ok) {
            throw new Error(
              result?.error ||
                result?.message ||
                t('aiRecruitingUpdateFailed'),
            )
          }

          return result || {}
        }

        let result = await sendAction(action)

        if (
          action === 'start' &&
          options?.automaticallySendFirst &&
          result.recruiting
        ) {
          result = await sendAction('send_next')
        }

        setAutoRecruitStatus((currentStatus) => ({
          ...currentStatus,
          ...result,
        }))

        setAutoRecruitMessage(
          result.message ||
            (action === 'status'
              ? ''
              : t('aiRecruitingUpdated')),
        )
      } catch (caughtError) {
        console.error(
          'AI auto recruiter action failed:',
          caughtError,
        )

        setAutoRecruitError(
          caughtError instanceof Error
            ? caughtError.message
            : t('aiRecruitingUpdateFailed'),
        )
      } finally {
        setAutoRecruitLoading(false)
      }
    },
    [autoRecruitLoading, job.id, t],
  )

  useEffect(() => {
    if (status !== 'open' || job.assigned_worker_id) {
      return
    }

    void runAutoRecruitAction('status')
  }, [
    job.assigned_worker_id,
    job.id,
    status,
  ])

  const dispatchIntelligence = (() => {
    let matchScore = 52

    matchScore += Math.min(applicationCount * 8, 24)
    matchScore += job.trade ? 8 : 0
    matchScore += job.location ? 6 : 0
    matchScore += job.pay_rate != null ? 5 : 0
    matchScore += job.start_date ? 5 : 0
    matchScore += worker ? 20 : 0
    matchScore -= job.urgent && !worker ? 12 : 0

    matchScore = Math.max(20, Math.min(99, matchScore))

    const staffingRisk =
      worker
        ? t('riskLow')
        : job.urgent || applicationCount === 0
          ? t('riskHigh')
          : applicationCount < 3
            ? t('riskMedium')
            : t('riskLow')

    const confidence =
      worker
        ? 96
        : applicationCount >= 5
          ? 86
          : applicationCount >= 2
            ? 72
            : applicationCount === 1
              ? 58
              : 34

    const recommendation =
      worker
        ? t('workerAssignedRecommendation')
        : applicationCount >= 3
          ? t('reviewStrongest')
          : applicationCount > 0
            ? t('reviewAndInvite')
            : t('runAiImmediately')

    return {
      matchScore,
      staffingRisk,
      confidence,
      recommendation,
    }
  })()

  return (
    <div
      className={`rounded-3xl border p-5 transition ${
        job.urgent
          ? 'border-red-400/25 bg-red-400/[0.06]'
          : 'border-white/10 bg-slate-950/55'
      }`}
    >
      <div className="flex flex-col gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <JobStatusBadge status={job.status} />

            {job.urgent && (
              <StatusBadge tone="red" dot pulse>
                Urgent
              </StatusBadge>
            )}

            {job.is_featured && (
              <StatusBadge tone="purple">
                Featured
              </StatusBadge>
            )}

            {paymentDue && (
              <StatusBadge tone="amber">
                Payment Due
              </StatusBadge>
            )}
          </div>

          <Link
            href={`/my-jobs/${job.id}`}
            className="mt-3 block truncate text-xl font-black text-white transition hover:text-blue-200"
          >
            {job.title || t('untitledJob')}
          </Link>

          <p className="mt-2 text-sm font-semibold text-slate-400">
            {[job.trade, job.location].filter(Boolean).join(' • ') ||
              t('jobDetailsNotListed')}
          </p>

          <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
              {t('applicantCount', { count: applicationCount })}
            </span>

            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
              {t('messageCount', { count: messageCount })}
            </span>

            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
              {job.pay_rate != null
                ? `$${Number(job.pay_rate).toLocaleString()}`
                : t('payNotListed')}
            </span>

            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
              {job.start_date
                ? t('starts', { date: formatDate(job.start_date, locale, t) })
                : t('startDateNotListed')}
            </span>
          </div>

          {worker && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-green-400/15 bg-green-400/[0.06] px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-400/15 font-black text-green-200">
                {getInitial(worker)}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">
                  {getWorkerName(worker, t)}
                </p>

                <p className="text-xs font-semibold text-green-200/70">
                  Assigned worker
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-blue-400/15 bg-blue-500/[0.06] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-300">
                  AI Dispatch
                </p>

                <p className="mt-1 text-sm font-black text-white">
                  {dispatchIntelligence.recommendation}
                </p>
              </div>

              <StatusBadge
                tone={
                  dispatchIntelligence.staffingRisk === 'High'
                    ? 'red'
                    : dispatchIntelligence.staffingRisk === 'Medium'
                      ? 'amber'
                      : 'green'
                }
              >
                {t('risk', { level: dispatchIntelligence.staffingRisk })}
              </StatusBadge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Match Score
                </p>

                <p className="mt-1 text-2xl font-black text-white">
                  {dispatchIntelligence.matchScore}%
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Hiring Confidence
                </p>

                <p className="mt-1 text-2xl font-black text-white">
                  {dispatchIntelligence.confidence}%
                </p>
              </div>
            </div>
          </div>
        </div>

          {status === 'open' && !job.assigned_worker_id && (
            <div className="mt-6 w-full">
              <AIRecruiterCommandCenter
                jobId={job.id}
                jobTitle={job.title}
              />
            </div>
          )}

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <OperationButton href={`/my-jobs/${job.id}`}>
            Manage
          </OperationButton>

          {status === 'open' && (
            <OperationButton
              href={`/my-jobs/${job.id}/applicants`}
              emphasis
            >
              Applicants
            </OperationButton>
          )}

          {status === 'open' && (
            <OperationButton
              href={`/company/worker-map?jobId=${job.id}`}
              emphasis
            >
              Run AI Recruiter
            </OperationButton>
          )}

          {status === 'open' && (
            <OperationButton href={`/workers`}>
              Find Worker
            </OperationButton>
          )}

          {status === 'open' && (
            <OperationButton href={`/jobs/${job.id}/boost`}>
              Boost
            </OperationButton>
          )}

          {job.assigned_worker_id && (
            <OperationButton href="/messages">
              Message
            </OperationButton>
          )}

          {paymentDue && (
            <OperationButton
              href={`/jobs/${job.id}/pay`}
              emphasis
            >
              Pay
            </OperationButton>
          )}
        </div>
      </div>
    </div>
  )
}

function CrewMemberCard({
  job,
  worker,
}: {
  job: Job
  worker: WorkerProfile | null
}) {
  const t = useTranslations('CompanyOperations')
  const locale = useLocale()
  const workerName = worker
    ? getWorkerName(worker, t)
    : t('assignedWorkerFallback')

  const inProgress =
    normalizeStatus(job.status) === 'in_progress'

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
      <div className="flex items-start gap-4">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-xl font-black text-white">
          {worker ? getInitial(worker) : 'W'}

          {worker && isActuallyOnline(worker) && (
            <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-4 border-slate-950 bg-lime-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black text-white">
            {workerName}
          </p>

          <p className="mt-1 truncate text-sm font-semibold text-blue-300">
            {job.title || t('untitledJob')}
          </p>

          <p className="mt-2 text-sm text-slate-400">
            {[worker?.trade, job.location]
              .filter(Boolean)
              .join(' • ') || t('assignmentDetailsNotListed')}
          </p>
        </div>

        <StatusBadge
          tone={inProgress ? 'cyan' : 'purple'}
          dot
          pulse={inProgress}
        >
          {inProgress ? t('working') : t('assigned')}
        </StatusBadge>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniMetric
          label={t('start')}
          value={
            job.start_date
              ? formatShortDate(job.start_date, locale, t)
              : t('notSet')
          }
        />

        <MiniMetric
          label={t('score')}
          value={
            worker?.crewcall_score != null
              ? String(worker.crewcall_score)
              : '—'
          }
        />
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          href={`/my-jobs/${job.id}`}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-white/10"
        >
          Job
        </Link>

        {worker && (
          <Link
            href={`/profile?user=${worker.id}`}
            className="flex-1 rounded-xl bg-blue-500 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-blue-400"
          >
            Worker
          </Link>
        )}
      </div>
    </div>
  )
}

function AlertCard({ alert }: { alert: AlertItem }) {
  const styles = {
    high: {
      wrapper: 'border-red-400/25 bg-red-400/[0.07]',
      icon: 'bg-red-400/15 text-red-200',
      text: 'text-red-100',
      button: 'bg-red-400 text-slate-950 hover:bg-red-300',
    },
    medium: {
      wrapper: 'border-amber-400/25 bg-amber-400/[0.07]',
      icon: 'bg-amber-400/15 text-amber-200',
      text: 'text-amber-100',
      button:
        'bg-amber-400 text-slate-950 hover:bg-amber-300',
    },
    low: {
      wrapper: 'border-blue-400/25 bg-blue-400/[0.07]',
      icon: 'bg-blue-400/15 text-blue-200',
      text: 'text-blue-100',
      button: 'bg-blue-400 text-slate-950 hover:bg-blue-300',
    },
  }

  const style = styles[alert.severity]

  return (
    <div className={`rounded-2xl border p-4 ${style.wrapper}`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black ${style.icon}`}
        >
          !
        </div>

        <div className="min-w-0">
          <p className={`font-black ${style.text}`}>
            {alert.title}
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            {alert.description}
          </p>
        </div>
      </div>

      <Link
        href={alert.href}
        className={`mt-4 block rounded-xl px-4 py-3 text-center text-sm font-black transition ${style.button}`}
      >
        {alert.actionLabel}
      </Link>
    </div>
  )
}

function ActivityFeedItem({
  activity,
}: {
  activity: ActivityItem
}) {
  const tones = {
    blue: 'border-blue-400/20 bg-blue-400/10 text-blue-200',
    green:
      'border-green-400/20 bg-green-400/10 text-green-200',
    amber:
      'border-amber-400/20 bg-amber-400/10 text-amber-200',
    purple:
      'border-purple-400/20 bg-purple-400/10 text-purple-200',
    cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
  }

  return (
    <Link
      href={activity.href}
      className="group relative flex gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4 transition hover:border-blue-400/30 hover:bg-slate-900/80"
    >
      <div
        className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border font-black ${tones[activity.tone]}`}
      >
        {activity.icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <p className="font-black text-white transition group-hover:text-blue-200">
            {activity.title}
          </p>

          <p className="shrink-0 text-xs font-bold text-slate-500">
            {formatRelativeTime(activity.createdAt, useLocale(), useTranslations('CompanyOperations'))}
          </p>
        </div>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
          {activity.description}
        </p>
      </div>
    </Link>
  )
}

function FunnelMetric({
  label,
  value,
  maximum,
}: {
  label: string
  value: number
  maximum: number
}) {
  const percentage = Math.min(
    100,
    Math.max(0, Math.round((value / maximum) * 100)),
  )

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-300">
          {label}
        </p>

        <p className="text-xl font-black text-white">{value}</p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function QuickAction({
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
  const t = useTranslations('CompanyOperations')

  return (
    <Link href={href} className="group block">
      <GlassCard padding="lg" hover className="h-full">
        <div className="flex h-full flex-col">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-400/10 text-lg font-black text-blue-200 transition group-hover:scale-105 group-hover:bg-blue-400/20">
            {icon}
          </div>

          <p className="mt-4 font-black text-white">{title}</p>

          <p className="mt-1 flex-1 text-xs font-semibold leading-5 text-slate-400">
            {description}
          </p>

          <span className="mt-4 text-xs font-black text-blue-300 transition group-hover:translate-x-1">
            {t('open')}
          </span>
        </div>
      </GlassCard>
    </Link>
  )
}

function OperationButton({
  href,
  children,
  emphasis = false,
}: {
  href: string
  children: ReactNode
  emphasis?: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl px-4 py-3 text-center text-sm font-black transition ${
        emphasis
          ? 'bg-blue-500 text-white hover:bg-blue-400'
          : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
      }`}
    >
      {children}
    </Link>
  )
}

function MiniMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 truncate font-black text-white">
        {value}
      </p>
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

function FirstJobState() {
  const t = useTranslations('CompanyOperations')

  return (
    <GlassCard padding="xl" accent>
      <div className="mx-auto max-w-2xl py-10 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-blue-400/20 bg-blue-400/10 text-4xl font-black text-blue-200">
          +
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-[0.25em] text-blue-300">
          {t('startOperation')}
        </p>

        <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
          {t('postFirstJob')}
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-300">
          {t('firstJobDescription')}
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <PrimaryButton href="/post-job">
            {t('postYourFirstJob')}
          </PrimaryButton>

          <SecondaryButton href="/workers">
            {t('browseWorkers')}
          </SecondaryButton>
        </div>
      </div>
    </GlassCard>
  )
}

function OperationsLoading() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <GlassCard padding="xl" accent>
          <div className="animate-pulse space-y-4">
            <div className="h-3 w-48 rounded-full bg-white/10" />
            <div className="h-12 w-full max-w-2xl rounded-2xl bg-white/10" />
            <div className="h-5 w-full max-w-3xl rounded-xl bg-white/10" />
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

        <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <GlassCard padding="xl">
            <div className="h-96 animate-pulse rounded-3xl bg-white/5" />
          </GlassCard>

          <GlassCard padding="xl">
            <div className="h-96 animate-pulse rounded-3xl bg-white/5" />
          </GlassCard>
        </section>
      </div>
    </main>
  )
}

function ApplicationBadge({
  status,
}: {
  status: string | null
}) {
  const t = useTranslations('CompanyOperations')
  const normalized = normalizeStatus(status)

  if (['hired', 'accepted'].includes(normalized)) {
    return (
      <StatusBadge tone="green" dot>
        {translatedStatus(normalized, t)}
      </StatusBadge>
    )
  }

  if (
    ['declined', 'not_selected', 'withdrawn'].includes(
      normalized,
    )
  ) {
    return (
      <StatusBadge tone="red">
        {translatedStatus(normalized, t)}
      </StatusBadge>
    )
  }

  return (
    <StatusBadge tone="amber" dot>
      {translatedStatus(normalized || 'pending', t)}
    </StatusBadge>
  )
}

function JobStatusBadge({
  status,
}: {
  status: string | null
}) {
  const t = useTranslations('CompanyOperations')
  const normalized = normalizeStatus(status)

  if (normalized === 'completed') {
    return (
      <StatusBadge tone="green" dot>
        {t('statusCompleted')}
      </StatusBadge>
    )
  }

  if (normalized === 'in_progress') {
    return (
      <StatusBadge tone="blue" dot pulse>
        {t('statusInProgress')}
      </StatusBadge>
    )
  }

  if (normalized === 'assigned') {
    return (
      <StatusBadge tone="purple" dot>
        {t('statusAssigned')}
      </StatusBadge>
    )
  }

  if (
    normalized === 'closed' ||
    normalized === 'cancelled'
  ) {
    return (
      <StatusBadge tone="slate">
        {translatedStatus(normalized, t)}
      </StatusBadge>
    )
  }

  return (
    <StatusBadge tone="blue" dot>
      {t('statusOpen')}
    </StatusBadge>
  )
}

function notificationTone(
  notification: Notification,
): ActivityItem['tone'] {
  const searchable = `${notification.title || ''} ${
    notification.body || ''
  }`.toLowerCase()

  if (
    searchable.includes('payment') ||
    searchable.includes('paid') ||
    searchable.includes('payout')
  ) {
    return 'green'
  }

  if (
    searchable.includes('urgent') ||
    searchable.includes('attention')
  ) {
    return 'amber'
  }

  if (
    searchable.includes('message') ||
    searchable.includes('conversation')
  ) {
    return 'cyan'
  }

  if (
    searchable.includes('hire') ||
    searchable.includes('invite') ||
    searchable.includes('accepted')
  ) {
    return 'purple'
  }

  return 'blue'
}

function getWorkerName(
  worker: WorkerProfile,
  t?: ReturnType<typeof useTranslations>
) {
  return (
    worker.full_name ||
    worker.company_name ||
    (t ? t('crewCallWorker') : 'CrewCall Worker')
  )
}

function getInitial(worker: WorkerProfile) {
  return getWorkerName(worker).charAt(0).toUpperCase()
}

function isActuallyOnline(worker: WorkerProfile) {
  if (!worker.is_online || !worker.last_seen) {
    return false
  }

  const timestamp = new Date(worker.last_seen).getTime()

  if (Number.isNaN(timestamp)) {
    return false
  }

  return Date.now() - timestamp < 90_000
}

function getGreeting(
  t: ReturnType<typeof useTranslations>
) {
  const hour = new Date().getHours()

  if (hour < 12) return t('goodMorning')
  if (hour < 17) return t('goodAfternoon')
  return t('goodEvening')
}

function normalizeStatus(value: string | null) {
  return value?.trim().toLowerCase() || ''
}

function translatedStatus(
  value: string,
  t: ReturnType<typeof useTranslations>
) {
  const map: Record<string, string> = {
    pending: t('statusPending'),
    hired: t('statusHired'),
    accepted: t('statusAccepted'),
    declined: t('statusDeclined'),
    not_selected: t('statusNotSelected'),
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

function formatDate(
  value: string | null,
  locale: string,
  t: ReturnType<typeof useTranslations>
) {
  if (!value) return t('dateNotSet')

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return t('dateNotSet')
  }

  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatShortDate(
  value: string,
  locale: string,
  t: ReturnType<typeof useTranslations>
) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return t('notSet')
  }

  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  })
}

function formatRelativeTime(
  value: string | null,
  locale: string,
  t: ReturnType<typeof useTranslations>
) {
  if (!value) return t('recently')

  const date = new Date(value)
  const timestamp = date.getTime()

  if (Number.isNaN(timestamp)) {
    return t('recently')
  }

  const difference = Date.now() - timestamp
  const seconds = Math.floor(difference / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return t('justNow')
  if (minutes < 60) return t('minutesAgo', { count: minutes })
  if (hours < 24) return t('hoursAgo', { count: hours })
  if (days < 7) return t('daysAgo', { count: days })

  return formatDate(value, locale, t)
}

function isSameLocalDay(value: string, comparisonDate: Date) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return false
  }

  return (
    date.getFullYear() === comparisonDate.getFullYear() &&
    date.getMonth() === comparisonDate.getMonth() &&
    date.getDate() === comparisonDate.getDate()
  )
}

function formatTime(
  value: string | null,
  locale: string,
  t: ReturnType<typeof useTranslations>
) {
  if (!value) return t('timeNotSet')

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return t('timeNotSet')
  }

  return date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getDirectionsHref(location: string | null) {
  const trimmedLocation = location?.trim()

  if (!trimmedLocation) {
    return null
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    trimmedLocation,
  )}`
}

function toTimestamp(value: string | null) {
  if (!value) {
    return Number.MAX_SAFE_INTEGER
  }

  const timestamp = new Date(value).getTime()

  return Number.isNaN(timestamp)
    ? Number.MAX_SAFE_INTEGER
    : timestamp
}
