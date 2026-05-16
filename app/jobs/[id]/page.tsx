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
      .select(
        'id, title, description, trade, location, pay_rate, status, payment_status, payout_status, company_id, assigned_worker_id'
      )
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
        .select('id, role, full_name')
        .eq('id', jobData.assigned_worker_id)
        .maybeSingle()

      setAssignedWorker(workerData as Profile | null)
    } else {
      setAssignedWorker(null)
    }

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
        setMessage(applicantError.message)
        setApplicants([])
      } else {
        setApplicants((applicantData as unknown as Applicant[]) || [])
      }
    } else {
      setApplicants([])
    }

    setLoading(false)
  }

  async function deleteJob() {
    if (!job || !profile) return

    const confirmed = window.confirm(
      'Are you sure you want to delete this job? This cannot be undone.'
    )

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
    } catch (error: any) {
      setMessage(error.message || 'Something went wrong.')
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
  const isOwner = job.company_id === profile.id
  const isAssigned = job.status === 'assigned' || job.status === 'completed'

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

              <p className="mt-2 text-sm text-green-300">
                Payment: {job.payment_status || 'unpaid'}
              </p>

              <p className="mt-1 text-sm text-cyan-300">
                Payout: {job.payout_status || 'not released'}
              </p>
            </div>
          </div>

          <p className="mt-6 whitespace-pre-wrap text-slate-300">
            {job.description || 'No description provided.'}
          </p>

          {isCompany && isOwner && (
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={deleteJob}
                disabled={workingId === 'delete'}
                className="rounded-2xl bg-red-500 px-6 py-3 font-bold text-white shadow-lg shadow-red-500/20 hover:bg-red-400 disabled:opacity-60"
              >
                {workingId === 'delete' ? 'Deleting...' : 'Delete Job'}
              </button>
            </div>
          )}

          {isAssigned && assignedWorker && (
            <div className="mt-6 rounded-2xl border border-green-400/30 bg-green-400/10 p-5">
              <p className="text-xs uppercase tracking-widest text-green-300">
                Worker Assigned
              </p>

              <Link
                href={`/profile?user=${assignedWorker.id}`}
                className="mt-1 block text-xl font-black text-white hover:text-cyan-300"
              >
                {assignedWorker.full_name || 'View Worker'}
              </Link>
            </div>
          )}
        </section>

        {isCompany && isOwner && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Applicants</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Review worker profiles, requested rates, and negotiation notes.
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200">
                {applicants.length}{' '}
                {applicants.length === 1 ? 'Applicant' : 'Applicants'}
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
                    <Link
                      href={`/profile?user=${applicant.worker_id}`}
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

                    <p className="mt-3 text-sm text-slate-300">
                      Experience:{' '}
                      {applicant.worker?.years_experience
                        ? `${applicant.worker.years_experience} years`
                        : 'Not listed'}
                    </p>

                    <p className="mt-2 text-sm text-cyan-300">
                      Posted Rate:{' '}
                      <span className="font-bold">
                        {job.pay_rate || 'Not provided'}
                      </span>
                    </p>

                    <p className="mt-2 text-sm text-orange-300">
                      Requested Rate:{' '}
                      <span className="font-bold">
                        {applicant.requested_pay_rate ||
                          job.pay_rate ||
                          'Not provided'}
                      </span>
                    </p>

                    {applicant.negotiation_message && (
                      <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3">
                        <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
                          Negotiation Message
                        </p>

                        <p className="mt-2 text-sm text-cyan-100">
                          {applicant.negotiation_message}
                        </p>
                      </div>
                    )}
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