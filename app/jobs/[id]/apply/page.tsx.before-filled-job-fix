'use client'

import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: 'worker' | 'company' | null
  full_name?: string | null
}

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  status: string | null
}

type ExistingApplication = {
  id: string
  requested_pay_rate: string | null
  negotiation_message: string | null
}

type ApplicationInsert = {
  job_id: string
  worker_id: string
  status: string
  requested_pay_rate: string | null
  negotiation_message: string | null
}

type ApplicationUpdate = {
  requested_pay_rate: string | null
  negotiation_message: string | null
}

type CompanyJob = {
  company_id: string | null
  title: string | null
}

type NotificationInsert = {
  user_id: string
  type: string
  title: string
  body: string
  is_read: boolean
  read?: boolean
}

export default function ApplyPage() {
  const params = useParams()
  const router = useRouter()

  const jobId = String(params.id || '')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [applicationId, setApplicationId] = useState<string | null>(null)
  const [alreadyApplied, setAlreadyApplied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [requestedPayRate, setRequestedPayRate] = useState('')
  const [negotiationMessage, setNegotiationMessage] = useState('')

  const canApply = useMemo(() => {
    return profile?.role === 'worker' && job?.status === 'open'
  }, [profile?.role, job?.status])

  const loadPage = useCallback(async () => {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      setMessage(userError.message)
      setLoading(false)
      return
    }

    if (!user) {
      setMessage('You must be logged in to apply.')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', user.id)
      .maybeSingle<Profile>()

    if (profileError) {
      setMessage(profileError.message)
      setLoading(false)
      return
    }

    setProfile(profileData)

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select(
        `
        id,
        title,
        trade,
        location,
        pay_rate,
        status
      `
      )
      .eq('id', jobId)
      .maybeSingle<Job>()

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

    setJob(jobData)

    const { data: existingApp, error: existingError } = await supabase
      .from('applications')
      .select(
        `
        id,
        requested_pay_rate,
        negotiation_message
      `
      )
      .match({
        job_id: jobId,
        worker_id: user.id,
      })
      .maybeSingle<ExistingApplication>()

    if (existingError) {
      setMessage(existingError.message)
      setLoading(false)
      return
    }

    if (existingApp) {
      setAlreadyApplied(true)
      setApplicationId(existingApp.id)
      setRequestedPayRate(existingApp.requested_pay_rate || jobData.pay_rate || '')
      setNegotiationMessage(existingApp.negotiation_message || '')
    } else {
      setAlreadyApplied(false)
      setApplicationId(null)
      setRequestedPayRate(jobData.pay_rate || '')
      setNegotiationMessage('')
    }

    setLoading(false)
  }, [jobId])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  async function handleSubmit() {
    setSubmitting(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage(userError?.message || 'You must be logged in.')
      setSubmitting(false)
      return
    }

    if (profile?.role !== 'worker') {
      setMessage('Only worker accounts can apply.')
      setSubmitting(false)
      return
    }

    if (!job || job.status !== 'open') {
      setMessage('This job is no longer accepting applications.')
      setSubmitting(false)
      return
    }

    const cleanedRate = requestedPayRate.trim() || job.pay_rate || null
    const cleanedMessage = negotiationMessage.trim() || null

    if (alreadyApplied) {
      const updatePayload: ApplicationUpdate = {
        requested_pay_rate: cleanedRate,
        negotiation_message: cleanedMessage,
      }

      const { data, error } = await supabase
        .from('applications')
        .update(updatePayload)
        .match({
          job_id: jobId,
          worker_id: user.id,
        })
        .select(
          `
          id,
          requested_pay_rate,
          negotiation_message
        `
        )
        .maybeSingle<ExistingApplication>()

      if (error) {
        setMessage(error.message)
        setSubmitting(false)
        return
      }

      if (!data) {
        setMessage('Application was not found. Try again.')
        setAlreadyApplied(false)
        setApplicationId(null)
        setSubmitting(false)
        return
      }

      setApplicationId(data.id)
      setRequestedPayRate(data.requested_pay_rate || job.pay_rate || '')
      setNegotiationMessage(data.negotiation_message || '')
      setMessage('Application updated successfully.')
      setSubmitting(false)
      return
    }

    const insertPayload: ApplicationInsert = {
      job_id: jobId,
      worker_id: user.id,
      status: 'pending',
      requested_pay_rate: cleanedRate,
      negotiation_message: cleanedMessage,
    }

    const { data: newApplication, error } = await supabase
      .from('applications')
      .insert(insertPayload)
      .select(
        `
        id,
        requested_pay_rate,
        negotiation_message
      `
      )
      .single<ExistingApplication>()

    if (error) {
      setMessage(error.message)
      setSubmitting(false)
      return
    }

    const { data: companyJob } = await supabase
      .from('jobs')
      .select('company_id, title')
      .eq('id', jobId)
      .maybeSingle<CompanyJob>()

    if (companyJob?.company_id) {
      const notificationPayload: NotificationInsert = {
        user_id: companyJob.company_id,
        type: 'application',
        title: 'New Applicant',
        body: `${profile?.full_name || 'A worker'} applied to your job`,
        is_read: false,
        read: false,
      }

      await supabase.from('notifications').insert(notificationPayload)
    }

    setAlreadyApplied(true)
    setApplicationId(newApplication?.id || null)
    setRequestedPayRate(newApplication?.requested_pay_rate || job.pay_rate || '')
    setNegotiationMessage(newApplication?.negotiation_message || '')
    setMessage('Application submitted successfully.')
    setSubmitting(false)

    window.dispatchEvent(new Event('crewcall-refresh-nav'))

    router.push('/applications')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black">Loading application...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href={`/jobs/${jobId}`}
              className="text-sm font-black text-cyan-300 transition hover:text-cyan-200"
            >
              ← Back to Job
            </Link>

            <h1 className="mt-4 text-5xl font-black tracking-tight text-white">
              {alreadyApplied ? 'Update Application' : 'Apply / Negotiate'}
            </h1>

            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
              Submit your requested pay, availability, certifications,
              negotiation details, and experience for this CrewCall job.
            </p>
          </div>

          <Link
            href="/jobs"
            className="rounded-2xl border border-white/10 bg-white/10 px-6 py-4 text-sm font-black text-white transition hover:bg-white/20"
          >
            Browse More Jobs
          </Link>
        </div>

        {message && (
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5 text-sm font-bold text-cyan-100">
            {message}
          </div>
        )}

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/10 p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                  Job Application
                </p>

                <h2 className="mt-3 text-4xl font-black tracking-tight text-white">
                  {job?.title || 'Untitled Job'}
                </h2>

                <p className="mt-3 text-sm font-semibold text-slate-300">
                  {job?.trade || 'Trade not listed'} •{' '}
                  {job?.location || 'Location not listed'}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <PayCard
                  label="Posted Pay"
                  value={job?.pay_rate || 'Not listed'}
                  tone="cyan"
                />

                <PayCard
                  label="Status"
                  value={cleanStatus(job?.status || 'open')}
                  tone="orange"
                />
              </div>
            </div>
          </div>

          <div className="space-y-8 p-6 md:p-8">
            {!canApply && (
              <div className="rounded-3xl border border-red-400/20 bg-red-400/10 p-5">
                <p className="text-sm font-black text-red-100">
                  {profile?.role !== 'worker'
                    ? 'Only worker accounts can apply.'
                    : 'This job is no longer accepting applications.'}
                </p>
              </div>
            )}

            {alreadyApplied && (
              <div className="rounded-3xl border border-orange-400/20 bg-orange-400/10 p-5">
                <p className="text-sm font-black text-orange-100">
                  You already applied for this job. You can still update your
                  negotiation details and requested pay.
                </p>

                {applicationId && (
                  <p className="mt-2 text-xs font-bold uppercase tracking-wide text-orange-200">
                    Application ID: {applicationId}
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
                  Requested Pay
                </p>

                <input
                  value={requestedPayRate}
                  onChange={(event) => setRequestedPayRate(event.target.value)}
                  placeholder="Example: $45/hr or $400/day"
                  className="mt-4 w-full rounded-2xl border border-cyan-300/20 bg-slate-950/50 px-5 py-4 text-lg font-black text-white outline-none placeholder:text-slate-500 focus:border-cyan-300"
                />

                <p className="mt-4 text-sm font-semibold leading-6 text-cyan-100/80">
                  Negotiate your preferred rate based on travel, certifications,
                  tools, overtime, or experience.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Quick Tips
                </p>

                <ul className="mt-5 space-y-4 text-sm font-semibold leading-6 text-slate-300">
                  <li>• Mention licenses or certifications</li>
                  <li>• Explain travel radius and availability</li>
                  <li>• Include tools or specialty experience</li>
                  <li>• Mention overtime or shift flexibility</li>
                </ul>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Negotiation Message
              </label>

              <textarea
                value={negotiationMessage}
                onChange={(event) => setNegotiationMessage(event.target.value)}
                rows={8}
                placeholder="Tell the company why you're a good fit, certifications, experience, travel ability, availability, leadership skills, equipment, or anything important..."
                className="mt-4 w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-base leading-relaxed text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40"
              />

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-400">
                  Companies review your requested pay and message before hiring.
                </p>

                <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-200">
                  {negotiationMessage.length} characters
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || !canApply}
                className="rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-7 py-4 text-sm font-black text-slate-950 shadow-2xl shadow-cyan-500/20 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? alreadyApplied
                    ? 'Updating...'
                    : 'Submitting...'
                  : alreadyApplied
                    ? 'Update Application'
                    : 'Submit Application'}
              </button>

              <Link
                href="/applications"
                className="rounded-2xl border border-white/10 bg-white/10 px-7 py-4 text-sm font-black text-white transition hover:bg-white/20"
              >
                My Applications
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function cleanStatus(value: string) {
  return value.replaceAll('_', ' ')
}

function PayCard({
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
      ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
      : 'border-orange-400/20 bg-orange-400/10 text-orange-100'

  return (
    <div className={`rounded-3xl border p-5 ${classes}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-80">
        {label}
      </p>

      <p className="mt-3 text-2xl font-black capitalize">{value}</p>
    </div>
  )
}