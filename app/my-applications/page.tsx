'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ApplicationRow = {
  id: string
  status: string | null
  created_at: string
  job_id: string
}

type JobRow = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  start_date: string | null
  status: string | null
}

type ApplicationWithJob = ApplicationRow & {
  job: JobRow | null
}

function formatDate(value: string | null) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleDateString()
}

function statusClass(status: string | null) {
  const normalized = String(status || '').toLowerCase()

  if (normalized === 'accepted' || normalized === 'hired') {
    return 'bg-green-100 text-green-700 border-green-200'
  }

  if (normalized === 'declined' || normalized === 'rejected') {
    return 'bg-red-100 text-red-700 border-red-200'
  }

  return 'bg-yellow-100 text-yellow-700 border-yellow-200'
}

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationWithJob[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadApplications()
  }, [])

  async function loadApplications() {
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
      setMessage('You must be logged in to view your applications.')
      setLoading(false)
      return
    }

    const { data: applicationData, error: applicationError } = await supabase
      .from('applications')
      .select('id, status, created_at, job_id')
      .eq('worker_id', user.id)
      .order('created_at', { ascending: false })

    if (applicationError) {
      setMessage(applicationError.message)
      setLoading(false)
      return
    }

    const appRows = (applicationData || []) as ApplicationRow[]
    const jobIds = appRows.map((app) => app.job_id).filter(Boolean)

    let jobsById = new Map<string, JobRow>()

    if (jobIds.length > 0) {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('id, title, trade, location, pay_rate, start_date, status')
        .in('id', jobIds)

      if (jobError) {
        setMessage(jobError.message)
        setLoading(false)
        return
      }

      jobsById = new Map(
        ((jobData || []) as JobRow[]).map((job) => [job.id, job])
      )
    }

    setApplications(
      appRows.map((app) => ({
        ...app,
        job: jobsById.get(app.job_id) || null,
      }))
    )

    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
                Worker Dashboard
              </p>
              <h1 className="mt-2 text-4xl font-bold text-gray-900">
                My Applications
              </h1>
              <p className="mt-4 text-lg text-gray-600">
                Track the jobs you applied for and see whether they are pending,
                accepted, or declined.
              </p>
            </div>

            <Link
              href="/jobs"
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
            >
              Browse Jobs
            </Link>
          </div>
        </section>

        {message && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-gray-600 shadow-sm">
            Loading applications...
          </div>
        ) : applications.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              No applications yet
            </h2>
            <p className="mt-2 text-gray-600">
              When you apply for jobs, they will show up here.
            </p>
            <Link
              href="/jobs"
              className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
            >
              Find Jobs
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((application) => {
              const job = application.job

              return (
                <div
                  key={application.id}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {job?.title || 'Job unavailable'}
                      </h2>

                      <div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                        <p>
                          <span className="font-semibold text-gray-800">
                            Trade:
                          </span>{' '}
                          {job?.trade || 'Not listed'}
                        </p>
                        <p>
                          <span className="font-semibold text-gray-800">
                            Location:
                          </span>{' '}
                          {job?.location || 'Not listed'}
                        </p>
                        <p>
                          <span className="font-semibold text-gray-800">
                            Pay:
                          </span>{' '}
                          {job?.pay_rate || 'Not listed'}
                        </p>
                        <p>
                          <span className="font-semibold text-gray-800">
                            Start:
                          </span>{' '}
                          {formatDate(job?.start_date || null)}
                        </p>
                      </div>

                      <p className="mt-3 text-sm text-gray-500">
                        Applied {formatDate(application.created_at)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:items-end">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusClass(
                          application.status
                        )}`}
                      >
                        {application.status || 'pending'}
                      </span>

                      {job?.id && (
                        <Link
                          href={`/jobs/${job.id}`}
                          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          View Job
                        </Link>
                      )}
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