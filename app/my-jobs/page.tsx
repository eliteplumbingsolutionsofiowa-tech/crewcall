'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string
  trade: string
  location: string
  pay_rate: string | null
  start_date: string | null
  status: string
  created_at: string
}

export default function MyJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [appCounts, setAppCounts] = useState<Record<string, number>>({})
  const [saveCounts, setSaveCounts] = useState<Record<string, number>>({})
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    loadMyJobs()
  }, [])

  async function loadMyJobs() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const { data: jobData } = await supabase
      .from('jobs')
      .select('id, title, trade, location, pay_rate, start_date, status, created_at')
      .eq('company_id', user.id)
      .order('created_at', { ascending: false })

    const jobList = (jobData as Job[]) || []
    setJobs(jobList)

    const jobIds = jobList.map((job) => job.id)

    if (jobIds.length > 0) {
      const { data: apps } = await supabase
        .from('applications')
        .select('job_id')
        .in('job_id', jobIds)

      const { data: saves } = await supabase
        .from('saved_jobs')
        .select('job_id')
        .in('job_id', jobIds)

      const { data: views } = await supabase
        .from('job_views')
        .select('job_id')
        .in('job_id', jobIds)

      const appMap: Record<string, number> = {}
      const saveMap: Record<string, number> = {}
      const viewMap: Record<string, number> = {}

      jobIds.forEach((id) => {
        appMap[id] = apps?.filter((row: any) => row.job_id === id).length || 0
        saveMap[id] = saves?.filter((row: any) => row.job_id === id).length || 0
        viewMap[id] = views?.filter((row: any) => row.job_id === id).length || 0
      })

      setAppCounts(appMap)
      setSaveCounts(saveMap)
      setViewCounts(viewMap)
    }

    setLoading(false)
  }

  if (loading) return <div className="p-6">Loading your jobs...</div>

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase text-blue-700">
          Company Dashboard
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">My Jobs</h1>
        <p className="mt-2 text-slate-600">
          Track views, applicants, saves, and job status.
        </p>

        <Link
          href="/jobs/new"
          className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
        >
          Post New Job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-3xl border bg-white p-8 text-slate-600 shadow-sm">
          You have not posted any jobs yet.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {jobs.map((job) => {
            const apps = appCounts[job.id] || 0
            const saves = saveCounts[job.id] || 0
            const views = viewCounts[job.id] || 0

            return (
              <div
                key={job.id}
                className="rounded-3xl border bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {job.title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {job.trade} · {job.location}
                    </p>
                  </div>

                  <StatusBadge status={job.status} />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InfoPill label="Pay" value={job.pay_rate || 'Not listed'} />
                  <InfoPill
                    label="Start Date"
                    value={job.start_date || 'Not listed'}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                    👀 {views} Views
                  </span>

                  <span className="rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-700">
                    👷 {apps} Applicants
                  </span>

                  <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700">
                    ❤️ {saves} Saves
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    View
                  </Link>

                  <Link
                    href={`/jobs/${job.id}/edit`}
                    className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === 'open'
      ? 'bg-green-100 text-green-700'
      : status === 'assigned'
      ? 'bg-blue-100 text-blue-700'
      : status === 'completed'
      ? 'bg-slate-200 text-slate-700'
      : status === 'cancelled'
      ? 'bg-red-100 text-red-700'
      : 'bg-slate-100 text-slate-600'

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${styles}`}>
      {status}
    </span>
  )
}