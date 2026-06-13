'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type JobStatus = 'open' | 'active' | 'completed' | 'cancelled'

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
  created_at: string | null
  company_id: string | null
  assigned_worker_id: string | null
}

export default function CompanyJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('Please log in to view your company jobs.')
      setJobs([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('jobs')
      .select(
        `
        id,
        title,
        description,
        trade,
        location,
        pay_rate,
        start_date,
        status,
        payment_status,
        created_at,
        company_id,
        assigned_worker_id
      `
      )
      .eq('company_id', user.id)
      .order('created_at', { ascending: false })
      .returns<Job[]>()

    if (error) {
      setMessage(error.message)
      setJobs([])
      setLoading(false)
      return
    }

    setJobs(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const groupedJobs = useMemo(() => {
    return {
      open: jobs.filter((job) => job.status === 'open' || !job.status),
      active: jobs.filter((job) => job.status === 'active'),
      completed: jobs.filter((job) => job.status === 'completed'),
      cancelled: jobs.filter((job) => job.status === 'cancelled'),
    }
  }, [jobs])

  async function updateJobStatus(jobId: string, status: JobStatus) {
    setUpdatingId(jobId)
    setMessage(null)

    const { error } = await supabase
      .from('jobs')
      .update({
        status,
      })
      .eq('id', jobId)

    if (error) {
      setMessage(error.message)
      setUpdatingId(null)
      return
    }

    setJobs((current) =>
      current.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status,
            }
          : job
      )
    )

    setUpdatingId(null)
  }

  async function deleteJob(jobId: string) {
    const confirmed = window.confirm(
      'Delete this job? This cannot be undone.'
    )

    if (!confirmed) return

    setUpdatingId(jobId)
    setMessage(null)

    const { error } = await supabase.from('jobs').delete().eq('id', jobId)

    if (error) {
      setMessage(error.message)
      setUpdatingId(null)
      return
    }

    setJobs((current) => current.filter((job) => job.id !== jobId))
    setUpdatingId(null)
  }

  function formatDate(value: string | null) {
    if (!value) return 'No start date'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return value

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function getSafeStatus(job: Job): JobStatus {
    if (
      job.status === 'open' ||
      job.status === 'active' ||
      job.status === 'completed' ||
      job.status === 'cancelled'
    ) {
      return job.status
    }

    return 'open'
  }

  function JobCard({ job }: { job: Job }) {
    const status = getSafeStatus(job)

    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700">
                {job.trade || 'Trade not set'}
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                {status}
              </span>

              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
                {job.payment_status || 'payment pending'}
              </span>
            </div>

            <h2 className="text-xl font-black text-slate-950">
              {job.title || 'Untitled job'}
            </h2>

            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              {job.description || 'No description added yet.'}
            </p>

            <div className="flex flex-wrap gap-3 text-sm font-bold text-slate-700">
              <span>{job.location || 'No location'}</span>
              <span>•</span>
              <span>{job.pay_rate || 'No pay rate'}</span>
              <span>•</span>
              <span>{formatDate(job.start_date)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Link
              href={`/jobs/${job.id}`}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
            >
              View Job
            </Link>

            <Link
              href={`/my-jobs/${job.id}/applicants`}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-black text-slate-900 transition hover:bg-slate-50"
            >
              Applicants
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {status !== 'open' && (
            <button
              type="button"
              onClick={() => updateJobStatus(job.id, 'open')}
              disabled={updatingId === job.id}
              className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            >
              Mark Open
            </button>
          )}

          {status !== 'active' && (
            <button
              type="button"
              onClick={() => updateJobStatus(job.id, 'active')}
              disabled={updatingId === job.id}
              className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            >
              Mark Active
            </button>
          )}

          {status !== 'completed' && (
            <button
              type="button"
              onClick={() => updateJobStatus(job.id, 'completed')}
              disabled={updatingId === job.id}
              className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            >
              Complete
            </button>
          )}

          {status !== 'cancelled' && (
            <button
              type="button"
              onClick={() => updateJobStatus(job.id, 'cancelled')}
              disabled={updatingId === job.id}
              className="rounded-2xl bg-slate-200 px-4 py-2 text-sm font-black text-slate-900 disabled:opacity-50"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={() => deleteJob(job.id)}
            disabled={updatingId === job.id}
            className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    )
  }

  function JobSection({ title, jobs }: { title: string; jobs: Job[] }) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-950">{title}</h2>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
            {jobs.length}
          </span>
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-sm font-bold text-slate-500">
            No jobs in this section.
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-300">
              Company
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight">
              My Company Jobs
            </h1>

            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-300">
              Manage posted jobs, applicants, job status, and completed work.
            </p>
          </div>

          <Link
            href="/post-job"
            className="rounded-2xl bg-orange-500 px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-orange-400"
          >
            Post New Job
          </Link>
        </div>

        {message && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl bg-white p-8 text-center text-sm font-black text-slate-500 shadow-sm">
            Loading company jobs...
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-black text-slate-950">
              No jobs posted yet.
            </h2>

            <p className="mt-2 text-sm font-bold text-slate-500">
              Create your first job and start getting workers.
            </p>

            <Link
              href="/post-job"
              className="mt-5 inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-500"
            >
              Post a Job
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            <JobSection title="Open Jobs" jobs={groupedJobs.open} />
            <JobSection title="Active Jobs" jobs={groupedJobs.active} />
            <JobSection title="Completed Jobs" jobs={groupedJobs.completed} />
            <JobSection title="Cancelled Jobs" jobs={groupedJobs.cancelled} />
          </div>
        )}
      </div>
    </main>
  )
}