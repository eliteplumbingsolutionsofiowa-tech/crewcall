'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  location: string | null
  trade: string | null
  pay_rate: string | null
  status: string | null
  created_at: string
}

type JobWithCount = Job & {
  applicantCount: number
}

type AcceptedApplication = {
  worker_id: string
}

export default function CompanyJobsPage() {
  const [jobs, setJobs] = useState<JobWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [workingJobId, setWorkingJobId] = useState<string | null>(null)

  useEffect(() => {
    let activeChannel: ReturnType<typeof supabase.channel> | null = null
    let isMounted = true

    async function fetchJobs(userId: string) {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, location, trade, pay_rate, status, created_at')
        .eq('company_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        if (isMounted) {
          setErrorMessage(error.message)
          setLoading(false)
        }
        return
      }

      const baseJobs = (data || []) as Job[]

      const jobsWithCounts = await Promise.all(
        baseJobs.map(async (job) => {
          const { count } = await supabase
            .from('job_applications')
            .select('*', { count: 'exact', head: true })
            .eq('job_id', job.id)

          return {
            ...job,
            applicantCount: count || 0,
          }
        })
      )

      if (isMounted) {
        setJobs(jobsWithCounts)
        setLoading(false)
      }
    }

    async function loadJobs() {
      setLoading(true)
      setErrorMessage(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        if (isMounted) {
          setErrorMessage(userError.message)
          setLoading(false)
        }
        return
      }

      if (!user) {
        if (isMounted) {
          setErrorMessage('You must be logged in to view your jobs.')
          setLoading(false)
        }
        return
      }

      await fetchJobs(user.id)

      const channelName = `company-jobs-${user.id}-${Date.now()}`
      activeChannel = supabase.channel(channelName)

      activeChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
        },
        async () => {
          await fetchJobs(user.id)
        }
      )

      activeChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications',
        },
        async () => {
          await fetchJobs(user.id)
        }
      )

      activeChannel.subscribe()
    }

    loadJobs()

    return () => {
      isMounted = false
      if (activeChannel) {
        supabase.removeChannel(activeChannel)
      }
    }
  }, [])

  async function notifyAcceptedWorker(
    jobId: string,
    jobTitle: string | null,
    status: string
  ) {
    const { data: acceptedApp } = await supabase
      .from('job_applications')
      .select('worker_id')
      .eq('job_id', jobId)
      .eq('status', 'accepted')
      .maybeSingle()

    const accepted = acceptedApp as AcceptedApplication | null

    if (!accepted?.worker_id) return

    let title = 'Job Update'
    let body = `Your job status changed for ${jobTitle || 'a job'}.`

    if (status === 'assigned') {
      title = 'Job Assigned'
      body = `You were assigned to ${jobTitle || 'a job'}.`
    }

    if (status === 'completed') {
      title = 'Job Completed'
      body = `${jobTitle || 'Your job'} was marked completed.`
    }

    if (status === 'cancelled') {
      title = 'Job Cancelled'
      body = `${jobTitle || 'A job'} was cancelled.`
    }

    await supabase.from('notifications').insert({
      user_id: accepted.worker_id,
      title,
      body,
      read: false,
    })
  }

  async function updateJobStatus(jobId: string, status: string) {
    setWorkingJobId(jobId)
    setErrorMessage(null)

    const job = jobs.find((item) => item.id === jobId)

    const { error } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', jobId)

    if (error) {
      setErrorMessage(error.message)
      setWorkingJobId(null)
      return
    }

    setJobs((prev) =>
      prev.map((item) => (item.id === jobId ? { ...item, status } : item))
    )

    await notifyAcceptedWorker(jobId, job?.title || null, status)

    setWorkingJobId(null)
  }

  function badgeClasses(status: string | null) {
    if (status === 'assigned') {
      return 'bg-green-100 text-green-700'
    }

    if (status === 'completed') {
      return 'bg-blue-100 text-blue-700'
    }

    if (status === 'cancelled') {
      return 'bg-red-100 text-red-700'
    }

    return 'bg-yellow-100 text-yellow-700'
  }

  function label(status: string | null) {
    return (status || 'open').toUpperCase()
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-4xl font-bold">My Jobs</h1>
        <div className="mt-6 rounded-3xl border bg-white p-8 shadow-sm">
          Loading jobs...
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-4xl font-bold">My Jobs</h1>

      {errorMessage && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="mt-8 grid gap-6">
        {jobs.length === 0 ? (
          <div className="rounded-3xl border bg-white p-8 text-gray-500 shadow-sm">
            You have not posted any jobs yet.
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-3xl border bg-white p-8 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {job.title || 'Untitled Job'}
                    </h2>

                    <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                      {job.applicantCount} Applicant{job.applicantCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
                    <span>{job.trade || 'Trade not listed'}</span>
                    <span>•</span>
                    <span>{job.location || 'Location not listed'}</span>
                    {job.pay_rate && (
                      <>
                        <span>•</span>
                        <span>{job.pay_rate}</span>
                      </>
                    )}
                  </div>
                </div>

                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(
                    job.status
                  )}`}
                >
                  {label(job.status)}
                </span>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/jobs/${job.id}`}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  View Job
                </Link>

                <Link
                  href={`/jobs/${job.id}/pay`}
                  className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  View Pay
                </Link>

                {job.status !== 'assigned' &&
                  job.status !== 'completed' &&
                  job.status !== 'cancelled' && (
                    <button
                      onClick={() => updateJobStatus(job.id, 'assigned')}
                      disabled={workingJobId === job.id}
                      className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      {workingJobId === job.id ? 'Working...' : 'Mark Assigned'}
                    </button>
                  )}

                {job.status === 'assigned' && (
                  <button
                    onClick={() => updateJobStatus(job.id, 'completed')}
                    disabled={workingJobId === job.id}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {workingJobId === job.id ? 'Working...' : 'Mark Completed'}
                  </button>
                )}

                {job.status !== 'completed' && job.status !== 'cancelled' && (
                  <button
                    onClick={() => updateJobStatus(job.id, 'cancelled')}
                    disabled={workingJobId === job.id}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {workingJobId === job.id ? 'Working...' : 'Cancel Job'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  )
}