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

export default function ApplyPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = String(params.id || '')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [alreadyApplied, setAlreadyApplied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadPage()
  }, [])

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

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    const loadedProfile = profileData as Profile | null
    setProfile(loadedProfile)

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

    const { data: existingApp } = await supabase
      .from('applications')
      .select('id')
      .eq('job_id', jobId)
      .eq('worker_id', user.id)
      .maybeSingle()

    setAlreadyApplied(!!existingApp)
    setLoading(false)
  }

  async function handleApply() {
    setSubmitting(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage(userError?.message || 'You must be logged in to apply.')
      setSubmitting(false)
      return
    }

    if (profile?.role !== 'worker') {
      setMessage('Only worker accounts can apply for jobs.')
      setSubmitting(false)
      return
    }

    if (!job || job.status !== 'open') {
      setMessage('This job is no longer open for applications.')
      setSubmitting(false)
      return
    }

    if (alreadyApplied) {
      setMessage('You already applied for this job.')
      setSubmitting(false)
      return
    }

    const { error } = await supabase.from('applications').insert({
      job_id: jobId,
      worker_id: user.id,
      status: 'pending',
    })

    if (error) {
      setMessage(error.message)
      setSubmitting(false)
      return
    }

    setAlreadyApplied(true)
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
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Apply for Job"
          subtitle="Confirm the job details before submitting your application."
          action={
            <CrewButton href={`/jobs/${jobId}`} variant="ghost">
              Back to Job
            </CrewButton>
          }
        />

        {message && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {message}
          </div>
        )}

        <CrewCard>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {job?.title || 'Untitled Job'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {job?.trade || 'Trade not listed'}
              </p>
            </div>

            <StatusBadge status={job?.status} />
          </div>

          <div className="grid gap-3 text-sm text-gray-700 md:grid-cols-2">
            <p>
              <span className="font-semibold text-gray-900">Location:</span>{' '}
              {job?.location || 'Not listed'}
            </p>

            <p>
              <span className="font-semibold text-gray-900">Pay:</span>{' '}
              {job?.pay_rate || 'Not listed'}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {alreadyApplied ? (
              <CrewButton href="/applications" variant="ghost">
                Already Applied
              </CrewButton>
            ) : (
              <CrewButton
                onClick={handleApply}
                disabled={submitting || profile?.role !== 'worker' || job?.status !== 'open'}
                variant="primary"
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </CrewButton>
            )}

            <CrewButton href="/jobs" variant="ghost">
              Browse More Jobs
            </CrewButton>
          </div>
        </CrewCard>
      </div>
    </main>
  )
}