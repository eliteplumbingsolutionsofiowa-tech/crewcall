'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  start_date: string | null
  status: 'assigned' | 'completed' | 'cancelled' | null
  payment_status: 'unpaid' | 'pending' | 'paid' | null
  paid_at: string | null
  company_id: string | null
  company?: {
    full_name: string | null
    company_name: string | null
  } | null
}

export default function MyWorkPage() {
  const [activeJobs, setActiveJobs] = useState<Job[]>([])
  const [completedJobs, setCompletedJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWork()
  }, [])

  async function loadWork() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data } = await supabase
      .from('jobs')
      .select(`
        *,
        company:profiles!jobs_company_id_fkey (
          full_name,
          company_name
        )
      `)
      .eq('assigned_worker_id', user.id)
      .order('start_date', { ascending: false })

    const cleaned =
      data?.map((j: any) => ({
        ...j,
        company: Array.isArray(j.company) ? j.company[0] : j.company,
      })) || []

    setActiveJobs(cleaned.filter((j) => j.status === 'assigned'))
    setCompletedJobs(cleaned.filter((j) => j.status === 'completed'))

    setLoading(false)
  }

  function companyName(job: Job) {
    return (
      job.company?.company_name ||
      job.company?.full_name ||
      'Company'
    )
  }

  function paymentBadge(status: string | null) {
    if (status === 'paid') return 'bg-green-100 text-green-700'
    if (status === 'pending') return 'bg-yellow-100 text-yellow-700'
    return 'bg-gray-100 text-gray-700'
  }

  function statusBadge(status: string | null) {
    if (status === 'completed') return 'bg-green-100 text-green-700'
    if (status === 'assigned') return 'bg-blue-100 text-blue-700'
    return 'bg-gray-100 text-gray-700'
  }

  if (loading) {
    return <main className="p-6">Loading your work...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-10">

        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-bold">My Work</h1>
          <p className="text-gray-600 mt-1">
            Manage jobs, track payments, and build your reputation.
          </p>
        </div>

        {/* ACTIVE JOBS */}
        <section>
          <h2 className="text-xl font-bold mb-4">Active Jobs</h2>

          {activeJobs.length === 0 ? (
            <Empty text="No active jobs." />
          ) : (
            <div className="grid gap-4">
              {activeJobs.map((job) => (
                <Card key={job.id} job={job} active />
              ))}
            </div>
          )}
        </section>

        {/* COMPLETED JOBS */}
        <section>
          <h2 className="text-xl font-bold mb-4">Completed Jobs</h2>

          {completedJobs.length === 0 ? (
            <Empty text="No completed jobs yet." />
          ) : (
            <div className="grid gap-4">
              {completedJobs.map((job) => (
                <Card key={job.id} job={job} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

/* ---------- CARD ---------- */

function Card({
  job,
  active = false,
}: {
  job: Job
  active?: boolean
}) {
  const company =
    job.company?.company_name ||
    job.company?.full_name ||
    'Company'

  return (
    <div className="bg-white border rounded-2xl p-5 shadow-sm">

      <div className="flex flex-wrap gap-2 mb-2">
        <span className={`px-3 py-1 text-xs rounded-full ${statusBadge(job.status)}`}>
          {job.status}
        </span>

        <span className={`px-3 py-1 text-xs rounded-full ${paymentBadge(job.payment_status)}`}>
          {job.payment_status || 'unpaid'}
        </span>
      </div>

      <h3 className="text-lg font-bold">
        {job.title || 'Untitled Job'}
      </h3>

      <p className="text-sm text-gray-600">
        {company}
      </p>

      <div className="mt-3 text-sm text-gray-700 grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>{job.trade || 'No trade'}</div>
        <div>{job.location || 'No location'}</div>
        <div>{job.pay_rate || 'No pay set'}</div>
        <div>
          {job.start_date
            ? new Date(job.start_date).toLocaleDateString()
            : 'No date'}
        </div>
      </div>

      {/* PAYMENT STATUS */}
      {job.status === 'completed' && job.payment_status !== 'paid' && (
        <div className="mt-3 text-sm text-yellow-700 bg-yellow-50 p-3 rounded-xl">
          Waiting for company to send payment
        </div>
      )}

      {job.payment_status === 'paid' && (
        <div className="mt-3 text-sm text-green-700 bg-green-50 p-3 rounded-xl">
          Paid {job.paid_at && `on ${new Date(job.paid_at).toLocaleDateString()}`}
        </div>
      )}

      {/* ACTIONS */}
      <div className="flex flex-wrap gap-2 mt-4">

        <Link href={`/jobs/${job.id}`} className="btn">
          View
        </Link>

        <Link href={`/messages?start=${job.company_id}`} className="btn-primary">
          Message
        </Link>

        <Link href={`/profile/${job.company_id}`} className="btn">
          Company Profile
        </Link>

        {active && (
          <button
            className="btn-secondary"
            onClick={() => markComplete(job.id)}
          >
            Mark Complete
          </button>
        )}

        {job.status === 'completed' && (
          <Link
            href={`/reviews/new?jobId=${job.id}&revieweeId=${job.company_id}`}
            className="btn-warning"
          >
            Leave Review
          </Link>
        )}
      </div>
    </div>
  )
}

/* ---------- ACTION ---------- */

async function markComplete(jobId: string) {
  if (!confirm('Mark this job as completed?')) return

  await supabase
    .from('jobs')
    .update({ status: 'completed' })
    .eq('id', jobId)

  location.reload()
}

/* ---------- UI ---------- */

function Empty({ text }: { text: string }) {
  return (
    <div className="bg-white border rounded-2xl p-6 text-center text-gray-500">
      {text}
    </div>
  )
}

function statusBadge(status: string | null) {
  if (status === 'completed') return 'bg-green-100 text-green-700'
  if (status === 'assigned') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-700'
}

function paymentBadge(status: string | null) {
  if (status === 'paid') return 'bg-green-100 text-green-700'
  if (status === 'pending') return 'bg-yellow-100 text-yellow-700'
  return 'bg-gray-100 text-gray-700'
}