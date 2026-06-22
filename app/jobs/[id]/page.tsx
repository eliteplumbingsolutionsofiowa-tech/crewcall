'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import JobFileUpload from '@/app/components/JobFileUpload'
import JobFileList from '@/app/components/JobFileList'

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
  role: 'worker' | 'company'
  full_name: string | null
}

type Applicant = {
  id: string
  job_id: string
  worker_id: string
  status: string | null
  created_at: string
  requested_pay_rate: string | null
  negotiation_message: string | null
  worker: {
    id: string
    full_name: string | null
    trade: string | null
    city: string | null
    state: string | null
    years_experience: string | null
  } | null
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

const FLOW_STEPS = ['open', 'assigned', 'in_progress', 'completed', 'paid']

export default function JobDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = String(params.id || '')

  const [job, setJob] = useState<Job | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [assignedWorker, setAssignedWorker] = useState<Profile | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [jobFiles, setJobFiles] = useState<JobFile[]>([])
  const [profileFiles, setProfileFiles] = useState<ProfileFile[]>([])
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadPage()

    const refresh = async () => {
      await loadPage()
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
        refresh
      )
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
      const aHired =
        a.id === job?.assigned_application_id ||
        a.worker_id === job?.assigned_worker_id ||
        a.status === 'accepted'

      const bHired =
        b.id === job?.assigned_application_id ||
        b.worker_id === job?.assigned_worker_id ||
        b.status === 'accepted'

      if (aHired && !bHired) return -1
      if (!aHired && bHired) return 1

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [applicants, job?.assigned_application_id, job?.assigned_worker_id])

  async function loadPage() {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', user.id)
      .returns<Profile[]>()
      .maybeSingle()

    if (profileError || !profileData) {
      setMessage(profileError?.message || 'Profile not found.')
      setLoading(false)
      return
    }

    setProfile(profileData)

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select(
        'id, title, description, trade, location, pay_rate, status, payment_status, payout_status, company_id, assigned_worker_id, assigned_application_id'
      )
      .eq('id', jobId)
      .returns<Job[]>()
      .maybeSingle()

    if (jobError || !jobData) {
      setMessage(jobError?.message || 'Job not found.')
      setLoading(false)
      return
    }

    setJob(jobData)

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
      .select('id, file_name, file_url, file_type, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    setJobFiles((fileData as JobFile[]) || [])

    if (profileData.role === 'company' && jobData.company_id === user.id) {
      const { data: applicantData, error: applicantError } = await supabase
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
        .order('created_at', { ascending: false })

      if (applicantError) {
        setApplicants([])
        setMessage(applicantError.message)
      } else {
        const safeApplicants = (applicantData as unknown as Applicant[]) || []
        setApplicants(safeApplicants)

        safeApplicants.forEach((applicant) => {
          if (applicant.worker_id) userIdsToLoad.push(applicant.worker_id)
        })
      }
    } else {
      setApplicants([])
    }

    const uniqueUserIds = Array.from(new Set(userIdsToLoad))

    if (uniqueUserIds.length) {
      const { data: files } = await supabase
        .from('profile_files')
        .select('id, user_id, category, file_url, created_at')
        .in('user_id', uniqueUserIds)
        .eq('category', 'profile_photo')
        .order('created_at', { ascending: false })

      setProfileFiles((files as ProfileFile[]) || [])
    } else {
      setProfileFiles([])
    }

    setLoading(false)
  }

  async function updateJobStatus(nextStatus: string) {
    if (!job || !profile) return

    setWorkingId(nextStatus)
    setMessage(null)

    const { error } = await supabase
      .from('jobs')
      .update({ status: nextStatus } as never)
      .eq('id', job.id)
      .eq('company_id', profile.id)

    if (error) {
      setMessage(error.message)
      setWorkingId(null)
      return
    }

    setMessage(`Job marked ${cleanStatus(nextStatus)}.`)
    await loadPage()
    setWorkingId(null)
  }

  async function payWorker() {
    if (!job) return

    setWorkingId('pay')
    setMessage(null)

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })

      const data = (await response.json()) as {
        url?: string
        error?: string
      }

      if (!response.ok || !data.url) {
        setMessage(data.error || 'Unable to start Stripe Checkout.')
        setWorkingId(null)
        return
      }

      window.location.href = data.url
    } catch {
      setMessage('Unable to start Stripe Checkout.')
      setWorkingId(null)
    }
  }

  async function deleteJob() {
    if (!job || !profile) return

    const confirmed = window.confirm('Are you sure you want to delete this job?')
    if (!confirmed) return

    setWorkingId('delete')
    setMessage(null)

    try {
      const response = await fetch('/api/jobs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, companyId: profile.id }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.error || 'Failed to delete job.')
        setWorkingId(null)
        return
      }

      router.push('/my-jobs')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.')
      setWorkingId(null)
    }
  }

  function getPhoto(userId: string | null | undefined) {
    if (!userId) return null
    return photoByUserId.get(userId) || null
  }

  function isStepActive(step: string, index: number) {
    if (!job) return false

    if (step === 'paid') {
      return job.payment_status === 'paid'
    }

    return index <= Math.max(0, FLOW_STEPS.indexOf(job.status || 'open'))
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black text-white">Loading job details...</p>
        </div>
      </main>
    )
  }

  if (!job || !profile) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl rounded-3xl border border-red-400/30 bg-red-400/10 p-8 text-red-200">
          {message || 'Job not found.'}
        </div>
      </main>
    )
  }

  const isCompany = profile.role === 'company'
  const isOwner = job.company_id === profile.id
  const currentStatus = job.status || 'open'
  const isAssigned = Boolean(job.assigned_worker_id)
  const assignedPhoto = getPhoto(assignedWorker?.id)
  const paymentPaid = job.payment_status === 'paid'

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-2 text-sm font-black text-cyan-300 transition hover:text-cyan-200"
        >
          ← Back to jobs
        </Link>

        {message && (
          <div className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-sm font-bold text-cyan-100">
            {message}
          </div>
        )}

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  Job Details
                </p>

                <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
                  {job.title}
                </h1>

                <div className="mt-4 flex flex-wrap gap-3">
                  <StatusPill value={currentStatus} />
                  <StatusPill value={job.payment_status || 'unpaid'} />

                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200">
                    {job.trade || 'Trade not listed'}
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200">
                    {job.location || 'Location not listed'}
                  </span>
                </div>

                <p className="mt-5 text-3xl font-black text-cyan-300">
                  {job.pay_rate || 'Pay not listed'}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 lg:w-[360px] lg:grid-cols-1">
                <InfoBox label="Status" value={cleanStatus(currentStatus)} />
                <InfoBox
                  label="Payment"
                  value={cleanStatus(job.payment_status || 'unpaid')}
                />
                <InfoBox
                  label="Payout"
                  value={cleanStatus(job.payout_status || 'not released')}
                />
              </div>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-5">
              {FLOW_STEPS.map((step, index) => {
                const active = isStepActive(step, index)

                return (
                  <div
                    key={step}
                    className={`rounded-2xl border p-4 ${
                      active
                        ? 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100'
                        : 'border-white/10 bg-slate-950/30 text-slate-500'
                    }`}
                  >
                    <p className="text-xs font-black uppercase tracking-wide">
                      {cleanStatus(step)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-8 p-6 md:p-8">
            {isCompany && isOwner && isAssigned && (
              <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
                <h2 className="text-xl font-black text-white">
                  Company Actions
                </h2>

                <p className="mt-1 text-sm font-semibold text-cyan-100/80">
                  Move this job through the work and payment lifecycle.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <ActionButton
                    label="Mark In Progress"
                    disabled={
                      workingId === 'in_progress' ||
                      currentStatus === 'in_progress' ||
                      currentStatus === 'completed'
                    }
                    onClick={() => updateJobStatus('in_progress')}
                  />

                  <ActionButton
                    label="Mark Complete"
                    disabled={workingId === 'completed' || currentStatus === 'completed'}
                    onClick={() => updateJobStatus('completed')}
                  />

                  {!paymentPaid && (
                    <ActionButton
                      label={workingId === 'pay' ? 'Opening Stripe...' : 'Pay Worker'}
                      disabled={workingId === 'pay'}
                      onClick={payWorker}
                    />
                  )}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-xl font-black text-white">Description</h2>

              <div className="mt-4 rounded-3xl border border-white/10 bg-slate-950/60 p-6">
                <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-300">
                  {job.description || 'No description provided.'}
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-white">Job Files</h2>

                  <p className="mt-1 text-sm font-semibold text-slate-400">
                    Upload plans, photos, PDFs, specs, and job documents.
                  </p>
                </div>

                <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-200">
                  {jobFiles.length} files
                </div>
              </div>

              <div className="mt-6">
                <JobFileUpload
                  jobId={job.id}
                  userId={profile.id}
                  onUploadComplete={() => loadPage()}
                />
              </div>

              <div className="mt-6">
                <JobFileList
                  files={jobFiles}
                  canDelete={isCompany && isOwner}
                  onDeleteComplete={() => loadPage()}
                />
              </div>
            </section>

            {isCompany && isOwner && (
              <section className="flex flex-wrap gap-4">
                <Link
                  href={`/jobs/${job.id}/edit`}
                  className="rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-4 text-sm font-black text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-[1.02]"
                >
                  Edit Job
                </Link>

                <button
                  type="button"
                  onClick={deleteJob}
                  disabled={workingId === 'delete'}
                  className="rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4 text-sm font-black text-white shadow-xl shadow-red-500/20 transition hover:scale-[1.02] disabled:opacity-60"
                >
                  {workingId === 'delete' ? 'Deleting...' : 'Delete Job'}
                </button>
              </section>
            )}

            {isAssigned && assignedWorker && (
              <section className="rounded-3xl border border-green-400/20 bg-green-400/10 p-6">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-green-300">
                  Assigned Worker
                </p>

                <Link
                  href={`/profile?user=${assignedWorker.id}`}
                  className="mt-4 flex items-center gap-4 rounded-3xl border border-green-300/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30 hover:bg-slate-950/50"
                >
                  {assignedPhoto ? (
                    <img
                      src={assignedPhoto}
                      alt={assignedWorker.full_name || 'Assigned worker'}
                      className="h-16 w-16 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-400 to-cyan-400 text-2xl font-black text-slate-950">
                      {(assignedWorker.full_name || 'W').charAt(0)}
                    </div>
                  )}

                  <div>
                    <p className="text-2xl font-black text-white">
                      {assignedWorker.full_name || 'View Worker'}
                    </p>

                    <p className="mt-1 text-sm font-bold text-cyan-200">
                      View Profile →
                    </p>
                  </div>
                </Link>
              </section>
            )}
          </div>
        </section>

        {isCompany && isOwner && (
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-3xl font-black text-white">Applicants</h2>

                <p className="mt-2 text-sm font-semibold text-slate-400">
                  Hired workers stay pinned to the top.
                </p>
              </div>

              <Link
                href={`/my-jobs/${job.id}/applicants`}
                className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-200 hover:bg-cyan-400/20"
              >
                Manage {applicants.length} →
              </Link>
            </div>

            {sortedApplicants.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/60 p-6 text-slate-300">
                No workers have applied yet.
              </div>
            ) : (
              <div className="mt-6 grid gap-5">
                {sortedApplicants.map((applicant) => {
                  const workerPhoto = getPhoto(applicant.worker_id)
                  const workerName = applicant.worker?.full_name || 'Unnamed Worker'

                  const hired =
                    applicant.id === job.assigned_application_id ||
                    applicant.worker_id === job.assigned_worker_id ||
                    applicant.status === 'accepted'

                  return (
                    <div
                      key={applicant.id}
                      className={`rounded-3xl border p-6 transition ${
                        hired
                          ? 'border-emerald-400/30 bg-emerald-400/10'
                          : 'border-white/10 bg-slate-950/70 hover:border-cyan-400/30'
                      }`}
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <Link
                          href={`/profile?user=${applicant.worker_id}`}
                          className="group flex flex-1 gap-4"
                        >
                          {workerPhoto ? (
                            <img
                              src={workerPhoto}
                              alt={workerName}
                              className="h-16 w-16 rounded-2xl object-cover"
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-2xl font-black text-white">
                              {workerName.charAt(0)}
                            </div>
                          )}

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-2xl font-black text-white group-hover:text-cyan-300">
                                {workerName}
                              </p>

                              {hired && (
                                <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-black uppercase text-emerald-100">
                                  Hired
                                </span>
                              )}

                              <StatusPill value={applicant.status || 'pending'} />
                            </div>

                            <p className="mt-2 text-sm font-semibold text-slate-400">
                              {applicant.worker?.trade || 'Trade not listed'} •{' '}
                              {[applicant.worker?.city, applicant.worker?.state]
                                .filter(Boolean)
                                .join(', ') || 'Location not listed'}
                            </p>

                            <p className="mt-4 text-sm text-slate-300">
                              Experience:{' '}
                              <span className="font-black text-white">
                                {applicant.worker?.years_experience
                                  ? `${applicant.worker.years_experience} years`
                                  : 'Not listed'}
                              </span>
                            </p>
                          </div>
                        </Link>

                        <div className="grid gap-4 sm:grid-cols-2 lg:w-[260px] lg:grid-cols-1">
                          <RateBox
                            label="Posted Rate"
                            value={job.pay_rate || 'Not provided'}
                            tone="cyan"
                          />

                          <RateBox
                            label="Requested Rate"
                            value={
                              applicant.requested_pay_rate ||
                              job.pay_rate ||
                              'Not provided'
                            }
                            tone="orange"
                          />
                        </div>
                      </div>

                      {applicant.negotiation_message && (
                        <div className="mt-5 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                            Negotiation Message
                          </p>

                          <p className="mt-3 text-sm leading-relaxed text-cyan-100">
                            {applicant.negotiation_message}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}

function cleanStatus(value: string) {
  return value.replaceAll('_', ' ')
}

function StatusPill({ value }: { value: string }) {
  const lowered = value.toLowerCase()

  const classes =
    lowered.includes('paid') ||
    lowered.includes('accepted') ||
    lowered.includes('assigned')
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
      : lowered.includes('rejected') || lowered.includes('closed')
        ? 'border-red-400/30 bg-red-400/10 text-red-100'
        : lowered.includes('progress') || lowered.includes('pending')
          ? 'border-orange-400/30 bg-orange-400/10 text-orange-100'
          : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'

  return (
    <span
      className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide ${classes}`}
    >
      {cleanStatus(value)}
    </span>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-lg font-black capitalize text-white">{value}</p>
    </div>
  )
}

function RateBox({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'cyan' | 'orange'
}) {
  const classes =
    tone === 'cyan'
      ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300'
      : 'border-orange-400/20 bg-orange-400/10 text-orange-100'

  return (
    <div className={`rounded-3xl border p-4 ${classes}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-80">
        {label}
      </p>

      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  )
}

function ActionButton({
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