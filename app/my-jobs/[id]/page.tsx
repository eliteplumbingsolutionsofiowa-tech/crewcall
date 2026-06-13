'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  status: string | null
  payment_status: string | null
  assigned_worker_id: string | null
}

type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
}

type ApplicationRow = {
  id: string
  worker_id: string
  status: string | null
}

type Applicant = ApplicationRow & {
  profile: Profile | null
}

type JobUpdate = {
  status: string
  assigned_worker_id: string
}

type ApplicationUpdate = {
  status: string
}

type QueryError = {
  message: string
}

type MaybeSingleQuery<T> = {
  maybeSingle: () => Promise<{ data: T | null; error: QueryError | null }>
}

type EqMaybeQuery<T> = {
  eq: (column: string, value: string) => MaybeSingleQuery<T>
}

type EqListQuery<T> = {
  eq: (
    column: string,
    value: string
  ) => Promise<{ data: T[] | null; error: QueryError | null }>
}

type InListQuery<T> = {
  in: (
    column: string,
    values: string[]
  ) => Promise<{ data: T[] | null; error: QueryError | null }>
}

type SelectMaybeTable<T> = {
  select: (columns: string) => EqMaybeQuery<T>
}

type SelectEqTable<T> = {
  select: (columns: string) => EqListQuery<T>
}

type SelectInTable<T> = {
  select: (columns: string) => InListQuery<T>
}

type UpdateEqQuery = {
  eq: (
    column: string,
    value: string
  ) => Promise<{ data: null; error: QueryError | null }>
}

type UpdateTable<TUpdate> = {
  update: (value: TUpdate) => UpdateEqQuery
}

function jobsSelectTable() {
  return supabase.from('jobs') as unknown as SelectMaybeTable<Job>
}

function jobsUpdateTable() {
  return supabase.from('jobs') as unknown as UpdateTable<JobUpdate>
}

function applicationsSelectTable() {
  return supabase.from('applications') as unknown as SelectEqTable<ApplicationRow>
}

function applicationsUpdateTable() {
  return supabase.from('applications') as unknown as UpdateTable<ApplicationUpdate>
}

function profilesInTable() {
  return supabase.from('profiles') as unknown as SelectInTable<Profile>
}

function profilesMaybeTable() {
  return supabase.from('profiles') as unknown as SelectMaybeTable<Profile>
}

export default function JobDetailPage() {
  const params = useParams()
  const jobId = String(params?.id || '')

  const [job, setJob] = useState<Job | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [assignedWorker, setAssignedWorker] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (jobId) {
      load()
    }
  }, [jobId])

  async function load() {
    setLoading(true)

    const { data: jobData } = await jobsSelectTable()
      .select(
        `
        id,
        title,
        trade,
        location,
        pay_rate,
        status,
        payment_status,
        assigned_worker_id
      `
      )
      .eq('id', jobId)
      .maybeSingle()

    setJob(jobData)
    setAssignedWorker(null)

    const { data: rawApps } = await applicationsSelectTable()
      .select(
        `
        id,
        worker_id,
        status
      `
      )
      .eq('job_id', jobId)

    const apps = rawApps || []

    const workerIds = apps
      .map((app) => app.worker_id)
      .filter((workerId): workerId is string => Boolean(workerId))

    let profiles: Profile[] = []

    if (workerIds.length > 0) {
      const { data: rawProfiles } = await profilesInTable()
        .select('id, full_name, company_name')
        .in('id', workerIds)

      profiles = rawProfiles || []
    }

    const merged: Applicant[] = apps.map((app) => ({
      ...app,
      profile: profiles.find((profile) => profile.id === app.worker_id) || null,
    }))

    setApplicants(merged)

    if (jobData?.assigned_worker_id) {
      const { data: rawWorker } = await profilesMaybeTable()
        .select('id, full_name, company_name')
        .eq('id', jobData.assigned_worker_id)
        .maybeSingle()

      setAssignedWorker(rawWorker || null)
    }

    setLoading(false)
  }

  async function hire(app: Applicant) {
    if (!job) return

    await jobsUpdateTable()
      .update({
        status: 'assigned',
        assigned_worker_id: app.worker_id,
      })
      .eq('id', job.id)

    await applicationsUpdateTable()
      .update({
        status: 'hired',
      })
      .eq('id', app.id)

    await load()
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!job) {
    return <div className="p-6">Job not found</div>
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{job.title || 'Untitled Job'}</h1>

        <p className="text-gray-600">
          {[job.trade, job.location].filter(Boolean).join(' · ') ||
            'No trade/location listed'}
        </p>
      </div>

      {assignedWorker && (
        <div className="rounded-2xl border bg-white p-5">
          <h2 className="mb-3 text-lg font-bold">Assigned Worker</h2>

          <p className="font-semibold">
            {assignedWorker.company_name || assignedWorker.full_name || 'Worker'}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/messages?start=${assignedWorker.id}`}
              className="btn-primary"
            >
              Message
            </Link>

            <Link href={`/profile/${assignedWorker.id}`} className="btn">
              View Profile
            </Link>

            {job.payment_status !== 'paid' && (
              <Link href={`/jobs/${job.id}/pay`} className="btn-secondary">
                Pay Worker
              </Link>
            )}

            {job.status === 'completed' && (
              <Link
                href={`/reviews/new?jobId=${job.id}&revieweeId=${assignedWorker.id}`}
                className="btn-warning"
              >
                Leave Review
              </Link>
            )}
          </div>
        </div>
      )}

      {!assignedWorker && (
        <div>
          <h2 className="mb-4 text-xl font-bold">
            Applicants ({applicants.length})
          </h2>

          {applicants.length === 0 ? (
            <p>No applicants yet.</p>
          ) : (
            <div className="space-y-3">
              {applicants.map((app) => (
                <div key={app.id} className="rounded-2xl border bg-white p-4">
                  <p className="font-semibold">
                    {app.profile?.company_name ||
                      app.profile?.full_name ||
                      'Worker'}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => hire(app)}
                      className="btn-secondary"
                    >
                      Hire
                    </button>

                    <Link
                      href={`/messages?start=${app.worker_id}`}
                      className="btn-primary"
                    >
                      Message
                    </Link>

                    <Link href={`/profile/${app.worker_id}`} className="btn">
                      Profile
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}