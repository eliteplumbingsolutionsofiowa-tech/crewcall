'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { crewCallAuthedFetch } from '@/lib/authed-fetch'
import { resolveCompanyContext } from '@/lib/company-context'
import { formatMoney } from '@/lib/formatMoney'

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  status: string | null
  company_id: string
  assigned_worker_id: string | null
  assigned_application_id: string | null
  payment_status: string | null
  payout_status: string | null
  pay_rate: string | null
}

type WorkerProfile = {
  id: string
  full_name: string | null
  company_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  years_experience: string | null
  insurance_provider: string | null
  liability_form_signed: boolean | null
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean | null
}

type RecommendedWorker = {
  worker_id: string
  match_score: number
  reason: string | null
  trade_score: number | null
  location_score: number | null
  availability_score: number | null
  certification_score: number | null
  pay_score: number | null
  worker: WorkerProfile | null
}

type Applicant = {
  id: string
  job_id: string
  worker_id: string
  status: string | null
  created_at: string
  requested_pay: string | null
  requested_pay_rate: string | null
  company_counter_offer: string | null
  negotiation_message: string | null
  negotiation_status: string | null
  worker: WorkerProfile | null
}

type RawApplicant = Omit<Applicant, 'worker'> & {
  worker: WorkerProfile | WorkerProfile[] | null
}

type ProfileFile = {
  id: string
  user_id: string
  category: string | null
  file_url: string | null
  created_at: string
}

type ConversationRow = {
  id: string
}

type JobUpdate = {
  assigned_worker_id?: string
  assigned_application_id?: string
  status?: string
  payment_status?: string
  payout_status?: string
  pay_rate?: string | null
}

type ApplicationUpdate = {
  status: string
}

type NotificationInsert = {
  user_id: string
  title: string
  body: string
  link_url: string
  read: boolean
  is_read: boolean
}

type ConversationInsert = {
  job_id: string
  company_id: string
  worker_id: string
}

type QueryError = {
  message: string
}

type MaybeSingleQuery<T> = {
  maybeSingle: () => Promise<{ data: T | null; error: QueryError | null }>
}

type SingleQuery<T> = {
  single: () => Promise<{ data: T | null; error: QueryError | null }>
}

type SelectIdQuery<T> = {
  select: (columns: string) => SingleQuery<T>
}

type EqMaybeQuery<T> = {
  eq: (column: string, value: string) => MaybeSingleQuery<T>
}

type EqOrderQuery<T> = {
  order: (
    column: string,
    options?: { ascending?: boolean }
  ) => Promise<{ data: T[] | null; error: QueryError | null }>
}

type EqFilterQuery<T> = {
  eq: (column: string, value: string) => EqOrderQuery<T>
}

type InEqOrderQuery<T> = {
  order: (
    column: string,
    options?: { ascending?: boolean }
  ) => Promise<{ data: T[] | null; error: QueryError | null }>
}

type InEqQuery<T> = {
  eq: (column: string, value: string) => InEqOrderQuery<T>
}

type InQuery<T> = {
  in: (column: string, values: string[]) => InEqQuery<T>
}

type SelectMaybeTable<T> = {
  select: (columns: string) => EqMaybeQuery<T>
}

type SelectOrderTable<T> = {
  select: (columns: string) => EqFilterQuery<T>
}

type SelectInTable<T> = {
  select: (columns: string) => InQuery<T>
}

type UpdateEqQuery = {
  eq: (
    column: string,
    value: string
  ) => Promise<{ data: null; error: QueryError | null }>
}

type UpdateEqNeqQuery = {
  neq: (
    column: string,
    value: string
  ) => Promise<{ data: null; error: QueryError | null }>
}

type UpdateEqThenNeqQuery = {
  eq: (column: string, value: string) => UpdateEqNeqQuery
}

type UpdateTable<TUpdate> = {
  update: (value: TUpdate) => UpdateEqQuery
}

type UpdateTableWithNeq<TUpdate> = {
  update: (value: TUpdate) => UpdateEqThenNeqQuery
}

type InsertTable<TInsert> = {
  insert: (
    value: TInsert
  ) => Promise<{ data: null; error: QueryError | null }>
}

type InsertSelectTable<TInsert, TReturn> = {
  insert: (value: TInsert) => SelectIdQuery<TReturn>
}

type ConversationSelectChain<T> = {
  eq: (column: string, value: string) => ConversationSelectChain<T>
  maybeSingle: () => Promise<{ data: T | null; error: QueryError | null }>
}

type ConversationSelectTable<T> = {
  select: (columns: string) => ConversationSelectChain<T>
}

function jobsSelectTable() {
  return supabase.from('jobs') as unknown as SelectMaybeTable<Job>
}

function jobsUpdateTable() {
  return supabase.from('jobs') as unknown as UpdateTable<JobUpdate>
}

function applicationsSelectTable() {
  return supabase.from('applications') as unknown as SelectOrderTable<RawApplicant>
}

function applicationsUpdateTable() {
  return supabase.from('applications') as unknown as UpdateTable<ApplicationUpdate>
}

function applicationsUpdateWithNeqTable() {
  return supabase
    .from('applications') as unknown as UpdateTableWithNeq<ApplicationUpdate>
}

function profileFilesTable() {
  return supabase.from('profile_files') as unknown as SelectInTable<ProfileFile>
}

function notificationsTable() {
  return supabase.from('notifications') as unknown as InsertTable<NotificationInsert>
}

function conversationsSelectTable() {
  return supabase
    .from('conversations') as unknown as ConversationSelectTable<ConversationRow>
}

function conversationsInsertTable() {
  return supabase
    .from('conversations') as unknown as InsertSelectTable<
      ConversationInsert,
      ConversationRow
    >
}

function firstOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function cleanStatus(value: string) {
  return value.replaceAll('_', ' ')
}

export default function ApplicantsPage() {
  const params = useParams()
  const jobId = String(params?.id || '')

  const [job, setJob] = useState<Job | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [profileFiles, setProfileFiles] = useState<ProfileFile[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [matchByWorkerId, setMatchByWorkerId] = useState<Record<string, any>>({})
  const [recommendedWorkers, setRecommendedWorkers] =
    useState<RecommendedWorker[]>([])
  const [showComparison, setShowComparison] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')

  const [counterOffers, setCounterOffers] = useState<Record<string, string>>({})
  const [counterMessages, setCounterMessages] = useState<Record<string, string>>({})
  const [workingId, setWorkingId] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) return

    loadApplicants()

    const refresh = async () => {
      await loadApplicants()
      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    }

    const channel = supabase
      .channel(`applicants-live-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
          filter: `job_id=eq.${jobId}`,
        },
        refresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`,
        },
        refresh
      )
      .subscribe()

    window.addEventListener('focus', refresh)

    return () => {
      window.removeEventListener('focus', refresh)
      supabase.removeChannel(channel)
    }
  }, [jobId])

  const photoByUserId = useMemo(() => {
    const map = new Map<string, string>()

    profileFiles.forEach((file) => {
      if (
        file.user_id &&
        file.category === 'profile_photo' &&
        file.file_url &&
        !map.has(file.user_id)
      ) {
        map.set(file.user_id, file.file_url)
      }
    })

    return map
  }, [profileFiles])

  const sortedApplicants = useMemo(() => {
    return [...applicants].sort((a, b) => {
      const aAssigned =
        a.worker_id === job?.assigned_worker_id ||
        a.id === job?.assigned_application_id ||
        a.status === 'accepted' ||
        a.status === 'hired'

      const bAssigned =
        b.worker_id === job?.assigned_worker_id ||
        b.id === job?.assigned_application_id ||
        b.status === 'accepted' ||
        b.status === 'hired'

      if (aAssigned && !bAssigned) return -1
      if (!aAssigned && bAssigned) return 1

      const aScore =
        matchByWorkerId[a.worker_id]?.match_score || 0

      const bScore =
        matchByWorkerId[b.worker_id]?.match_score || 0

      if (aScore !== bScore) {
        return bScore - aScore
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [
    applicants,
    matchByWorkerId,
    job?.assigned_application_id,
    job?.assigned_worker_id,
  ])

  const assignedApplicant = sortedApplicants.find(
    (applicant) =>
      applicant.worker_id === job?.assigned_worker_id ||
      applicant.id === job?.assigned_application_id ||
      applicant.status === 'accepted' ||
      applicant.status === 'hired'
  )

  async function loadApplicants() {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to view applicants.')
      setLoading(false)
      return
    }

    const { data: jobData, error: jobError } = await jobsSelectTable()
      .select(
        `
        id,
        title,
        trade,
        location,
        pay_rate,
        status,
        company_id,
        assigned_worker_id,
        assigned_application_id,
        payment_status,
        payout_status
      `
      )
      .eq('id', jobId)
      .maybeSingle()

    if (jobError) {
      setMessage(jobError.message)
      setLoading(false)
      return
    }

    if (!jobData) {
      setMessage('Job not found.')
      setLoading(false)
      return
    }

    const companyContext =
      await resolveCompanyContext(
        supabase,
        user.id
      )

    if (
      !companyContext.companyId ||
      jobData.company_id !==
        companyContext.companyId
    ) {
      setMessage(
        'You do not have permission to view applicants for this job.'
      )
      setLoading(false)
      return
    }

    setJob(jobData)

    const { data: applicationData, error: applicationError } =
      await applicationsSelectTable()
        .select(
          `
          id,
          job_id,
          worker_id,
          status,
          created_at,
          requested_pay,
          requested_pay_rate,
          company_counter_offer,
          negotiation_message,
          negotiation_status,
          worker:profiles!applications_worker_id_fkey (
            id,
            full_name,
            company_name,
            trade,
            city,
            state,
            years_experience,
            insurance_provider,
            liability_form_signed,
            stripe_account_id,
            stripe_onboarding_complete
          )
        `
        )
        .eq('job_id', jobId)
        .order('created_at', {
          ascending: false,
        })

    console.log("NEGOTIATION DEBUG", applicationData)

    if (applicationError) {
      setMessage(applicationError.message)
      setApplicants([])
      setProfileFiles([])
      setLoading(false)
      return
    }

    const safeApplicants: Applicant[] = (applicationData || []).map(
      (application) => ({
        ...application,
        requested_pay: application.requested_pay || null,
        worker: firstOrNull(application.worker),
      })
    )

    setApplicants(safeApplicants)

    let resolvedMatches: any[] = []

    const { data: matchData } = await supabase
      .from('job_matches')
      .select(
        'worker_id, match_score, reason, trade_score, location_score, availability_score, certification_score, pay_score'
      )
      .eq('job_id', jobId)

    if (matchData && matchData.length > 0) {
      resolvedMatches = matchData

      setMatchByWorkerId(
        Object.fromEntries(
          matchData.map((match) => [
            match.worker_id,
            match,
          ])
        )
      )
    } else {
      try {
        const response = await crewCallAuthedFetch(
          '/api/jobs/match',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jobId,
            }),
          }
        )

        if (response.ok) {
          const { data: refreshedMatches } = await supabase
            .from('job_matches')
            .select(
              'worker_id, match_score, reason, trade_score, location_score, availability_score, certification_score, pay_score'
            )
            .eq('job_id', jobId)

          resolvedMatches = refreshedMatches || []

          setMatchByWorkerId(
            Object.fromEntries(
              resolvedMatches.map((match) => [
                match.worker_id,
                match,
              ])
            )
          )
        }
      } catch (error) {
        console.warn(
          'Unable to automatically refresh worker matches:',
          error
        )
      }
    }

    const matchedWorkerIds = Array.from(
      new Set(
        resolvedMatches
          .map((match) => match.worker_id)
          .filter(Boolean)
      )
    )

    let matchedProfiles: WorkerProfile[] = []

    if (matchedWorkerIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select(
          `
          id,
          full_name,
          company_name,
          trade,
          city,
          state,
          years_experience,
          insurance_provider,
          liability_form_signed,
          stripe_account_id,
          stripe_onboarding_complete
          `
        )
        .in('id', matchedWorkerIds)

      matchedProfiles =
        (profileData || []) as WorkerProfile[]
    }

    const matchedProfileMap =
      new Map(
        matchedProfiles.map((worker) => [
          worker.id,
          worker,
        ])
      )

    const applicantWorkerIds =
      new Set(
        safeApplicants.map(
          (applicant) =>
            applicant.worker_id
        )
      )

    const recommended =
      resolvedMatches
        .filter(
          (match) =>
            !applicantWorkerIds.has(
              match.worker_id
            )
        )
        .sort(
          (a, b) =>
            Number(b.match_score || 0) -
            Number(a.match_score || 0)
        )
        .slice(0, 10)
        .map((match) => ({
          ...match,
          worker:
            matchedProfileMap.get(
              match.worker_id
            ) || null,
        })) as RecommendedWorker[]

    setRecommendedWorkers(recommended)

    const workerIds = Array.from(
      new Set([
        ...safeApplicants
          .map((applicant) => applicant.worker_id)
          .filter((workerId): workerId is string => Boolean(workerId)),
        ...recommended
          .map((match) => match.worker_id)
          .filter((workerId): workerId is string => Boolean(workerId)),
      ])
    )

    if (workerIds.length > 0) {
      const { data: files } = await profileFilesTable()
        .select(
          `
          id,
          user_id,
          category,
          file_url,
          created_at
        `
        )
        .in('user_id', workerIds)
        .eq('category', 'profile_photo')
        .order('created_at', {
          ascending: false,
        })

      setProfileFiles(files || [])
    } else {
      setProfileFiles([])
    }

    setLoading(false)
  }

  async function sendCompanyCounter(applicant: Applicant) {
    setWorkingId(applicant.id)

    try {
      const counter =
        counterOffers[applicant.id]

      if (!counter) {
        setMessage('Enter a counter offer amount first.')
        return
      }

      const { error } = await supabase
        .from('applications')
        .update({
          company_counter_offer: counter,
          negotiation_message:
            counterMessages[applicant.id] || null,
          negotiation_status: 'open',
        })
        .eq('id', applicant.id)

      if (error) {
        throw error
      }

      setMessage('Counter offer sent to worker.')

      await loadApplicants()

    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to send counter offer.'
      )
    } finally {
      setWorkingId(null)
    }
  }

  async function acceptWorkerOffer(applicant: Applicant) {
    const workerOffer =
      applicant.requested_pay_rate ||
      applicant.requested_pay

    if (!workerOffer) {
      setMessage('This worker did not submit a pay request.')
      return
    }

    const confirmed = window.confirm(
      `Accept ${getWorkerName(applicant)}'s requested rate of ${workerOffer}?`
    )

    if (!confirmed) return

    setWorkingId(`accept-${applicant.id}`)
    setMessage('')

    try {
      const { error } = await supabase
        .from('applications')
        .update({
          company_counter_offer: workerOffer,
          negotiation_status: 'accepted',
          negotiation_message:
            'Company accepted the worker requested rate.',
        })
        .eq('id', applicant.id)

      if (error) {
        throw error
      }

      setMessage(
        `Worker offer accepted at ${workerOffer}. You can now hire the worker.`
      )

      await loadApplicants()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to accept the worker offer.'
      )
    } finally {
      setWorkingId(null)
    }
  }

  async function hireApplicant(applicant: Applicant) {
    if (!job) return

    const workerSubmittedOffer = Boolean(
      applicant.requested_pay_rate ||
      applicant.requested_pay ||
      applicant.company_counter_offer
    )

    if (
      workerSubmittedOffer &&
      applicant.negotiation_status !== 'accepted'
    ) {
      setMessage(
        'Accept the worker offer or complete the negotiation before hiring.'
      )

      document
        .getElementById(`negotiation-${applicant.id}`)
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })

      return
    }

    if (job.assigned_worker_id || job.assigned_application_id) {
      setMessage('This job already has an assigned worker.')
      return
    }

    const confirmed = window.confirm(
      `Hire ${getWorkerName(applicant)}?`
    )

    if (!confirmed) return

    setActionLoadingId(applicant.id)
    setMessage('')

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        throw new Error(
          sessionError?.message || 'You must be logged in to hire a worker.'
        )
      }

      const response = await fetch('/api/jobs/hire', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          jobId: job.id,
          workerId: applicant.worker_id,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result?.error || 'Unable to hire worker.'
        )
      }

      setMessage(
        result?.message || 'Worker hired successfully.'
      )

      await loadApplicants()

      window.dispatchEvent(
        new Event('crewcall-refresh-nav')
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to hire worker.'
      )
    } finally {
      setActionLoadingId(null)
    }
  }

  async function declineApplicant(applicant: Applicant) {
    const confirmed = window.confirm(`Decline ${getWorkerName(applicant)}?`)

    if (!confirmed) return

    setActionLoadingId(`decline-${applicant.id}`)
    setMessage('')

    const { error } = await applicationsUpdateTable()
      .update({
        status: 'rejected',
      })
      .eq('id', applicant.id)

    if (error) {
      setMessage(error.message)
      setActionLoadingId(null)
      return
    }

    setMessage('Applicant declined.')

    await loadApplicants()

    window.dispatchEvent(new Event('crewcall-refresh-nav'))

    setActionLoadingId(null)
  }

  async function updateJobStatus(nextStatus: string) {
    if (!job) return

    setActionLoadingId(nextStatus)
    setMessage('')

    try {
      if (nextStatus === 'completed') {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session?.access_token) {
          throw new Error(
            sessionError?.message ||
              'You must be logged in to complete this job.'
          )
        }

        const response = await fetch('/api/jobs/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            jobId: job.id,
            companyId: job.company_id,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(
            result?.error || 'Unable to complete job.'
          )
        }

        setMessage(
          result?.message || 'Job marked completed.'
        )
      } else {
        const { error } = await jobsUpdateTable()
          .update({
            status: nextStatus,
          })
          .eq('id', job.id)

        if (error) {
          throw error
        }

        setMessage(`Job marked ${cleanStatus(nextStatus)}.`)
      }

      await loadApplicants()

      window.dispatchEvent(
        new Event('crewcall-refresh-nav')
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update job status.'
      )
    } finally {
      setActionLoadingId(null)
    }
  }

  async function messageWorker(workerId: string) {
    if (!job) return

    setActionLoadingId(workerId)
    setMessage('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('You must be logged in.')
      setActionLoadingId(null)
      return
    }

    const { data: existingConversation } = await conversationsSelectTable()
      .select('id')
      .eq('job_id', job.id)
      .eq('company_id', user.id)
      .eq('worker_id', workerId)
      .maybeSingle()

    if (existingConversation?.id) {
      window.location.href = `/messages/${existingConversation.id}`
      return
    }

    const { data: newConversation, error } = await conversationsInsertTable()
      .insert({
        job_id: job.id,
        company_id: user.id,
        worker_id: workerId,
      })
      .select('id')
      .single()

    if (error || !newConversation?.id) {
      setMessage(error?.message || 'Could not create conversation.')
      setActionLoadingId(null)
      return
    }

    window.location.href = `/messages/${newConversation.id}`
  }

  async function inviteRecommendedWorker(
    workerId: string
  ) {
    if (!job?.id) return false

    setActionLoadingId(
      `invite-${workerId}`
    )

    try {
      const response =
        await crewCallAuthedFetch(
          `/api/jobs/${job.id}/invite`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              workerId,
            }),
          }
        )

      const result =
        await response
          .json()
          .catch(() => null)

      if (!response.ok) {
        throw new Error(
          result?.error ||
            'Unable to invite worker.'
        )
      }

      setInviteMessage(
        'Worker invited successfully.'
      )

      window.dispatchEvent(
        new Event(
          'crewcall-refresh-nav'
        )
      )

      return true
    } catch (error) {
      setInviteMessage(
        error instanceof Error
          ? error.message
          : 'Unable to invite worker.'
      )

      return false
    } finally {
      setActionLoadingId(null)
    }
  }

  async function inviteTopMatches() {
    if (!job?.id) return

    setInviteLoading(true)
    setInviteMessage('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Authentication required.')
      }

      const matchResponse = await crewCallAuthedFetch('/api/jobs/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: job.id,
        }),
      })

      const matchResult = await matchResponse.json()

      if (!matchResponse.ok) {
        throw new Error(
          matchResult?.error || 'Unable to run AI matching.'
        )
      }

      await loadApplicants()

      const topWorkers =
        recommendedWorkers
          .slice(0, 3)
          .map(
            (match) =>
              match.worker_id
          )

      let invited = 0

      for (const workerId of topWorkers) {
        const response = await fetch(
          `/api/jobs/${job.id}/invite`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              workerId,
            }),
          }
        )

        if (response.ok) {
          invited++
        }
      }

      setInviteMessage(
        `✅ AI updated ${matchResult.matchesCreated || 0} matches and invited ${invited} worker${invited === 1 ? '' : 's'}`
      )

      window.dispatchEvent(
        new Event('crewcall-refresh-nav')
      )

    } catch (error) {
      setInviteMessage(
        error instanceof Error
          ? error.message
          : 'Unable to send invites.'
      )
    } finally {
      setInviteLoading(false)
    }
  }

  function getWorkerName(applicant: Applicant) {
    return (
      applicant.worker?.full_name ||
      applicant.worker?.company_name ||
      'Worker Profile'
    )
  }

  function getWorkerPhoto(workerId: string) {
    return photoByUserId.get(workerId) || null
  }

  const normalizedStatus =
    String(job?.status || '').toLowerCase()

  const normalizedPaymentStatus =
    String(job?.payment_status || '').toLowerCase()

  const normalizedPayoutStatus =
    String(job?.payout_status || '').toLowerCase()

  const canPayWorker =
    Boolean(job?.assigned_worker_id) &&
    normalizedPaymentStatus !== 'paid'

  const canReleasePayout =
    normalizedStatus === 'completed' &&
    normalizedPaymentStatus === 'paid' &&
    normalizedPayoutStatus !== 'released'

  const topRecommendedApplicant =
    sortedApplicants.find(
      (applicant) => matchByWorkerId[applicant.worker_id]
    ) || sortedApplicants[0] || null

  const topRecommendedMatch = topRecommendedApplicant
    ? matchByWorkerId[topRecommendedApplicant.worker_id]
    : null

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
            <div className="h-3 w-32 animate-pulse rounded-full bg-cyan-300/20" />
            <div className="mt-5 h-10 w-80 max-w-full animate-pulse rounded-2xl bg-white/10" />
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-40 animate-pulse rounded-3xl bg-white/5"
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <Link
                href="/my-jobs"
                className="text-sm font-black text-cyan-300 transition hover:text-cyan-200"
              >
                ← Back to My Jobs
              </Link>

              <p className="mt-5 text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                Hiring Workspace
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                {job?.title || 'Manage Applicants'}
              </h1>

              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-300 md:text-base">
                Review each applicant, negotiate pay, message workers, and hire
                the best fit without leaving this job.
              </p>
            </div>

            {job && (
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/jobs/${job.id}`}
                  className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                >
                  View Job
                </Link>

                <button
                  type="button"
                  onClick={async () => {
                    if (!job?.id) return

                    setInviteLoading(true)
                    setInviteMessage('')

                    try {
                      const response = await crewCallAuthedFetch('/api/jobs/match', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          jobId: job.id,
                        }),
                      })

                      if (!response.ok) {
                        const result = await response.json()
                        throw new Error(
                          result?.error || 'Unable to run AI matching.'
                        )
                      }

                      await loadApplicants()
                      setShowComparison(true)
                    } catch (error) {
                      setInviteMessage(
                        error instanceof Error
                          ? error.message
                          : 'Unable to run AI matching.'
                      )
                    } finally {
                      setInviteLoading(false)
                    }
                  }}
                  disabled={inviteLoading}
                  className="rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-black text-slate-950 shadow-xl transition hover:scale-[1.02] disabled:opacity-60"
                >
                  {inviteLoading ? 'Running AI...' : 'Run AI Match'}
                </button>

                {canPayWorker && (
                  <Link
                    href={`/jobs/${job.id}/pay`}
                    className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-black text-white transition hover:bg-green-500"
                  >
                    Pay Worker
                  </Link>
                )}

                {canReleasePayout && (
                  <Link
                    href={`/jobs/${job.id}/release-payout`}
                    className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-500"
                  >
                    Release Payout
                  </Link>
                )}
              </div>
            )}
          </div>
        </header>

        {message && (
          <div className="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 px-5 py-4 text-sm font-bold text-cyan-50 shadow-xl">
            {message}
          </div>
        )}

        {inviteMessage && (
          <div className="rounded-3xl border border-purple-300/20 bg-purple-400/10 px-5 py-4 text-sm font-bold text-purple-50 shadow-xl">
            {inviteMessage}
          </div>
        )}

        {job && (
          <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/70 shadow-2xl">
            <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 p-6 md:p-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusPill value={job.status || 'open'} />
                    <StatusPill value={job.payment_status || 'unpaid'} />
                    <StatusPill value={job.payout_status || 'not_released'} />
                  </div>

                  <h2 className="mt-5 text-3xl font-black text-white">
                    {job.title || 'Untitled Job'}
                  </h2>

                  <p className="mt-2 text-sm font-semibold text-slate-300">
                    {[job.trade, job.location].filter(Boolean).join(' • ') ||
                      'No trade or location listed'}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <JobMetric
                      label="Pay"
                      value={formatMoney(job.pay_rate)}
                    />
                    <JobMetric
                      label="Applicants"
                      value={String(sortedApplicants.length)}
                    />
                    <JobMetric
                      label="Status"
                      value={cleanStatus(job.status || 'open')}
                    />
                    <JobMetric
                      label="Payment"
                      value={cleanStatus(job.payment_status || 'unpaid')}
                    />
                  </div>
                </div>

                {assignedApplicant && (
                  <div className="w-full rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-5 xl:max-w-sm">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">
                      Assigned Worker
                    </p>

                    <p className="mt-3 text-2xl font-black text-white">
                      {getWorkerName(assignedApplicant)}
                    </p>

                    <p className="mt-2 text-sm font-semibold text-emerald-100/80">
                      Agreed pay:{' '}
                      {formatMoney(
                        assignedApplicant.company_counter_offer ||
                          assignedApplicant.requested_pay_rate ||
                          assignedApplicant.requested_pay ||
                          job.pay_rate
                      )}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <LifecycleButton
                        label="Mark In Progress"
                        disabled={
                          actionLoadingId === 'in_progress' ||
                          job.status === 'in_progress' ||
                          job.status === 'completed'
                        }
                        onClick={() => updateJobStatus('in_progress')}
                      />

                      <LifecycleButton
                        label="Mark Complete"
                        disabled={
                          actionLoadingId === 'completed' ||
                          job.status === 'completed'
                        }
                        onClick={() => updateJobStatus('completed')}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 p-5 md:p-7">
              {topRecommendedApplicant && topRecommendedMatch && (
                <div className="mb-6 rounded-3xl border border-cyan-300/20 bg-gradient-to-r from-cyan-400/10 to-blue-500/10 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                        CrewCall AI Pick
                      </p>

                      <h3 className="mt-2 text-2xl font-black text-white">
                        {getWorkerName(topRecommendedApplicant)}
                      </h3>

                      <p className="mt-2 max-w-3xl text-sm font-semibold text-cyan-100">
                        {topRecommendedMatch.reason ||
                          'Strong overall match for this job.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-cyan-300/15 px-5 py-3 text-center">
                        <p className="text-xs font-black uppercase text-cyan-200">
                          Match
                        </p>
                        <p className="text-3xl font-black text-white">
                          {topRecommendedMatch.match_score || 0}%
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowComparison((current) => !current)}
                        className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                      >
                        {showComparison ? 'Hide Comparison' : 'Compare'}
                      </button>
                    </div>
                  </div>

                  {showComparison && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                      <MatchMetric
                        label="Trade"
                        value={topRecommendedMatch.trade_score}
                      />
                      <MatchMetric
                        label="Location"
                        value={topRecommendedMatch.location_score}
                      />
                      <MatchMetric
                        label="Availability"
                        value={topRecommendedMatch.availability_score}
                      />
                      <MatchMetric
                        label="Credentials"
                        value={topRecommendedMatch.certification_score}
                      />
                      <MatchMetric
                        label="Pay Fit"
                        value={topRecommendedMatch.pay_score}
                      />
                      <MatchMetric
                        label="Experience"
                        value={topRecommendedMatch.experience_score}
                      />
                    </div>
                  )}
                </div>
              )}

              <section className="mb-8 rounded-[1.75rem] border border-cyan-300/20 bg-cyan-400/[0.045] p-5 md:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                      CrewCall AI
                    </p>

                    <h3 className="mt-2 text-2xl font-black text-white">
                      AI Recommended Workers
                    </h3>

                    <p className="mt-2 text-sm font-semibold text-slate-400">
                      Workers matched to this job before they apply.
                    </p>
                  </div>

                  {recommendedWorkers.length > 0 && (
                    <button
                      type="button"
                      onClick={inviteTopMatches}
                      disabled={inviteLoading}
                      className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
                    >
                      {inviteLoading
                        ? 'Inviting...'
                        : 'Invite Top 3'}
                    </button>
                  )}
                </div>

                {recommendedWorkers.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-7 text-center">
                    <p className="font-black text-white">
                      No AI recommendations yet
                    </p>

                    <p className="mt-2 text-sm text-slate-400">
                      Run AI Match to find and rank available workers.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {recommendedWorkers.map(
                      (match, index) => {
                        const worker =
                          match.worker

                        const name =
                          worker?.full_name ||
                          worker?.company_name ||
                          'CrewCall Worker'

                        const photo =
                          getWorkerPhoto(
                            match.worker_id
                          )

                        return (
                          <article
                            key={
                              match.worker_id
                            }
                            className="rounded-3xl border border-white/10 bg-slate-950/40 p-5"
                          >
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                              <div className="flex min-w-0 items-center gap-4">
                                <Link
                                  href={`/profile?user=${match.worker_id}`}
                                  className="shrink-0"
                                >
                                  {photo ? (
                                    <img
                                      src={photo}
                                      alt={name}
                                      className="h-20 w-20 rounded-2xl border border-white/10 object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-3xl font-black text-slate-950">
                                      {name.charAt(
                                        0
                                      )}
                                    </div>
                                  )}
                                </Link>

                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-black text-cyan-100">
                                      #
                                      {index +
                                        1}
                                    </span>

                                    <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black text-emerald-200">
                                      {Math.round(
                                        Number(
                                          match.match_score ||
                                            0
                                        )
                                      )}
                                      % MATCH
                                    </span>
                                  </div>

                                  <Link
                                    href={`/profile?user=${match.worker_id}`}
                                  >
                                    <h4 className="mt-2 truncate text-2xl font-black text-white hover:text-cyan-200">
                                      {name}
                                    </h4>
                                  </Link>

                                  <p className="mt-1 text-sm font-semibold text-slate-400">
                                    {[
                                      worker?.trade,
                                      [worker?.city, worker?.state]
                                        .filter(Boolean)
                                        .join(', '),
                                    ]
                                      .filter(Boolean)
                                      .join(' • ') ||
                                      'Available CrewCall worker'}
                                  </p>

                                  {match.reason && (
                                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                                      {
                                        match.reason
                                      }
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-wrap gap-3">
                                <Link
                                  href={`/profile?user=${match.worker_id}`}
                                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20"
                                >
                                  View Profile
                                </Link>

                                <button
                                  type="button"
                                  onClick={() =>
                                    inviteRecommendedWorker(
                                      match.worker_id
                                    )
                                  }
                                  disabled={
                                    actionLoadingId ===
                                    `invite-${match.worker_id}`
                                  }
                                  className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
                                >
                                  {actionLoadingId ===
                                  `invite-${match.worker_id}`
                                    ? 'Inviting...'
                                    : 'Invite Worker'}
                                </button>
                              </div>
                            </div>
                          </article>
                        )
                      }
                    )}
                  </div>
                )}
              </section>

              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                    Applicants
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-white">
                    {sortedApplicants.length}{' '}
                    {sortedApplicants.length === 1 ? 'candidate' : 'candidates'}
                  </h3>
                </div>

              </div>

              {sortedApplicants.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
                  <h3 className="text-2xl font-black text-white">
                    No applicants yet
                  </h3>
                  <p className="mt-3 text-sm font-semibold text-slate-400">
                    New applicants will appear inside this job workspace.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {sortedApplicants.map((applicant, index) => {
                    const worker = applicant.worker
                    const aiMatch = matchByWorkerId[applicant.worker_id]
                    const workerName = getWorkerName(applicant)
                    const workerPhoto = getWorkerPhoto(applicant.worker_id)

                    const payoutReady = Boolean(
                      worker?.stripe_account_id &&
                        worker?.stripe_onboarding_complete
                    )

                    const isAssigned =
                      job.assigned_worker_id === applicant.worker_id ||
                      job.assigned_application_id === applicant.id ||
                      applicant.status === 'accepted' ||
                      applicant.status === 'hired'

                    const jobAlreadyAssigned = Boolean(
                      job.assigned_worker_id ||
                        job.assigned_application_id
                    )

                    const isRejected =
                      applicant.status === 'rejected' ||
                      applicant.status === 'declined'

                    const workerOffer =
                      applicant.requested_pay_rate ||
                      applicant.requested_pay

                    const agreedRate =
                      applicant.negotiation_status === 'accepted'
                        ? applicant.company_counter_offer || workerOffer
                        : null

                    return (
                      <article
                        key={applicant.id}
                        className={`overflow-hidden rounded-[1.75rem] border shadow-xl transition ${
                          isAssigned
                            ? 'border-emerald-300/30 bg-emerald-400/[0.07]'
                            : isRejected
                              ? 'border-red-300/15 bg-red-400/[0.04] opacity-75'
                              : 'border-white/10 bg-white/[0.045] hover:border-cyan-300/25'
                        }`}
                      >
                        <div className="p-5 md:p-6">
                          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                            <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row">
                              <Link
                                href={`/profile?user=${applicant.worker_id}`}
                                className="shrink-0"
                              >
                                {workerPhoto ? (
                                  <img
                                    src={workerPhoto}
                                    alt={workerName}
                                    className="h-24 w-24 rounded-3xl border border-white/10 object-cover shadow-xl"
                                  />
                                ) : (
                                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 text-4xl font-black text-white shadow-xl">
                                    {workerName.charAt(0)}
                                  </div>
                                )}
                              </Link>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-300">
                                    #{index + 1}
                                  </span>

                                  {aiMatch && index === 0 && (
                                    <span className="rounded-full bg-cyan-400/20 px-3 py-1 text-xs font-black text-cyan-100">
                                      AI PICK
                                    </span>
                                  )}

                                  <StatusPill
                                    value={applicant.status || 'pending'}
                                  />

                                  {isAssigned && (
                                    <StatusPill value="assigned" />
                                  )}
                                </div>

                                <Link
                                  href={`/profile?user=${applicant.worker_id}`}
                                  className="mt-3 block"
                                >
                                  <h4 className="truncate text-3xl font-black text-white transition hover:text-cyan-200">
                                    {workerName}
                                  </h4>
                                </Link>

                                <p className="mt-2 text-sm font-semibold text-slate-300">
                                  {[worker?.trade, worker?.city, worker?.state]
                                    .filter(Boolean)
                                    .join(' • ') || 'Profile incomplete'}
                                </p>

                                <div className="mt-4 flex flex-wrap gap-2">
                                  {worker?.years_experience && (
                                    <WorkerBadge>
                                      {worker.years_experience} years
                                    </WorkerBadge>
                                  )}

                                  {worker?.insurance_provider && (
                                    <WorkerBadge>✓ Insured</WorkerBadge>
                                  )}

                                  {worker?.liability_form_signed && (
                                    <WorkerBadge>
                                      ✓ Liability complete
                                    </WorkerBadge>
                                  )}

                                  {payoutReady ? (
                                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-200">
                                      ✓ Payout Ready
                                    </span>
                                  ) : (
                                    <span className="rounded-full border border-orange-400/30 bg-orange-500/15 px-3 py-1 text-xs font-black text-orange-200">
                                      ⚠ Payout Setup Required
                                    </span>
                                  )}

                                  {aiMatch && (
                                    <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-black text-cyan-100">
                                      {aiMatch.match_score || 0}% match
                                    </span>
                                  )}
                                </div>

                                <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                                  Applied{' '}
                                  {new Date(
                                    applicant.created_at
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-wrap gap-3 xl:w-[240px] xl:flex-col">
                              <Link
                                href={`/profile?user=${applicant.worker_id}`}
                                className="flex-1 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-white/20"
                              >
                                View Profile
                              </Link>

                              <button
                                type="button"
                                onClick={() =>
                                  messageWorker(applicant.worker_id)
                                }
                                disabled={
                                  actionLoadingId === applicant.worker_id
                                }
                                className="flex-1 rounded-2xl bg-blue-500 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-400 disabled:opacity-60"
                              >
                                {actionLoadingId === applicant.worker_id
                                  ? 'Opening...'
                                  : 'Message'}
                              </button>

                              {!jobAlreadyAssigned &&
                                !isRejected &&
                                applicant.negotiation_status ===
                                  'accepted' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      hireApplicant(applicant)
                                    }
                                    disabled={
                                      actionLoadingId === applicant.id
                                    }
                                    className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                                  >
                                    {actionLoadingId === applicant.id
                                      ? 'Hiring...'
                                      : 'Hire Worker'}
                                  </button>
                                )}

                              {!jobAlreadyAssigned &&
                                !isRejected &&
                                applicant.negotiation_status !==
                                  'accepted' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      document
                                        .getElementById(
                                          `negotiation-${applicant.id}`
                                        )
                                        ?.scrollIntoView({
                                          behavior: 'smooth',
                                          block: 'center',
                                        })
                                    }
                                    className="flex-1 rounded-2xl bg-orange-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-orange-300"
                                  >
                                    Review Pay Offer
                                  </button>
                                )}

                              {!isAssigned && !isRejected && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    declineApplicant(applicant)
                                  }
                                  disabled={
                                    actionLoadingId ===
                                    `decline-${applicant.id}`
                                  }
                                  className="flex-1 rounded-2xl bg-red-500/90 px-4 py-3 text-sm font-black text-white transition hover:bg-red-400 disabled:opacity-60"
                                >
                                  {actionLoadingId ===
                                  `decline-${applicant.id}`
                                    ? 'Declining...'
                                    : 'Decline'}
                                </button>
                              )}

                              {isAssigned && (
                                <div className="rounded-2xl bg-emerald-500 px-4 py-3 text-center text-sm font-black text-white">
                                  Assigned
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid border-t border-white/10 lg:grid-cols-[0.85fr_1.15fr]">
                          <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r md:p-6">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                              Candidate Snapshot
                            </p>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                              <SnapshotRow
                                label="Trade"
                                value={worker?.trade || 'Not listed'}
                              />
                              <SnapshotRow
                                label="Experience"
                                value={
                                  worker?.years_experience
                                    ? `${worker.years_experience} years`
                                    : 'Not listed'
                                }
                              />
                              <SnapshotRow
                                label="Insurance"
                                value={
                                  worker?.insurance_provider ||
                                  'Not listed'
                                }
                              />
                              <SnapshotRow
                                label="Liability"
                                value={
                                  worker?.liability_form_signed
                                    ? 'Complete'
                                    : 'Pending'
                                }
                              />
                            </div>

                            {aiMatch && (
                              <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.07] p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-xs font-black uppercase tracking-wide text-cyan-200">
                                    AI Match
                                  </p>
                                  <p className="text-2xl font-black text-white">
                                    {aiMatch.match_score || 0}%
                                  </p>
                                </div>

                                <p className="mt-2 text-sm font-semibold leading-6 text-cyan-50/90">
                                  {aiMatch.reason ||
                                    'Strong CrewCall match.'}
                                </p>
                              </div>
                            )}
                          </div>

                          <div
                            id={`negotiation-${applicant.id}`}
                            className="scroll-mt-24 p-5 md:p-6"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-200">
                                  Pay Negotiation
                                </p>
                                <h5 className="mt-2 text-xl font-black text-white">
                                  Set the final rate before hiring
                                </h5>
                              </div>

                              <NegotiationStatus
                                status={
                                  agreedRate
                                    ? 'agreed'
                                    : applicant.company_counter_offer
                                      ? 'waiting'
                                      : 'review'
                                }
                              />
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                              <OfferCard
                                label="Worker Request"
                                value={
                                  workerOffer
                                    ? formatMoney(workerOffer)
                                    : 'Not submitted'
                                }
                                tone="orange"
                              />
                              <OfferCard
                                label="Company Counter"
                                value={
                                  applicant.company_counter_offer
                                    ? formatMoney(
                                        applicant.company_counter_offer
                                      )
                                    : 'Not sent'
                                }
                                tone="cyan"
                              />
                              <OfferCard
                                label="Agreed Rate"
                                value={
                                  agreedRate
                                    ? formatMoney(agreedRate)
                                    : 'Not agreed'
                                }
                                tone="green"
                              />
                            </div>

                            {!isAssigned && !isRejected && (
                              <div className="mt-5 space-y-3">
                                <div className="grid gap-3 md:grid-cols-[0.7fr_1.3fr]">
                                  <input
                                    inputMode="decimal"
                                    value={
                                      counterOffers[applicant.id] || ''
                                    }
                                    onChange={(event) =>
                                      setCounterOffers((previous) => ({
                                        ...previous,
                                        [applicant.id]:
                                          event.target.value,
                                      }))
                                    }
                                    placeholder="Counter amount"
                                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                                  />

                                  <textarea
                                    rows={2}
                                    value={
                                      counterMessages[applicant.id] || ''
                                    }
                                    onChange={(event) =>
                                      setCounterMessages((previous) => ({
                                        ...previous,
                                        [applicant.id]:
                                          event.target.value,
                                      }))
                                    }
                                    placeholder="Optional message to the worker"
                                    className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                                  />
                                </div>

                                <div className="flex flex-col gap-3 sm:flex-row">
                                  {workerOffer && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        acceptWorkerOffer(applicant)
                                      }
                                      disabled={
                                        workingId ===
                                        `accept-${applicant.id}`
                                      }
                                      className="flex-1 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                                    >
                                      {workingId ===
                                      `accept-${applicant.id}`
                                        ? 'Accepting...'
                                        : 'Accept Rate'}
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      sendCompanyCounter(applicant)
                                    }
                                    disabled={
                                      workingId === applicant.id
                                    }
                                    className="flex-1 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
                                  >
                                    {workingId === applicant.id
                                      ? 'Sending...'
                                      : 'Send Counter Offer'}
                                  </button>
                                </div>

                                {agreedRate && !jobAlreadyAssigned && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      hireApplicant(applicant)
                                    }
                                    disabled={
                                      actionLoadingId === applicant.id
                                    }
                                    className="w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-green-500 px-5 py-4 text-sm font-black text-slate-950 shadow-lg transition hover:scale-[1.01] disabled:opacity-50"
                                  >
                                    {actionLoadingId === applicant.id
                                      ? 'Hiring...'
                                      : `Hire ${workerName} at ${formatMoney(
                                          agreedRate
                                        )}`}
                                  </button>
                                )}
                              </div>
                            )}

                            {isAssigned && (
                              <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">
                                This worker has been hired for this job.
                              </div>
                            )}

                            {isRejected && (
                              <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm font-bold text-red-100">
                                This application has been declined.
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function JobMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-black capitalize text-white">
        {value}
      </p>
    </div>
  )
}

function MatchMetric({
  label,
  value,
}: {
  label: string
  value: number | null | undefined
}) {
  return (
    <div className="rounded-2xl bg-black/20 p-3 text-center">
      <p className="text-xs font-black uppercase text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-white">
        {value || 0}%
      </p>
    </div>
  )
}

function WorkerBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200">
      {children}
    </span>
  )
}

function SnapshotRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-black/20 px-4 py-3">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-right text-sm font-bold text-white">
        {value}
      </span>
    </div>
  )
}

function OfferCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'orange' | 'cyan' | 'green'
}) {
  const classes =
    tone === 'green'
      ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
      : tone === 'cyan'
        ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100'
        : 'border-orange-300/20 bg-orange-400/10 text-orange-100'

  return (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-white">
        {value}
      </p>
    </div>
  )
}

function NegotiationStatus({
  status,
}: {
  status: 'agreed' | 'waiting' | 'review'
}) {
  const label =
    status === 'agreed'
      ? 'Agreed'
      : status === 'waiting'
        ? 'Waiting on worker'
        : 'Needs review'

  const classes =
    status === 'agreed'
      ? 'bg-emerald-400/20 text-emerald-100'
      : status === 'waiting'
        ? 'bg-orange-400/20 text-orange-100'
        : 'bg-blue-400/20 text-blue-100'

  return (
    <span
      className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${classes}`}
    >
      {label}
    </span>
  )
}

function StatusPill({ value }: { value: string }) {
  const lowered = value.toLowerCase()

  const classes =
    lowered.includes('paid') ||
    lowered.includes('accepted') ||
    lowered.includes('assigned') ||
    lowered.includes('hired') ||
    lowered.includes('completed') ||
    lowered.includes('released')
      ? 'bg-emerald-400/20 text-emerald-100 ring-emerald-300/20'
      : lowered.includes('rejected') || lowered.includes('declined')
        ? 'bg-red-400/20 text-red-100 ring-red-300/20'
        : lowered.includes('progress') || lowered.includes('pending')
          ? 'bg-orange-400/20 text-orange-100 ring-orange-300/20'
          : 'bg-cyan-400/20 text-cyan-100 ring-cyan-300/20'

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ring-1 ${classes}`}
    >
      {cleanStatus(value)}
    </span>
  )
}

function LifecycleButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  )
}