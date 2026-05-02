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

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
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

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    const cleaned =
      data?.map((j: any) => ({
        ...j,
        company: Array.isArray(j.company) ? j.company[0] : j.company,
      })) || []

    setActiveJobs(cleaned.filter((j) => j.status === 'assigned'))
    setCompletedJobs(cleaned.filter((j) => j.status === 'completed'))

    setLoading(false)
  }

  async function markComplete(jobId: string) {
    if (!confirm('Mark this job as completed?')) return

    await supabase
      .from('jobs')
      .update({ status: 'completed' })
      .eq('id', jobId)

    // instant refresh (no reload flash)
    loadWork()
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
            Track jobs, payments, and reviews.
          </p>
        </div>

        {/* ACTIVE */}
        <Section title="Active Jobs" empty="No active jobs.">
          {activeJobs.map((job) => (
            <JobCard key={job.id} job={job} onComplete={markComplete} active />
          ))}
        </Section>

        {/* COMPLETED */}
        <Section title="Completed Jobs" empty="No completed jobs yet.">
          {completedJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </Section>

      </div>
    </main>
  )
}

/* ---------- SECTION ---------- */

function Section({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-xl font-bold mb-4">{title}</h2>

      {Array.isArray(children) && children.length === 0 ? (
        <Empty text={empty} />
      ) : (
        <div className="grid gap-4">{children}</div>
      )}
    </section>
  )
}

/* ---------- CARD ---------- */

function JobCard({
  job,
  active,
  onComplete,
}: {
  job: Job
  active?: boolean
  onComplete?: (id: string) => void
}) {
  const company =
    job.company?.company_name ||
    job.company?.full_name ||
    'Company'

  return (
    <div className="bg-white border rounded-2xl p-5 shadow-sm">

      {/* BADGES */}
      <div className="flex gap-2 mb-2">
        <Badge type="status" value={job.status} />
        <Badge type="payment" value={job.payment_status} />
      </div>

      {/* TITLE */}
      <h3 className="text-lg font-bold">
        {job.title || 'Untitled Job'}
      </h3>

      <p className="text-sm text-gray-600">{company}</p>

      {/* DETAILS */}
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <div>{job.trade || '-'}</div>
        <div>{job.location || '-'}</div>
        <div>{job.pay_rate || '-'}</div>
        <div>
          {job.start_date
            ? new Date(job.start_date).toLocaleDateString()
            : '-'}
        </div>
      </div>

      {/* STATUS MESSAGES */}
      {job.status === 'completed' && job.payment_status !== 'paid' && (
        <div className="mt-3 text-yellow-700 bg-yellow-50 p-3 rounded-xl">
          Waiting for payment
        </div>
      )}

      {job.payment_status === 'paid' && (
        <div className="mt-3 text-green-700 bg-green-50 p-3 rounded-xl">
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
          Company
        </Link>

        {active && onComplete && (
          <button
            onClick={() => onComplete(job.id)}
            className="btn-secondary"
          >
            Mark Complete
          </button>
        )}

        {job.status === 'completed' && (
          <Link
            href={`/reviews/new?jobId=${job.id}&revieweeId=${job.company_id}`}
            className="btn-warning"
          >
            Review
          </Link>
        )}
      </div>
    </div>
  )
}

/* ---------- BADGE ---------- */

function Badge({
  type,
  value,
}: {
  type: 'status' | 'payment'
  value: string | null
}) {
  const styles =
    type === 'status'
      ? value === 'completed'
        ? 'bg-green-100 text-green-700'
        : value === 'assigned'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-gray-100 text-gray-700'
      : value === 'paid'
      ? 'bg-green-100 text-green-700'
      : value === 'pending'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-gray-100 text-gray-700'

  return (
    <span className={`px-3 py-1 text-xs rounded-full ${styles}`}>
      {value || (type === 'payment' ? 'unpaid' : 'unknown')}
    </span>
  )
}

/* ---------- EMPTY ---------- */

function Empty({ text }: { text: string }) {
  return (
    <div className="bg-white border rounded-2xl p-6 text-center text-gray-500">
      {text}
    </div>
  )
}