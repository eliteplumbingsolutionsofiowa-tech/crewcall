'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  CrewButton,
  CrewCard,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '@/app/components/CrewCallUI'

type Profile = {
  id: string
  role: 'worker' | 'company' | null
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

  useEffect(() => {
    loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  async function loadPage() {
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
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      setMessage(profileError.message)
      setLoading(false)
      return
    }

    setProfile(profileData as Profile | null)

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, trade, location, pay_rate, status')
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

    setJob(jobData as Job)

    const { data: existingApp, error: existingError } = await supabase
      .from('applications')
      .select(`
        id,
        requested_pay_rate,
        negotiation_message
      `)
      .eq('job_id', jobId)
      .eq('worker_id', user.id)
      .maybeSingle()

    if (existingError) {
      setMessage(existingError.message)
      setLoading(false)
      return
    }

    const app = existingApp as ExistingApplication | null

    if (app) {
      setAlreadyApplied(true)
      setApplicationId(app.id)
      setRequestedPayRate(app.requested_pay_rate || jobData.pay_rate || '')
      setNegotiationMessage(app.negotiation_message || '')
    } else {
      setAlreadyApplied(false)
      setApplicationId(null)
      setRequestedPayRate(jobData.pay_rate || '')
      setNegotiationMessage('')
    }

    setLoading(false)
  }

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
      const { data, error } = await supabase
        .from('applications')
        .update({
          requested_pay_rate: cleanedRate,
          negotiation_message: cleanedMessage,
        })
        .eq('job_id', jobId)
        .eq('worker_id', user.id)
        .select('id, requested_pay_rate, negotiation_message')
        .maybeSingle()

      if (error) {
        setMessage(error.message)
        setSubmitting(false)
        return
      }

      if (!data) {
        setMessage('Application was not found. Try submitting again.')
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

    const { data: newApplication, error } = await supabase
      .from('applications')
      .insert({
        job_id: jobId,
        worker_id: user.id,
        status: 'pending',
        requested_pay_rate: cleanedRate,
        negotiation_message: cleanedMessage,
      })
      .select('id, requested_pay_rate, negotiation_message')
      .single()

    if (error) {
      setMessage(error.message)
      setSubmitting(false)
      return
    }

    const { data: companyJob } = await supabase
      .from('jobs')
      .select('company_id, title')
      .eq('id', jobId)
      .single()

    const { data: workerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    if (companyJob?.company_id) {
      await supabase.from('notifications').insert({
        user_id: companyJob.company_id,
        type: 'application',
        title: 'New Applicant',
        body: `${workerProfile?.full_name || 'A worker'} applied to your job`,
        is_read: false,
      })
    }

    setAlreadyApplied(true)
    setApplicationId(newApplication?.id || null)
    setRequestedPayRate(newApplication?.requested_pay_rate || job.pay_rate || '')
    setNegotiationMessage(newApplication?.negotiation_message || '')
    setMessage('Application submitted successfully.')
    setSubmitting(false)

    router.push('/applications')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-8">
        <div className="mx-auto max-w-4xl">
          <LoadingState text="Loading application..." />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-100 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title={alreadyApplied ? 'Update Application' : 'Apply / Negotiate'}
          subtitle="Submit your requested pay and negotiation details for this job."
          action={
            <CrewButton href={`/jobs/${jobId}`} variant="ghost">
              Back to Job
            </CrewButton>
          }
        />

        {message && (
          <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-700">
            {message}
          </div>
        )}

        <CrewCard>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-600">
                Job Application
              </p>

              <h2 className="mt-2 text-3xl font-black text-gray-950">
                {job?.title || 'Untitled Job'}
              </h2>

              <p className="mt-2 text-gray-600">
                {job?.trade || 'Trade not listed'} ·{' '}
                {job?.location || 'Location not listed'}
              </p>
            </div>

            <StatusBadge status={job?.status} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Posted Pay
              </p>

              <p className="mt-2 text-xl font-black text-slate-950">
                {job?.pay_rate || 'Not listed'}
              </p>
            </div>

            <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-orange-600">
                Your Requested Pay
              </p>

              <input
                value={requestedPayRate}
                onChange={(e) => setRequestedPayRate(e.target.value)}
                placeholder="Example: $45/hr or $400/day"
                className="mt-2 w-full rounded-xl border border-orange-200 bg-white px-4 py-3 font-bold text-slate-950 outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="text-sm font-black uppercase tracking-wide text-slate-600">
              Negotiation Message
            </label>

            <textarea
              value={negotiationMessage}
              onChange={(e) => setNegotiationMessage(e.target.value)}
              rows={6}
              placeholder="Tell the company why you're a good fit, availability, certifications, tools, travel ability, etc."
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-bold text-blue-900">
              Companies will review your requested pay and negotiation message
              before hiring.
            </p>
          </div>

          {alreadyApplied && (
            <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-bold text-orange-800">
                You already applied for this job. You can still update your
                negotiation details.
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <CrewButton
              onClick={handleSubmit}
              disabled={
                submitting ||
                profile?.role !== 'worker' ||
                job?.status !== 'open'
              }
              variant="primary"
            >
              {submitting
                ? alreadyApplied
                  ? 'Updating...'
                  : 'Submitting...'
                : alreadyApplied
                ? 'Update Application'
                : 'Submit Application'}
            </CrewButton>

            <CrewButton href="/jobs" variant="ghost">
              Browse More Jobs
            </CrewButton>
          </div>
        </CrewCard>
      </div>
    </main>
  )
}