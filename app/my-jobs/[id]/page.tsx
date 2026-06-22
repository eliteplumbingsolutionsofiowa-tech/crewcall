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

function cleanStatus(value: string | null) {
  return (value || 'open').replaceAll('_', ' ')
}

function StatusPill({ value }: { value: string | null }) {
  const lowered = (value || '').toLowerCase()

  const classes =
    lowered.includes('paid') ||
    lowered.includes('hired') ||
    lowered.includes('assigned')
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
      : lowered.includes('pending') || lowered.includes('progress')
        ? 'border-orange-400/30 bg-orange-400/10 text-orange-100'
        : lowered.includes('completed')
          ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'
          : 'border-white/10 bg-white/5 text-slate-200'

  return (
    <span
      className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide ${classes}`}
    >
      {cleanStatus(value)}
    </span>
  )
}

export default function JobDetailPage() {
  const params = useParams()
  const jobId = String(params?.id || '')

  const [job, setJob] = useState<Job | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [assignedWorker, setAssignedWorker] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [payLoading, setPayLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (jobId) {
      load()
    }
  }, [jobId])

  async function load() {
    setLoading(true)
    setMessage('')

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

  async function payWorker() {
    if (!job) return

    setPayLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: job.id,
        }),
      })

      const data = (await response.json()) as {
        url?: string
        error?: string
      }

      if (!response.ok || !data.url) {
        setMessage(data.error || 'Unable to start Stripe Checkout.')
        setPayLoading(false)
        return
      }

      window.location.href = data.url
    } catch {
      setMessage('Unable to start Stripe Checkout.')
      setPayLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-5xl rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
          <p className="text-sm font-black text-cyan-100">Loading job...</p>
        </div>
      </main>
    )
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-5xl rounded-3xl border border-red-400/30 bg-red-500/10 p-6 text-red-100">
          Job not found.
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-8 text-white">
      <section className="mx-auto max-w-5xl space-y-6">
        <Link
          href="/my-jobs"
          className="inline-flex text-sm font-black text-cyan-300 hover:text-cyan-200"
        >
          ← Back to My Jobs
        </Link>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
            My Job
          </p>

          <h1 className="mt-4 text-4xl font-black text-white">
            {job.title || 'Untitled Job'}
          </h1>

          <p className="mt-2 text-lg font-semibold text-slate-400">
            {[job.trade, job.location].filter(Boolean).join(' · ') ||
              'No trade/location listed'}
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <StatusPill value={job.status || 'open'} />
            <StatusPill value={job.payment_status || 'unpaid'} />
          </div>

          <p className="mt-5 text-3xl font-black text-cyan-300">
            {job.pay_rate || 'Pay not listed'}
          </p>

          {message && (
            <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
              {message}
            </div>
          )}
        </div>

        {assignedWorker ? (
          <div className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-6 shadow-2xl">
            <h2 className="text-xl font-black text-white">Assigned Worker</h2>

            <p className="mt-3 text-lg font-bold text-emerald-100">
              {assignedWorker.company_name ||
                assignedWorker.full_name ||
                'Worker'}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/messages?start=${assignedWorker.id}`}
                className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950"
              >
                Message
              </Link>

              <Link
                href={`/profile/${assignedWorker.id}`}
                className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white"
              >
                View Profile
              </Link>

              {job.payment_status !== 'paid' && (
                <button
                  type="button"
                  onClick={payWorker}
                  disabled={payLoading}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {payLoading ? 'Opening Stripe...' : 'Pay Worker'}
                </button>
              )}

              {job.status === 'completed' && (
                <Link
                  href={`/reviews/new?jobId=${job.id}&revieweeId=${assignedWorker.id}`}
                  className="rounded-2xl bg-gradient-to-r from-orange-400 to-yellow-300 px-5 py-3 text-sm font-black text-slate-950"
                >
                  Leave Review
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl">
            <h2 className="text-2xl font-black text-white">
              Applicants ({applicants.length})
            </h2>

            {applicants.length === 0 ? (
              <p className="mt-4 rounded-3xl border border-white/10 bg-slate-950/60 p-5 text-slate-300">
                No applicants yet.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {applicants.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-3xl border border-white/10 bg-slate-950/70 p-5"
                  >
                    <p className="text-lg font-black text-white">
                      {app.profile?.company_name ||
                        app.profile?.full_name ||
                        'Worker'}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => hire(app)}
                        className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950"
                      >
                        Hire
                      </button>

                      <Link
                        href={`/messages?start=${app.worker_id}`}
                        className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-100"
                      >
                        Message
                      </Link>

                      <Link
                        href={`/profile/${app.worker_id}`}
                        className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white"
                      >
                        Profile
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}