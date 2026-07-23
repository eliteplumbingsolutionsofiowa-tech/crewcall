'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import JobFileList from '@/app/components/JobFileList'
import JobFileUpload from '@/app/components/JobFileUpload'
import { supabase } from '@/lib/supabase'

type UserRole = 'worker' | 'company'

type Job = {
  id: string
  title: string
  description: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  status: string | null
  payment_status: string | null
  payout_status: string | null
  company_id: string
  assigned_worker_id: string | null
  assigned_application_id: string | null
}

type Profile = {
  id: string
  role: UserRole
  full_name: string | null
}

type ApplicantWorker = {
  id: string
  full_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  years_experience: string | null
}

type Applicant = {
  id: string
  job_id: string
  worker_id: string
  status: string | null
  created_at: string
  requested_pay_rate: string | null
  negotiation_message: string | null
  worker: ApplicantWorker | null
}

type JobFile = {
  id: string
  file_name: string | null
  file_url: string | null
  file_type: string | null
  created_at: string
}

type ProfileFile = {
  id: string
  user_id: string
  category: string | null
  file_url: string | null
  created_at: string
}

type JobView = {
  id: string
  job_id: string
  viewer_id: string
  created_at: string
}

type NoticeTone = 'error' | 'success' | 'info'

const FLOW_STEPS = [
  'open',
  'assigned',
  'in_progress',
  'completed',
  'paid',
] as const

function normalize(value: string | null | undefined) {
  return String(value || '').toLowerCase().trim()
}

function cleanStatus(value: string | null | undefined) {
  const normalized = normalize(value || 'open')

  return normalized
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getInitial(value: string | null | undefined) {
  return String(value || 'W').charAt(0).toUpperCase()
}

export default function JobDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = String(params.id || '')

  const [job, setJob] = useState<Job | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [assignedWorker, setAssignedWorker] =
    useState<Profile | null>(null)

  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [jobFiles, setJobFiles] = useState<JobFile[]>([])
  const [profileFiles, setProfileFiles] = useState<ProfileFile[]>([])
  const [jobViews, setJobViews] = useState<JobView[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [workingId, setWorkingId] = useState<string | null>(null)

  const [message, setMessage] = useState<string | null>(null)
  const [messageTone, setMessageTone] =
    useState<NoticeTone>('info')

  useEffect(() => {
    void loadPage()

    async function refreshPage() {
      await loadPage(true)
      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    }

    const channel = supabase
      .channel(`job-details-live-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`,
        },
        refreshPage
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
          filter: `job_id=eq.${jobId}`,
        },
        refreshPage
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_views',
          filter: `job_id=eq.${jobId}`,
        },
        refreshPage
      )
      .subscribe()

    window.addEventListener('focus', refreshPage)

    return () => {
      window.removeEventListener('focus', refreshPage)
      void supabase.removeChannel(channel)
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
      const aHired =
        a.id === job?.assigned_application_id ||
        a.worker_id === job?.assigned_worker_id ||
        normalize(a.status) === 'accepted'

      const bHired =
        b.id === job?.assigned_application_id ||
        b.worker_id === job?.assigned_worker_id ||
        normalize(b.status) === 'accepted'

      if (aHired && !bHired) {
        return -1
      }

      if (!aHired && bHired) {
        return 1
      }

      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      )
    })
  }, [
    applicants,
    job?.assigned_application_id,
    job?.assigned_worker_id,
  ])

  async function recordJobView(
    currentJobId: string,
    viewerId: string
  ) {
    const { data: existingViews, error: existingError } =
      await supabase
        .from('job_views')
        .select('id')
        .eq('job_id', currentJobId)
        .eq('viewer_id', viewerId)
        .limit(1)

    if (existingError) {
      console.warn(
        'Could not check existing job view:',
        existingError.message
      )
      return
    }

    if (existingViews && existingViews.length > 0) {
      return
    }

    const { error: insertError } = await supabase
      .from('job_views')
      .insert({
        job_id: currentJobId,
        viewer_id: viewerId,
      } as never)

    if (insertError) {
      console.warn(
        'Could not record job view:',
        insertError.message
      )
    }
  }

  async function loadPage(isBackgroundRefresh = false) {
    if (isBackgroundRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    if (!isBackgroundRefresh) {
      setMessage(null)
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.push('/login')
      return
    }

    const { data: profileData, error: profileError } =
      await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', user.id)
        .returns<Profile[]>()
        .maybeSingle()

    if (profileError || !profileData) {
      setMessage(profileError?.message || 'Profile not found.')
      setMessageTone('error')
      setLoading(false)
      setRefreshing(false)
      return
    }

    setProfile(profileData)

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select(
        `
        id,
        title,
        description,
        trade,
        location,
        pay_rate,
        status,
        payment_status,
        payout_status,
        company_id,
        assigned_worker_id,
        assigned_application_id
      `
      )
      .eq('id', jobId)
      .returns<Job[]>()
      .maybeSingle()

    if (jobError || !jobData) {
      setMessage(jobError?.message || 'Job not found.')
      setMessageTone('error')
      setLoading(false)
      setRefreshing(false)
      return
    }

    setJob(jobData)

    if (
      profileData.role === 'worker' &&
      jobData.company_id !== user.id
    ) {
      await recordJobView(jobData.id, user.id)
    }

    const { data: viewData } = await supabase
      .from('job_views')
      .select('id, job_id, viewer_id, created_at')
      .eq('job_id', jobId)
      .order('created_at', {
        ascending: false,
      })

    setJobViews((viewData as JobView[]) || [])

    const userIdsToLoad: string[] = []

    if (jobData.assigned_worker_id) {
      const { data: workerData } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', jobData.assigned_worker_id)
        .returns<Profile[]>()
        .maybeSingle()

      setAssignedWorker(workerData || null)
      userIdsToLoad.push(jobData.assigned_worker_id)
    } else {
      setAssignedWorker(null)
    }

    const { data: fileData } = await supabase
      .from('job_files')
      .select(
        'id, file_name, file_url, file_type, created_at'
      )
      .eq('job_id', jobId)
      .order('created_at', {
        ascending: false,
      })

    setJobFiles((fileData as JobFile[]) || [])

    const isOwner =
      profileData.role === 'company' &&
      jobData.company_id === user.id

    if (isOwner) {
      const { data: applicantData, error: applicantError } =
        await supabase
          .from('applications')
          .select(`
            id,
            job_id,
            worker_id,
            status,
            created_at,
            requested_pay_rate,
            negotiation_message,
            worker:profiles!applications_worker_id_fkey (
              id,
              full_name,
              trade,
              city,
              state,
              years_experience
            )
          `)
          .eq('job_id', jobId)
          .order('created_at', {
            ascending: false,
          })

      if (applicantError) {
        setApplicants([])
        setMessage(applicantError.message)
        setMessageTone('error')
      } else {
        const safeApplicants =
          (applicantData as unknown as Applicant[]) || []

        setApplicants(safeApplicants)

        safeApplicants.forEach((applicant) => {
          if (applicant.worker_id) {
            userIdsToLoad.push(applicant.worker_id)
          }
        })
      }
    } else {
      setApplicants([])
    }

    const uniqueUserIds = Array.from(
      new Set(userIdsToLoad)
    )

    if (uniqueUserIds.length > 0) {
      const { data: files } = await supabase
        .from('profile_files')
        .select(
          'id, user_id, category, file_url, created_at'
        )
        .in('user_id', uniqueUserIds)
        .eq('category', 'profile_photo')
        .order('created_at', {
          ascending: false,
        })

      setProfileFiles((files as ProfileFile[]) || [])
    } else {
      setProfileFiles([])
    }

    setLoading(false)
    setRefreshing(false)
  }

  async function updateJobStatus(nextStatus: string) {
    if (!job || !profile) {
      return
    }

    setWorkingId(nextStatus)
    setMessage(null)

    const { error } = await supabase
      .from('jobs')
      .update({
        status: nextStatus,
      } as never)
      .eq('id', job.id)
      .eq('company_id', profile.id)

    if (error) {
      setMessage(error.message)
      setMessageTone('error')
      setWorkingId(null)
      return
    }

    setMessage(`Job marked ${cleanStatus(nextStatus)}.`)
    setMessageTone('success')

    await loadPage(true)
    setWorkingId(null)
  }

  async function payWorker() {
    if (!job) {
      return
    }

    setWorkingId('pay')
    setMessage(null)

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: job.id,
        }),
      })

      const data = (await response.json()) as {
        url?: string
        error?: string
      }

      if (!response.ok || !data.url) {
        setMessage(
          data.error || 'Unable to start Stripe Checkout.'
        )
        setMessageTone('error')
        setWorkingId(null)
        return
      }

      window.location.href = data.url
    } catch {
      setMessage('Unable to start Stripe Checkout.')
      setMessageTone('error')
      setWorkingId(null)
    }
  }

  async function deleteJob() {
    if (!job || !profile) {
      return
    }

    const confirmed = window.confirm(
      'Are you sure you want to delete this job?'
    )

    if (!confirmed) {
      return
    }

    setWorkingId('delete')
    setMessage(null)

    try {
      const response = await fetch('/api/jobs/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: job.id,
          companyId: profile.id,
        }),
      })

      const data = (await response.json()) as {
        error?: string
      }

      if (!response.ok) {
        setMessage(data.error || 'Failed to delete job.')
        setMessageTone('error')
        setWorkingId(null)
        return
      }

      router.push('/my-jobs')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong.'
      )
      setMessageTone('error')
      setWorkingId(null)
    }
  }

  function getPhoto(userId: string | null | undefined) {
    if (!userId) {
      return null
    }

    return photoByUserId.get(userId) || null
  }

  function isStepActive(step: string, index: number) {
    if (!job) {
      return false
    }

    if (step === 'paid') {
      return normalize(job.payment_status) === 'paid'
    }

    const currentIndex = FLOW_STEPS.indexOf(
      normalize(job.status || 'open') as
        | 'open'
        | 'assigned'
        | 'in_progress'
        | 'completed'
        | 'paid'
    )

    return index <= Math.max(0, currentIndex)
  }

  if (loading) {
    return <LoadingState />
  }

  if (!job || !profile) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-red-400/20 bg-red-500/10 p-8 text-red-200">
            <p className="text-lg font-black">
              {message || 'Job not found.'}
            </p>

            <Link
              href="/jobs"
              className="mt-5 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              Back to Jobs
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const isCompany = profile.role === 'company'
  const isWorker = profile.role === 'worker'
  const isOwner = job.company_id === profile.id

  const currentStatus = normalize(job.status || 'open')
  const isAssigned = Boolean(job.assigned_worker_id)
  const paymentPaid =
    normalize(job.payment_status) === 'paid'

  const assignedPhoto = getPhoto(assignedWorker?.id)

  const canApply =
    isWorker &&
    currentStatus === 'open' &&
    !isAssigned

  const canSeeViews = isCompany && isOwner

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8 lg:px-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-48 top-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute -right-48 top-56 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-violet-500/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 text-sm font-black text-cyan-300 transition hover:text-cyan-200"
          >
            ← Back to Jobs
          </Link>

          <button
            type="button"
            onClick={() => void loadPage(true)}
            disabled={refreshing}
            className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-sm font-black text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Job'}
          </button>
        </div>

        {message ? (
          <Notice tone={messageTone}>{message}</Notice>
        ) : null}

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

          <div className="p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col justify-between gap-8 xl:flex-row xl:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={cleanStatus(currentStatus)}
                    tone={getJobStatusTone(currentStatus)}
                  />

                  <StatusBadge
                    label={cleanStatus(
                      job.payment_status || 'unpaid'
                    )}
                    tone={
                      paymentPaid ? 'green' : 'amber'
                    }
                  />

                  <StatusBadge
                    label={job.trade || 'Trade not listed'}
                    tone="violet"
                  />

                  {canSeeViews ? (
                    <StatusBadge
                      label={`${jobViews.length} ${
                        jobViews.length === 1
                          ? 'view'
                          : 'views'
                      }`}
                      tone="blue"
                    />
                  ) : null}
                </div>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                  CrewCall Job
                </p>

                <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {job.title}
                </h1>

                <div className="mt-5 flex flex-wrap gap-3">
                  <DetailChip
                    label="Location"
                    value={job.location || 'Not listed'}
                  />

                  <DetailChip
                    label="Trade"
                    value={job.trade || 'Not listed'}
                  />
                </div>

                {canApply ? (
                  <div className="mt-7">
                    <Link
                      href={`/jobs/${job.id}/apply`}
                      className="inline-flex min-h-13 w-full items-center justify-center rounded-2xl bg-cyan-400 px-7 py-4 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-300 sm:w-auto"
                    >
                      Apply for This Job
                    </Link>
                  </div>
                ) : null}
              </div>

              <div className="w-full shrink-0 xl:w-80">
                <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                    Posted Pay
                  </p>

                  <p className="mt-3 break-words text-4xl font-black tracking-tight text-white">
                    {job.pay_rate || 'Not listed'}
                  </p>

                  <p className="mt-3 text-sm leading-6 text-cyan-100/60">
                    Confirm final pay, schedule, and job terms with
                    the hiring company.
                  </p>
                </div>

                <div className="mt-3 grid gap-3">
                  <SummaryCard
                    label="Job Status"
                    value={cleanStatus(currentStatus)}
                  />

                  <SummaryCard
                    label="Payment"
                    value={cleanStatus(
                      job.payment_status || 'unpaid'
                    )}
                  />

                  <SummaryCard
                    label="Payout"
                    value={cleanStatus(
                      job.payout_status || 'not released'
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {FLOW_STEPS.map((step, index) => {
                const active = isStepActive(step, index)

                return (
                  <div
                    key={step}
                    className={[
                      'rounded-2xl border p-4 transition',
                      active
                        ? 'border-cyan-400/25 bg-cyan-500/10'
                        : 'border-white/10 bg-slate-950/40',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={[
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black',
                          active
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-white/[0.06] text-slate-500',
                        ].join(' ')}
                      >
                        {active ? '✓' : index + 1}
                      </span>

                      <p
                        className={[
                          'text-xs font-black uppercase tracking-wider',
                          active
                            ? 'text-cyan-200'
                            : 'text-slate-500',
                        ].join(' ')}
                      >
                        {cleanStatus(step)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {canApply ? (
          <section className="rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-5 shadow-xl shadow-cyan-950/20 sm:p-6">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                  Open Opportunity
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  Interested in this job?
                </h2>

                <p className="mt-2 text-sm leading-6 text-cyan-100/70">
                  Apply and send your requested rate or a message to
                  the hiring company.
                </p>
              </div>

              <Link
                href={`/jobs/${job.id}/apply`}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-cyan-400 px-7 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-300"
              >
                Apply Now
              </Link>
            </div>
          </section>
        ) : null}

        {isWorker && currentStatus !== 'open' ? (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-bold text-slate-300">
              This job is currently{' '}
              <span className="text-white">
                {cleanStatus(currentStatus)}
              </span>{' '}
              and is not accepting new applications.
            </p>
          </section>
        ) : null}

        {isCompany && isOwner && isAssigned ? (
          <CompanyActions
            currentStatus={currentStatus}
            paymentPaid={paymentPaid}
            workingId={workingId}
            onMarkInProgress={() =>
              void updateJobStatus('in_progress')
            }
            onMarkComplete={() =>
              void updateJobStatus('completed')
            }
            onPayWorker={() => void payWorker()}
          />
        ) : null}

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-xl shadow-black/20 backdrop-blur-xl">
          <SectionHeader
            eyebrow="Job Information"
            title="Description"
            description="Review the company’s job scope and requirements."
          />

          <div className="p-5 sm:p-6">
            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 sm:p-6">
              <p className="whitespace-pre-wrap text-base leading-8 text-slate-300">
                {job.description || 'No description provided.'}
              </p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-xl shadow-black/20 backdrop-blur-xl">
          <SectionHeader
            eyebrow="Plans and Documents"
            title="Job Files"
            description="Upload and review plans, photos, PDFs, specifications, and job documents."
            badge={`${jobFiles.length} ${
              jobFiles.length === 1 ? 'file' : 'files'
            }`}
          />

          <div className="space-y-6 p-5 sm:p-6">
            <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-4 sm:p-5">
              <JobFileUpload
                jobId={job.id}
                userId={profile.id}
                onUploadComplete={() => void loadPage(true)}
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-4 sm:p-5">
              <JobFileList
                files={jobFiles}
                canDelete={isCompany && isOwner}
                onDeleteComplete={() => void loadPage(true)}
              />
            </div>
          </div>
        </section>

        {isAssigned && assignedWorker ? (
          <section className="overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-emerald-500/10 shadow-xl shadow-black/20">
            <div className="p-5 sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                Assigned Worker
              </p>

              <Link
                href={`/profile?user=${assignedWorker.id}`}
                className="mt-5 flex flex-col gap-5 rounded-3xl border border-emerald-400/15 bg-slate-950/40 p-5 transition hover:border-cyan-400/30 hover:bg-slate-950/60 sm:flex-row sm:items-center"
              >
                {assignedPhoto ? (
                  <img
                    src={assignedPhoto}
                    alt={
                      assignedWorker.full_name ||
                      'Assigned worker'
                    }
                    className="h-20 w-20 rounded-3xl object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-3xl font-black text-slate-950">
                    {getInitial(assignedWorker.full_name)}
                  </div>
                )}

                <div className="min-w-0">
                  <h2 className="text-2xl font-black text-white">
                    {assignedWorker.full_name || 'View Worker'}
                  </h2>

                  <p className="mt-2 text-sm font-black text-cyan-300">
                    View Worker Profile →
                  </p>
                </div>
              </Link>
            </div>
          </section>
        ) : null}

        {isCompany && isOwner ? (
          <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-xl shadow-black/20 backdrop-blur-xl">
            <SectionHeader
              eyebrow="Hiring Pipeline"
              title="Applicants"
              description="Review worker details, requested rates, and negotiation messages."
              badge={`${applicants.length} ${
                applicants.length === 1
                  ? 'applicant'
                  : 'applicants'
              }`}
              action={
                <Link
                  href={`/my-jobs/${job.id}/applicants`}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-500/15"
                >
                  Manage Applicants
                </Link>
              }
            />

            <div className="p-5 sm:p-6">
              {sortedApplicants.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/45 px-6 py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-xl font-black text-cyan-300">
                    A
                  </div>

                  <h3 className="mt-5 text-xl font-black text-white">
                    No applicants yet
                  </h3>

                  <p className="mt-2 text-sm text-slate-400">
                    New worker applications will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedApplicants.map((applicant) => {
                    const workerPhoto = getPhoto(
                      applicant.worker_id
                    )

                    const workerName =
                      applicant.worker?.full_name ||
                      'Unnamed Worker'

                    const hired =
                      applicant.id ===
                        job.assigned_application_id ||
                      applicant.worker_id ===
                        job.assigned_worker_id ||
                      normalize(applicant.status) ===
                        'accepted'

                    const workerLocation = [
                      applicant.worker?.city,
                      applicant.worker?.state,
                    ]
                      .filter(Boolean)
                      .join(', ')

                    return (
                      <article
                        key={applicant.id}
                        className={[
                          'overflow-hidden rounded-3xl border',
                          hired
                            ? 'border-emerald-400/25 bg-emerald-500/10'
                            : 'border-white/10 bg-slate-950/55',
                        ].join(' ')}
                      >
                        <div
                          className={
                            hired
                              ? 'h-1 bg-emerald-400'
                              : 'h-1 bg-cyan-400'
                          }
                        />

                        <div className="p-5 sm:p-6">
                          <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
                            <Link
                              href={`/profile?user=${applicant.worker_id}`}
                              className="group flex min-w-0 flex-1 flex-col gap-4 sm:flex-row"
                            >
                              {workerPhoto ? (
                                <img
                                  src={workerPhoto}
                                  alt={workerName}
                                  className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                                />
                              ) : (
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-2xl font-black text-white">
                                  {getInitial(workerName)}
                                </div>
                              )}

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-2xl font-black text-white transition group-hover:text-cyan-300">
                                    {workerName}
                                  </h3>

                                  {hired ? (
                                    <StatusBadge
                                      label="Hired"
                                      tone="green"
                                    />
                                  ) : null}

                                  <StatusBadge
                                    label={cleanStatus(
                                      applicant.status ||
                                        'pending'
                                    )}
                                    tone={getApplicantTone(
                                      applicant.status
                                    )}
                                  />
                                </div>

                                <p className="mt-2 text-sm font-semibold text-slate-400">
                                  {applicant.worker?.trade ||
                                    'Trade not listed'}
                                  {' • '}
                                  {workerLocation ||
                                    'Location not listed'}
                                </p>

                                <p className="mt-3 text-sm text-slate-300">
                                  Experience:{' '}
                                  <span className="font-black text-white">
                                    {applicant.worker
                                      ?.years_experience
                                      ? `${applicant.worker.years_experience} years`
                                      : 'Not listed'}
                                  </span>
                                </p>
                              </div>
                            </Link>

                            <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:w-72 xl:grid-cols-1">
                              <RateCard
                                label="Posted Rate"
                                value={
                                  job.pay_rate ||
                                  'Not provided'
                                }
                                tone="cyan"
                              />

                              <RateCard
                                label="Requested Rate"
                                value={
                                  applicant.requested_pay_rate ||
                                  job.pay_rate ||
                                  'Not provided'
                                }
                                tone="amber"
                              />
                            </div>
                          </div>

                          {applicant.negotiation_message ? (
                            <div className="mt-5 rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-5">
                              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                                Negotiation Message
                              </p>

                              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-cyan-100/80">
                                {
                                  applicant.negotiation_message
                                }
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {isCompany && isOwner ? (
          <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-xl shadow-black/20 backdrop-blur-xl">
            <SectionHeader
              eyebrow="Job Management"
              title="Owner Controls"
              description="Edit this listing or permanently remove it from CrewCall."
            />

            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
              <Link
                href={`/jobs/${job.id}/edit`}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-300"
              >
                Edit Job
              </Link>

              <button
                type="button"
                onClick={() => void deleteJob()}
                disabled={workingId === 'delete'}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10 px-6 py-3 text-sm font-black text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {workingId === 'delete'
                  ? 'Deleting...'
                  : 'Delete Job'}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}

function LoadingState() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <div className="relative h-12 w-12">
                <span className="absolute inset-0 animate-ping rounded-2xl bg-cyan-400/20" />
                <span className="absolute inset-0 animate-pulse rounded-2xl bg-cyan-400/15" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                  CrewCall Job
                </p>

                <p className="mt-1 text-lg font-bold text-white">
                  Loading job details...
                </p>
              </div>
            </div>

            <div className="mt-8 h-72 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="h-64 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
              <div className="h-64 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function CompanyActions({
  currentStatus,
  paymentPaid,
  workingId,
  onMarkInProgress,
  onMarkComplete,
  onPayWorker,
}: {
  currentStatus: string
  paymentPaid: boolean
  workingId: string | null
  onMarkInProgress: () => void
  onMarkComplete: () => void
  onPayWorker: () => void
}) {
  const completed = currentStatus === 'completed'

  return (
    <section className="overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 shadow-xl shadow-black/20">
      <div className="p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          Company Actions
        </p>

        <h2 className="mt-2 text-2xl font-black text-white">
          Manage job progress and payment
        </h2>

        <p className="mt-2 text-sm leading-6 text-cyan-100/70">
          Move the job through the active work and payment
          lifecycle.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ActionButton
            label={
              workingId === 'in_progress'
                ? 'Updating...'
                : 'Mark In Progress'
            }
            disabled={
              workingId === 'in_progress' ||
              currentStatus === 'in_progress' ||
              completed
            }
            onClick={onMarkInProgress}
            tone="blue"
          />

          <ActionButton
            label={
              workingId === 'completed'
                ? 'Updating...'
                : 'Mark Complete'
            }
            disabled={
              workingId === 'completed' || completed
            }
            onClick={onMarkComplete}
            tone="green"
          />

          {!paymentPaid ? (
            <ActionButton
              label={
                workingId === 'pay'
                  ? 'Opening Stripe...'
                  : 'Pay Worker'
              }
              disabled={workingId === 'pay'}
              onClick={onPayWorker}
              tone="cyan"
            />
          ) : (
            <div className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-5 py-3 text-sm font-black text-emerald-200">
              Worker Paid
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function SectionHeader({
  eyebrow,
  title,
  description,
  badge,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  badge?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col justify-between gap-5 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:p-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          {eyebrow}
        </p>

        <h2 className="mt-2 text-2xl font-black text-white">
          {title}
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          {description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {badge ? (
          <span className="rounded-full border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-black text-slate-300">
            {badge}
          </span>
        ) : null}

        {action}
      </div>
    </div>
  )
}

function DetailChip({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-black text-white">
        {value}
      </p>
    </div>
  )
}

function SummaryCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-sm font-black capitalize text-white">
        {value}
      </p>
    </div>
  )
}

function RateCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'cyan' | 'amber'
}) {
  const classes =
    tone === 'cyan'
      ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200'
      : 'border-amber-400/20 bg-amber-500/10 text-amber-200'

  return (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">
        {label}
      </p>

      <p className="mt-2 break-words text-xl font-black">
        {value}
      </p>
    </div>
  )
}

function StatusBadge({
  label,
  tone,
}: {
  label: string
  tone:
    | 'cyan'
    | 'green'
    | 'amber'
    | 'red'
    | 'blue'
    | 'violet'
    | 'slate'
}) {
  const classes = {
    cyan:
      'border-cyan-400/20 bg-cyan-500/10 text-cyan-300',
    green:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
    amber:
      'border-amber-400/20 bg-amber-500/10 text-amber-300',
    red:
      'border-red-400/20 bg-red-500/10 text-red-300',
    blue:
      'border-blue-400/20 bg-blue-500/10 text-blue-300',
    violet:
      'border-violet-400/20 bg-violet-500/10 text-violet-300',
    slate:
      'border-white/10 bg-white/[0.055] text-slate-300',
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wider',
        classes[tone],
      ].join(' ')}
    >
      <span
        className={[
          'h-2 w-2 rounded-full',
          tone === 'cyan'
            ? 'bg-cyan-400'
            : tone === 'green'
              ? 'bg-emerald-400'
              : tone === 'amber'
                ? 'bg-amber-400'
                : tone === 'red'
                  ? 'bg-red-400'
                  : tone === 'blue'
                    ? 'bg-blue-400'
                    : tone === 'violet'
                      ? 'bg-violet-400'
                      : 'bg-slate-400',
        ].join(' ')}
      />

      {label}
    </span>
  )
}

function getJobStatusTone(
  status: string
):
  | 'cyan'
  | 'green'
  | 'amber'
  | 'red'
  | 'blue'
  | 'violet'
  | 'slate' {
  if (status === 'completed') {
    return 'green'
  }

  if (status === 'in_progress') {
    return 'blue'
  }

  if (status === 'assigned') {
    return 'violet'
  }

  if (status === 'closed' || status === 'cancelled') {
    return 'red'
  }

  return 'cyan'
}

function getApplicantTone(
  status: string | null
):
  | 'cyan'
  | 'green'
  | 'amber'
  | 'red'
  | 'blue'
  | 'violet'
  | 'slate' {
  const normalized = normalize(status)

  if (
    normalized === 'accepted' ||
    normalized === 'hired'
  ) {
    return 'green'
  }

  if (
    normalized === 'rejected' ||
    normalized === 'not_selected' ||
    normalized === 'declined'
  ) {
    return 'red'
  }

  if (
    normalized === 'pending' ||
    normalized === 'negotiating'
  ) {
    return 'amber'
  }

  return 'cyan'
}

function ActionButton({
  label,
  disabled,
  onClick,
  tone,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  tone: 'cyan' | 'blue' | 'green'
}) {
  const classes = {
    cyan:
      'border-cyan-400/20 bg-cyan-400 text-slate-950 hover:bg-cyan-300',
    blue:
      'border-blue-400/20 bg-blue-500/15 text-blue-100 hover:bg-blue-500/20',
    green:
      'border-emerald-400/20 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20',
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex min-h-12 items-center justify-center rounded-2xl border px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50',
        classes[tone],
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: NoticeTone
  children: React.ReactNode
}) {
  const classes = {
    error:
      'border-red-400/20 bg-red-500/10 text-red-200',
    success:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    info:
      'border-blue-400/20 bg-blue-500/10 text-blue-200',
  }

  return (
    <div
      className={[
        'rounded-2xl border p-4 text-sm font-bold',
        classes[tone],
      ].join(' ')}
    >
      {children}
    </div>
  )
}