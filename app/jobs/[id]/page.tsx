'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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
  worker: {
    id: string
    full_name: string | null
    trade: string | null
    city: string | null
    state: string | null
    years_experience: string | null
  } | null
}

export default function JobDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = String(params.id || '')

  const [job, setJob] = useState<Job | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [assignedWorker, setAssignedWorker] = useState<Profile | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

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
      .maybeSingle()

    if (profileError || !profileData) {
      setMessage(profileError?.message || 'Profile not found.')
      setLoading(false)
      return
    }

    setProfile(profileData as Profile)

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select(`
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
        assigned_worker_id
      `)
      .eq('id', jobId)
      .maybeSingle()

    if (jobError || !jobData) {
      setMessage(jobError?.message || 'Job not found.')
      setLoading(false)
      return
    }

    setJob(jobData as Job)

    if (jobData.assigned_worker_id) {
      const { data: workerData } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', jobData.assigned_worker_id)
        .maybeSingle()

      setAssignedWorker(workerData as Profile | null)
    } else {
      setAssignedWorker(null)
    }

    if (profileData.role === 'company' && jobData.company_id === user.id) {
      const { data: applicantData } = await supabase
        .from('applications')
        .select(`
          id,
          job_id,
          worker_id,
          status,
          created_at,
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

      setApplicants((applicantData as unknown as Applicant[]) || [])
    } else {
      setApplicants([])
    }

    setLoading(false)
  }

  async function hireWorker(applicant: Applicant) {
    if (!job || !profile) return

    setWorkingId(applicant.id)
    setMessage(null)

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        assigned_worker_id: applicant.worker_id,
        status: 'assigned',
      })
      .eq('id', job.id)
      .eq('company_id', profile.id)

    if (jobError) {
      setMessage(jobError.message)
      setWorkingId(null)
      return
    }

    const { error: hiredError } = await supabase
      .from('applications')
      .update({ status: 'hired' })
      .eq('id', applicant.id)

    if (hiredError) {
      setMessage(hiredError.message)
      setWorkingId(null)
      return
    }

    await supabase
      .from('applications')
      .update({ status: 'not_selected' })
      .eq('job_id', job.id)
      .neq('id', applicant.id)

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: applicant.worker_id,
        title: 'You were hired',
        body: `You were hired for ${job.title}`,
        link_url: `/jobs/${job.id}`,
        read: false,
      })

    if (notificationError) {
      console.log('NOTIFICATION ERROR:', notificationError)

      setMessage(
        `Worker hired, but notification failed: ${notificationError.message}`
      )

      setWorkingId(null)
      return
    }

    setMessage('Worker hired successfully. Notification sent.')
    setWorkingId(null)
    await loadPage()
  }

  async function messageAssignedWorker() {
    if (!job || !job.assigned_worker_id) return

    setWorkingId('message')
    setMessage(null)

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('job_id', job.id)
      .eq('worker_id', job.assigned_worker_id)
      .eq('company_id', job.company_id)
      .maybeSingle()

    let conversationId = existing?.id

    if (!conversationId) {
      const { data: newConversation } = await supabase
        .from('conversations')
        .insert({
          job_id: job.id,
          worker_id: job.assigned_worker_id,
          company_id: job.company_id,
        })
        .select('id')
        .single()

      conversationId = newConversation?.id
    }

    if (conversationId) {
      router.push(`/messages/${conversationId}`)
    }

    setWorkingId(null)
  }

  async function completeJob() {
    if (!job || !profile) return

    setWorkingId('complete')
    setMessage(null)

    try {
      const response = await fetch('/api/jobs/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          companyId: profile.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.error || 'Failed to complete job.')
        setWorkingId(null)
        return
      }

      setMessage('Job marked completed.')
      setWorkingId(null)
      await loadPage()
    } catch (error: any) {
      setMessage(error.message)
      setWorkingId(null)
    }
  }

  async function releasePayout() {
    if (!job) return

    setWorkingId('release')
    setMessage(null)

    try {
      const response = await fetch('/api/stripe/release-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.error || 'Failed to release payout.')
        setWorkingId(null)
        return
      }

      setMessage('Worker payout released successfully.')
      setWorkingId(null)
      await loadPage()
    } catch (error: any) {
      setMessage(error.message)
      setWorkingId(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-8">
          Loading job...
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
  const isWorker = profile.role === 'worker'
  const isOwner = job.company_id === profile.id
  const isOpen = job.status === 'open'
  const isAssigned = job.status === 'assigned'

  const canCompleteJob =
    isCompany &&
    isOwner &&
    job.status === 'assigned' &&
    job.payment_status === 'paid'

  const canReleasePayout =
    isCompany &&
    isOwner &&
    job.status === 'completed' &&
    job.payment_status === 'paid' &&
    job.payout_status !== 'released'

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/jobs" className="text-sm font-semibold text-cyan-300">
          ← Back to jobs
        </Link>

        {message && (
          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-sm text-cyan-100">
            {message}
          </div>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Job Details
              </p>

              <h1 className="mt-3 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-4xl font-black text-transparent">
                {job.title}
              </h1>

              <p className="mt-3 text-slate-300">
                {job.trade || 'Trade not listed'} •{' '}
                {job.location || 'Location not listed'}
              </p>

              <p className="mt-3 text-xl font-black text-cyan-300">
                {job.pay_rate || 'Pay not listed'}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900 px-5 py-4 text-center">
              <p className="text-xs uppercase tracking-widest text-slate-400">
                Status
              </p>

              <p className="mt-1 text-lg font-black capitalize">
                {job.status || 'open'}
              </p>

              {job.payment_status && (
                <p className="mt-2 text-sm text-green-300">
                  Payment: {job.payment_status}
                </p>
              )}

              {job.payout_status && (
                <p className="mt-1 text-sm text-cyan-300">
                  Payout: {job.payout_status}
                </p>
              )}
            </div>
          </div>

          <p className="mt-6 whitespace-pre-wrap text-slate-300">
            {job.description || 'No description provided.'}
          </p>

          {(isAssigned || job.status === 'completed') && assignedWorker && (
            <div className="mt-6 rounded-2xl border border-green-400/30 bg-green-400/10 p-5">
              <p className="text-xs uppercase tracking-widest text-green-300">
                Worker Assigned
              </p>

              <Link
                href={`/workers/${assignedWorker.id}`}
                className="mt-1 block text-xl font-black text-white hover:text-cyan-300"
              >
                {assignedWorker.full_name || 'View Worker'}
              </Link>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {isWorker && isOpen && (
              <Link
                href={`/jobs/${job.id}/apply`}
                className="rounded-2xl bg-cyan-400 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-cyan-400/20 hover:bg-cyan-300"
              >
                Apply
              </Link>
            )}

            {isCompany && isOwner && isAssigned && (
              <>
                <button
                  onClick={messageAssignedWorker}
                  disabled={workingId === 'message'}
                  className="rounded-2xl bg-cyan-400 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-cyan-400/20 hover:bg-cyan-300 disabled:opacity-60"
                >
                  {workingId === 'message'
                    ? 'Opening...'
                    : 'Message Worker'}
                </button>

                <Link
                  href={`/jobs/${job.id}/pay`}
                  className="rounded-2xl border border-white/10 px-6 py-3 font-bold text-white hover:bg-white/10"
                >
                  Pay Worker
                </Link>

                {canCompleteJob && (
                  <button
                    onClick={completeJob}
                    disabled={workingId === 'complete'}
                    className="rounded-2xl bg-orange-500 px-6 py-3 font-bold text-white shadow-lg shadow-orange-500/20 hover:bg-orange-400 disabled:opacity-60"
                  >
                    {workingId === 'complete'
                      ? 'Completing Job...'
                      : 'Mark Job Complete'}
                  </button>
                )}
              </>
            )}

            {canReleasePayout && (
              <button
                onClick={releasePayout}
                disabled={workingId === 'release'}
                className="rounded-2xl bg-green-500 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-green-500/20 hover:bg-green-400 disabled:opacity-60"
              >
                {workingId === 'release'
                  ? 'Releasing Payout...'
                  : 'Release Worker Payout'}
              </button>
            )}
          </div>
        </section>

        {isCompany && isOwner && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Applicants</h2>

                <p className="mt-1 text-sm text-slate-400">
                  Review worker profiles and hire from this job.
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200">
                {applicants.length} Applicant
                {applicants.length === 1 ? '' : 's'}
              </div>
            </div>

            {applicants.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900 p-5 text-slate-300">
                No workers have applied yet.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {applicants.map((applicant) => (
                  <div
                    key={applicant.id}
                    className="rounded-2xl border border-white/10 bg-slate-900 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <Link
                          href={`/workers/${applicant.worker_id}`}
                          className="text-xl font-black text-white hover:text-cyan-300"
                        >
                          {applicant.worker?.full_name || 'Unnamed Worker'}
                        </Link>

                        <p className="mt-1 text-sm text-slate-400">
                          {applicant.worker?.trade || 'Trade not listed'} •{' '}
                          {[applicant.worker?.city, applicant.worker?.state]
                            .filter(Boolean)
                            .join(', ') || 'Location not listed'}
                        </p>

                        <p className="mt-2 text-sm text-slate-300">
                          Experience:{' '}
                          {applicant.worker?.years_experience
                            ? `${applicant.worker.years_experience} years`
                            : 'Not listed'}
                        </p>

                        <p className="mt-2 text-xs uppercase tracking-widest text-slate-500">
                          Application Status: {applicant.status || 'pending'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/workers/${applicant.worker_id}`}
                          className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
                        >
                          View Profile
                        </Link>

                        {job.status === 'open' && (
                          <button
                            onClick={() => hireWorker(applicant)}
                            disabled={workingId === applicant.id}
                            className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
                          >
                            {workingId === applicant.id
                              ? 'Hiring...'
                              : 'Hire Worker'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}