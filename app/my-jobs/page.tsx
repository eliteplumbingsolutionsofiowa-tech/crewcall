'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  description: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  start_date: string | null
  status: string | null
  payment_status: string | null
  company_id: string
  assigned_worker_id: string | null
  created_at: string
  applicant_count: number
}

export default function MyJobsPage() {
  const router = useRouter()

  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadJobs()
  }, [])

  const dedupedJobs = useMemo(() => {
    const seen = new Set<string>()

    return jobs.filter((job) => {
      if (seen.has(job.id)) return false
      seen.add(job.id)
      return true
    })
  }, [jobs])

  async function loadJobs() {
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

    const { data: jobsData, error: jobsError } = await supabase
      .from('jobs')
      .select(
        'id, title, description, trade, location, pay_rate, start_date, status, payment_status, company_id, assigned_worker_id, created_at'
      )
      .eq('company_id', user.id)
      .order('created_at', { ascending: false })

    if (jobsError) {
      setMessage(jobsError.message)
      setJobs([])
      setLoading(false)
      return
    }

    const cleanJobs = (jobsData || []) as Omit<Job, 'applicant_count'>[]
    const jobIds = cleanJobs.map((job) => job.id)

    let countMap = new Map<string, number>()

    if (jobIds.length > 0) {
      const { data: applicationsData } = await supabase
        .from('applications')
        .select('id, job_id')
        .in('job_id', jobIds)

      ;(applicationsData || []).forEach((app: any) => {
        countMap.set(app.job_id, (countMap.get(app.job_id) || 0) + 1)
      })
    }

    const mergedJobs: Job[] = cleanJobs.map((job) => ({
      ...job,
      applicant_count: countMap.get(job.id) || 0,
    }))

    setJobs(mergedJobs)
    setLoading(false)
  }

  function statusBadge(status: string | null) {
    const value = status || 'open'

    const classes =
      value === 'completed'
        ? 'bg-green-100 text-green-700 border-green-200'
        : value === 'assigned'
          ? 'bg-blue-100 text-blue-700 border-blue-200'
          : value === 'cancelled'
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

  function paymentBadge(status: string | null) {
    const value = status || 'unpaid'

    const classes =
      value === 'paid'
        ? 'bg-green-100 text-green-700 border-green-200'
        : value === 'pending'
          ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
          : 'bg-gray-100 text-gray-700 border-gray-200'

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
        <div className="mx-auto max-w-6xl">
          <p className="text-gray-600">Loading your jobs...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Jobs</h1>
            <p className="mt-1 text-gray-600">
              Manage posted jobs, applicants, payments, hires, and completed work.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/completed-jobs"
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Completed Jobs
            </Link>

            <Link
              href="/post-job"
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Post New Job
            </Link>
          </div>
        </div>

        {message && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {message}
          </div>
        )}

        {dedupedJobs.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              No jobs posted yet
            </h2>
            <p className="mt-2 text-gray-600">
              Post your first job to start finding available workers.
            </p>

            <Link
              href="/post-job"
              className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Post a Job
            </Link>
          </div>
        )}

        <div className="grid gap-4">
          {dedupedJobs.map((job) => (
            <div
              key={job.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-gray-900">
                        {job.title || 'Untitled Job'}
                      </h2>

                      {statusBadge(job.status)}
                      {paymentBadge(job.payment_status)}
                    </div>

                    <p className="mt-1 text-sm text-gray-600">
                      {job.trade || 'Trade not set'} ·{' '}
                      {job.location || 'Location not set'}
                    </p>
                  </div>

                  {job.description && (
                    <p className="max-w-3xl text-sm text-gray-700">
                      {job.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                    <span>
                      Pay:{' '}
                      <strong className="text-gray-900">
                        {job.pay_rate || 'Not set'}
                      </strong>
                    </span>

                    <span>
                      Start:{' '}
                      <strong className="text-gray-900">
                        {job.start_date
                          ? new Date(job.start_date).toLocaleDateString()
                          : 'Not set'}
                      </strong>
                    </span>

                    <span>
                      Applicants:{' '}
                      <strong className="text-gray-900">
                        {job.applicant_count}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {job.status !== 'completed' && (
                    <Link
                      href={`/my-jobs/${job.id}/applicants`}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      View Applicants
                    </Link>
                  )}

                  <Link
                    href={`/jobs/${job.id}`}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    View Job
                  </Link>

                  {job.status === 'assigned' && (
                    <Link
                      href={`/jobs/${job.id}/pay`}
                      className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Pay Worker
                    </Link>
                  )}

                  {job.status === 'completed' && (
                    <>
                      <Link
                        href="/completed-jobs"
                        className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                      >
                        View Completed
                      </Link>

                      <Link
                        href={`/jobs/${job.id}/review`}
                        className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600"
                      >
                        Leave Review
                      </Link>
                    </>
                  )}

                  {job.assigned_worker_id && (
                    <Link
                      href={`/messages?workerId=${job.assigned_worker_id}&jobId=${job.id}`}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Message Worker
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}