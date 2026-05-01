'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  status: string | null
  company_id: string
  assigned_worker_id: string | null
}

type Application = {
  id: string
  job_id: string
  worker_id: string
  status: string | null
  created_at: string
  worker_name: string | null
  worker_email: string | null
  worker_phone: string | null
  worker_city: string | null
  worker_state: string | null
}

export default function JobApplicantsPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = String(params.id || '')

  const [job, setJob] = useState<Job | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  const dedupedApplications = useMemo(() => {
    const seen = new Set<string>()

    return applications.filter((app) => {
      const key = app.id || `${app.job_id}-${app.worker_id}`

      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [applications])

  async function loadPage() {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.push('/login')
      return
    }

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select(
        'id, title, trade, location, pay_rate, status, company_id, assigned_worker_id'
      )
      .eq('id', jobId)
      .eq('company_id', user.id)
      .maybeSingle()

    if (jobError) {
      setMessage(jobError.message)
      setLoading(false)
      return
    }

    if (!jobData) {
      setMessage('Job not found, or you do not have permission to view it.')
      setLoading(false)
      return
    }

    setJob(jobData as Job)

    const { data: appData, error: appError } = await supabase
      .from('applications')
      .select('id, job_id, worker_id, status, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (appError) {
      setMessage(appError.message)
      setApplications([])
      setLoading(false)
      return
    }

    const rawApplications = (appData || []) as {
      id: string
      job_id: string
      worker_id: string
      status: string | null
      created_at: string
    }[]

    const workerIds = Array.from(
      new Set(rawApplications.map((app) => app.worker_id).filter(Boolean))
    )

    let profilesById = new Map<string, any>()

    if (workerIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, city, state')
        .in('id', workerIds)

      profilesById = new Map((profilesData || []).map((p: any) => [p.id, p]))
    }

    const mergedApplications: Application[] = rawApplications.map((app) => {
      const profile = profilesById.get(app.worker_id)

      return {
        id: app.id,
        job_id: app.job_id,
        worker_id: app.worker_id,
        status: app.status,
        created_at: app.created_at,
        worker_name: profile?.full_name || 'Unnamed worker',
        worker_email: profile?.email || null,
        worker_phone: profile?.phone || null,
        worker_city: profile?.city || null,
        worker_state: profile?.state || null,
      }
    })

    setApplications(mergedApplications)
    setLoading(false)
  }

  async function hireWorker(application: Application) {
    if (!job) return

    setActionLoading(application.id)
    setMessage(null)

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        status: 'assigned',
        assigned_worker_id: application.worker_id,
      })
      .eq('id', job.id)
      .eq('company_id', job.company_id)

    if (jobError) {
      setMessage(jobError.message)
      setActionLoading(null)
      return
    }

    await supabase
      .from('applications')
      .update({ status: 'accepted' })
      .eq('id', application.id)

    await supabase
      .from('applications')
      .update({ status: 'rejected' })
      .eq('job_id', job.id)
      .neq('id', application.id)

    setMessage(`${application.worker_name || 'Worker'} has been hired.`)
    setActionLoading(null)
    await loadPage()
  }

  function statusBadge(status: string | null) {
    const value = status || 'pending'

    const classes =
      value === 'accepted'
        ? 'bg-green-100 text-green-700 border-green-200'
        : value === 'rejected'
          ? 'bg-red-100 text-red-700 border-red-200'
          : 'bg-yellow-100 text-yellow-800 border-yellow-200'

    return (
      <span
        className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${classes}`}
      >
        {value}
      </span>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-gray-600">Loading applicants...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/my-jobs"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              ← Back to My Jobs
            </Link>

            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              Applicants
            </h1>

            {job && (
              <p className="mt-1 text-gray-600">
                {job.title || 'Untitled job'} · {job.trade || 'Trade not set'} ·{' '}
                {job.location || 'Location not set'}
              </p>
            )}
          </div>

          {job?.status && (
            <span className="w-fit rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold capitalize text-gray-700 shadow-sm">
              Job Status: {job.status}
            </span>
          )}
        </div>

        {message && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-800">
            {message}
          </div>
        )}

        {!job && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            Job could not be loaded.
          </div>
        )}

        {job && dedupedApplications.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              No applicants yet
            </h2>
            <p className="mt-2 text-gray-600">
              When workers apply for this job, they will show up here.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {dedupedApplications.map((application) => {
            const isHired =
              job?.assigned_worker_id === application.worker_id ||
              application.status === 'accepted'

            return (
              <div
                key={application.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-bold text-gray-900">
                        {application.worker_name || 'Unnamed worker'}
                      </h2>
                      {statusBadge(application.status)}
                      {isHired && (
                        <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                          Hired
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      {application.worker_email && (
                        <p>Email: {application.worker_email}</p>
                      )}

                      {application.worker_phone && (
                        <p>Phone: {application.worker_phone}</p>
                      )}

                      {(application.worker_city || application.worker_state) && (
                        <p>
                          Location:{' '}
                          {[application.worker_city, application.worker_state]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}

                      <p>
                        Applied:{' '}
                        {new Date(application.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:min-w-40">
                    {!isHired && job?.status !== 'completed' && (
                      <button
                        onClick={() => hireWorker(application)}
                        disabled={actionLoading === application.id}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionLoading === application.id
                          ? 'Hiring...'
                          : 'Hire Worker'}
                      </button>
                    )}

                    <Link
                      href={`/messages?workerId=${application.worker_id}&jobId=${application.job_id}`}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Message
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}