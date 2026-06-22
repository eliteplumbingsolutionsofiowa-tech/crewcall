'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
}

type Applicant = {
  id: string
  job_id: string
  worker_id: string
  status: string | null
  created_at: string
  requested_pay: string | null
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

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [applicants, job?.assigned_application_id, job?.assigned_worker_id])

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

    if (jobData.company_id !== user.id) {
      setMessage('You do not have permission to view applicants for this job.')
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
          worker:profiles!applications_worker_id_fkey (
            id,
            full_name,
            company_name,
            trade,
            city,
            state,
            years_experience,
            insurance_provider,
            liability_form_signed
          )
        `
        )
        .eq('job_id', jobId)
        .order('created_at', {
          ascending: false,
        })

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

    const workerIds = Array.from(
      new Set(
        safeApplicants
          .map((applicant) => applicant.worker_id)
          .filter((workerId): workerId is string => Boolean(workerId))
      )
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

  async function hireApplicant(applicant: Applicant) {
    if (!job) return

    if (job.assigned_worker_id || job.assigned_application_id) {
      setMessage('This job already has an assigned worker.')
      return
    }

    const confirmed = window.confirm(`Hire ${getWorkerName(applicant)}?`)

    if (!confirmed) return

    setActionLoadingId(applicant.id)
    setMessage('')

    const { error: jobError } = await jobsUpdateTable()
      .update({
        assigned_worker_id: applicant.worker_id,
        assigned_application_id: applicant.id,
        status: 'assigned',
      })
      .eq('id', job.id)

    if (jobError) {
      setMessage(jobError.message)
      setActionLoadingId(null)
      return
    }

    const { error: acceptedError } = await applicationsUpdateTable()
      .update({
        status: 'accepted',
      })
      .eq('id', applicant.id)

    if (acceptedError) {
      setMessage(acceptedError.message)
      setActionLoadingId(null)
      return
    }

    await applicationsUpdateWithNeqTable()
      .update({
        status: 'rejected',
      })
      .eq('job_id', job.id)
      .neq('id', applicant.id)

    await notificationsTable().insert({
      user_id: applicant.worker_id,
      title: 'You were hired',
      body: `You were hired for ${job.title || 'a job'}.`,
      link_url: `/jobs/${job.id}`,
      read: false,
      is_read: false,
    })

    setMessage('Worker hired successfully.')

    await loadApplicants()

    window.dispatchEvent(new Event('crewcall-refresh-nav'))

    setActionLoadingId(null)
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

    const { error } = await jobsUpdateTable()
      .update({
        status: nextStatus,
      })
      .eq('id', job.id)

    if (error) {
      setMessage(error.message)
      setActionLoadingId(null)
      return
    }

    setMessage(`Job marked ${cleanStatus(nextStatus)}.`)

    await loadApplicants()

    window.dispatchEvent(new Event('crewcall-refresh-nav'))

    setActionLoadingId(null)
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

  const canPayWorker =
    Boolean(job?.assigned_worker_id) && job?.payment_status !== 'paid'

  const canReleasePayout =
    job?.status === 'completed' &&
    job?.payment_status === 'paid' &&
    job?.payout_status !== 'released'

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black">Loading applicants...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/my-jobs"
              className="text-sm font-black text-cyan-300 transition hover:text-cyan-200"
            >
              ← Back to My Jobs
            </Link>

            <h1 className="mt-4 text-5xl font-black tracking-tight text-white">
              Applicants
            </h1>

            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
              Hire workers, decline applicants, message workers, and move the
              job through the CrewCall workflow.
            </p>
          </div>

          {job && (
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/jobs/${job.id}`}
                className="rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-950 shadow-xl transition hover:scale-[1.02] hover:bg-slate-100"
              >
                View Job
              </Link>

              {canPayWorker && (
                <Link
                  href={`/jobs/${job.id}/pay`}
                  className="rounded-2xl bg-green-600 px-6 py-4 text-sm font-black text-white shadow-xl transition hover:scale-[1.02] hover:bg-green-500"
                >
                  Pay Worker
                </Link>
              )}

              {canReleasePayout && (
                <Link
                  href={`/jobs/${job.id}/release-payout`}
                  className="rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white shadow-xl transition hover:scale-[1.02] hover:bg-emerald-500"
                >
                  Release Payout
                </Link>
              )}
            </div>
          )}
        </div>

        {message && (
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 text-sm font-bold text-cyan-100">
            {message}
          </div>
        )}

        {job && (
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur">
            <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/10 p-6 md:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200/70">
                    Job
                  </p>

                  <h2 className="mt-2 text-3xl font-black text-white">
                    {job.title || 'Untitled Job'}
                  </h2>

                  <p className="mt-3 text-sm font-semibold text-slate-300">
                    {[job.trade, job.location].filter(Boolean).join(' • ') ||
                      'No trade/location listed'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <StatusPill value={job.status || 'open'} />
                  <StatusPill value={job.payment_status || 'unpaid'} />
                  <StatusPill value={job.payout_status || 'not_released'} />
                </div>
              </div>

              {assignedApplicant && (
                <div className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
                    Assigned Worker
                  </p>

                  <p className="mt-3 text-3xl font-black text-white">
                    {getWorkerName(assignedApplicant)}
                  </p>

                  <p className="mt-2 text-sm font-semibold text-emerald-100/80">
                    This worker is assigned to the job.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
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
                </div>
              )}
            </div>
          </div>
        )}

        {sortedApplicants.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-10 text-center shadow-2xl backdrop-blur">
            <h2 className="text-3xl font-black text-white">
              No applicants yet
            </h2>

            <p className="mt-3 text-slate-300">
              Workers will appear here once they apply.
            </p>
          </div>
        ) : (
          <div className="grid gap-5">
            {sortedApplicants.map((applicant) => {
              const worker = applicant.worker
              const workerName = getWorkerName(applicant)
              const workerPhoto = getWorkerPhoto(applicant.worker_id)

              const isAssigned =
                job?.assigned_worker_id === applicant.worker_id ||
                job?.assigned_application_id === applicant.id ||
                applicant.status === 'accepted' ||
                applicant.status === 'hired'

              const jobAlreadyAssigned = Boolean(
                job?.assigned_worker_id || job?.assigned_application_id
              )

              const isRejected =
                applicant.status === 'rejected' ||
                applicant.status === 'declined'

              return (
                <div
                  key={applicant.id}
                  className={`group rounded-[2rem] border p-6 shadow-2xl backdrop-blur transition-all duration-200 hover:-translate-y-1 ${
                    isAssigned
                      ? 'border-emerald-400/30 bg-emerald-400/10'
                      : isRejected
                        ? 'border-red-400/20 bg-red-400/5 opacity-80'
                        : 'border-white/10 bg-white/10 hover:border-cyan-300/30 hover:bg-white/15'
                  }`}
                >
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <Link
                      href={`/profile?user=${applicant.worker_id}`}
                      className="group flex min-w-0 flex-1 gap-5"
                    >
                      {workerPhoto ? (
                        <img
                          src={workerPhoto}
                          alt={workerName}
                          className="h-24 w-24 shrink-0 rounded-3xl border border-white/10 object-cover shadow-xl"
                        />
                      ) : (
                        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 text-4xl font-black text-white shadow-xl">
                          {workerName.charAt(0)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="truncate text-3xl font-black text-white group-hover:text-cyan-200">
                            {workerName}
                          </h3>

                          <StatusPill value={applicant.status || 'pending'} />

                          {isAssigned && <StatusPill value="hired" />}

                          {worker?.liability_form_signed && (
                            <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-100 ring-1 ring-emerald-300/20">
                              Liability Signed
                            </span>
                          )}

                          {worker?.insurance_provider && (
                            <span className="rounded-full bg-blue-400/20 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-100 ring-1 ring-blue-300/20">
                              Insured
                            </span>
                          )}
                        </div>

                        <p className="mt-3 text-sm font-semibold text-slate-300">
                          {[worker?.trade, worker?.city, worker?.state]
                            .filter(Boolean)
                            .join(' • ') || 'No details listed'}
                        </p>

                        {worker?.years_experience && (
                          <p className="mt-4 text-sm font-bold text-slate-100">
                            Experience: {worker.years_experience} years
                          </p>
                        )}

                        {worker?.insurance_provider && (
                          <p className="mt-2 text-sm font-semibold text-slate-300">
                            Insurance: {worker.insurance_provider}
                          </p>
                        )}

                        <p className="mt-4 text-xs font-semibold text-slate-400">
                          Applied{' '}
                          {new Date(applicant.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </Link>

                    <div className="flex shrink-0 flex-wrap gap-3 xl:w-[260px] xl:flex-col">
                      <Link
                        href={`/profile?user=${applicant.worker_id}`}
                        className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white/20"
                      >
                        View Profile
                      </Link>

                      <button
                        type="button"
                        onClick={() => messageWorker(applicant.worker_id)}
                        disabled={actionLoadingId === applicant.worker_id}
                        className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-400 disabled:opacity-60"
                      >
                        {actionLoadingId === applicant.worker_id
                          ? 'Opening...'
                          : 'Message'}
                      </button>

                      {!jobAlreadyAssigned && !isRejected && (
                        <button
                          type="button"
                          onClick={() => hireApplicant(applicant)}
                          disabled={actionLoadingId === applicant.id}
                          className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-400 disabled:opacity-60"
                        >
                          {actionLoadingId === applicant.id
                            ? 'Hiring...'
                            : 'Hire Worker'}
                        </button>
                      )}

                      {!isAssigned && !isRejected && (
                        <button
                          type="button"
                          onClick={() => declineApplicant(applicant)}
                          disabled={
                            actionLoadingId === `decline-${applicant.id}`
                          }
                          className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-black text-white transition hover:bg-red-400 disabled:opacity-60"
                        >
                          {actionLoadingId === `decline-${applicant.id}`
                            ? 'Declining...'
                            : 'Decline'}
                        </button>
                      )}

                      {isAssigned && (
                        <div className="rounded-2xl bg-emerald-500 px-5 py-3 text-center text-sm font-black text-white">
                          Assigned
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                        Worker Compliance
                      </p>

                      <p className="mt-3 text-sm font-bold text-white">
                        {worker?.liability_form_signed
                          ? 'Compliance started'
                          : 'Compliance pending'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-5">
                      <p className="text-xs font-black uppercase tracking-wide text-orange-200">
                        Requested Pay
                      </p>

                      <p className="mt-3 text-2xl font-black text-orange-50">
                        {applicant.requested_pay || 'Not listed'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
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