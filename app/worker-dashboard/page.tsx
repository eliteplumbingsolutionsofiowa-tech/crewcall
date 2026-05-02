'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  start_date: string | null
  status: string | null
  payment_status: string | null
  paid_at: string | null
  company_id: string | null
}

type Stats = {
  assigned: number
  completed: number
  paid: number
  unpaid: number
}

function normalize(value: string | null) {
  return String(value || '').toLowerCase().trim()
}

function formatDate(value: string | null) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleDateString()
}

export default function WorkerDashboard() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats>({
    assigned: 0,
    completed: 0,
    paid: 0,
    unpaid: 0,
  })
  const [loading, setLoading] = useState(true)
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadJobs()
  }, [])

  async function loadJobs() {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('You need to log in as a worker to view this page.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('jobs')
      .select(
        'id, title, trade, location, pay_rate, start_date, status, payment_status, paid_at, company_id'
      )
      .eq('assigned_worker_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setJobs([])
      setLoading(false)
      return
    }

    const jobList = (data || []) as Job[]
    setJobs(jobList)

    setStats({
      assigned: jobList.filter((j) => normalize(j.status) !== 'completed').length,
      completed: jobList.filter((j) => normalize(j.status) === 'completed').length,
      paid: jobList.filter((j) => normalize(j.payment_status) === 'paid').length,
      unpaid: jobList.filter((j) => normalize(j.payment_status) !== 'paid').length,
    })

    setLoading(false)
  }

  async function markComplete(jobId: string) {
    if (!confirm('Mark this job as completed?')) return

    setBusyJobId(jobId)
    setMessage(null)

    const { error } = await supabase
      .from('jobs')
      .update({ status: 'completed' })
      .eq('id', jobId)

    if (error) {
      setMessage(error.message)
      setBusyJobId(null)
      return
    }

    await loadJobs()
    setBusyJobId(null)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-10">
        <div className="mx-auto max-w-5xl text-gray-600">
          Loading worker dashboard...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <section className="mb-8 rounded-2xl border bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Worker Dashboard</h1>
              <p className="mt-2 text-gray-600">
                Track assigned jobs, completed work, and payment status.
              </p>
            </div>

            <Link
              href="/invites"
              className="w-fit rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              View Invites
            </Link>
          </div>
        </section>

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Assigned', value: stats.assigned },
            { label: 'Completed', value: stats.completed },
            { label: 'Paid', value: stats.paid },
            { label: 'Unpaid', value: stats.unpaid },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border bg-white p-6 text-center shadow-sm"
            >
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="mt-2 text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {message}
          </div>
        )}

        {jobs.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-gray-500 shadow-sm">
            No assigned work yet.
          </div>
        ) : (
          <div className="space-y-6">
            {jobs.map((job) => {
              const jobStatus = normalize(job.status)
              const payStatus = normalize(job.payment_status)

              const isCompleted = jobStatus === 'completed'
              const canMarkComplete = !isCompleted

              return (
                <div
                  key={job.id}
                  className="rounded-2xl border bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className={statusClass(isCompleted)}>
                          {isCompleted ? 'completed' : 'assigned'}
                        </span>

                        <span className={paymentClass(payStatus)}>
                          {payStatus || 'unpaid'}
                        </span>
                      </div>

                      <h2 className="text-xl font-bold">
                        {job.title || 'Untitled Job'}
                      </h2>

                      <p className="text-sm text-gray-600">
                        {job.trade || 'Trade not set'} •{' '}
                        {job.location || 'Location not set'}
                      </p>

                      <p className="mt-2 text-sm">
                        Pay: {job.pay_rate || 'Not set'}
                      </p>

                      <p className="text-sm">
                        Start: {formatDate(job.start_date)}
                      </p>

                      {payStatus === 'paid' && (
                        <p className="mt-2 text-sm font-semibold text-green-700">
                          Paid {job.paid_at ? `on ${formatDate(job.paid_at)}` : ''}
                        </p>
                      )}

                      {isCompleted && payStatus !== 'paid' && (
                        <p className="mt-2 text-sm font-semibold text-yellow-700">
                          Completed — waiting for company payment.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 md:justify-end">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="rounded-xl border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                      >
                        View Job
                      </Link>

                      <Link
                        href={`/messages?start=${job.company_id}`}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Message Company
                      </Link>

                      {canMarkComplete && (
                        <button
                          onClick={() => markComplete(job.id)}
                          disabled={busyJobId === job.id}
                          className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                        >
                          {busyJobId === job.id ? 'Completing...' : 'Mark Complete'}
                        </button>
                      )}

                      {isCompleted && job.company_id && (
                        <Link
                          href={`/reviews/new?jobId=${job.id}&revieweeId=${job.company_id}`}
                          className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600"
                        >
                          Leave Review
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

function statusClass(isCompleted: boolean) {
  const base = 'rounded-full px-3 py-1 text-xs font-semibold capitalize '

  if (isCompleted) return base + 'bg-green-100 text-green-700'

  return base + 'bg-blue-100 text-blue-700'
}

function paymentClass(status: string) {
  const base = 'rounded-full px-3 py-1 text-xs font-semibold capitalize '

  if (status === 'paid') return base + 'bg-green-100 text-green-700'
  if (status === 'pending') return base + 'bg-yellow-100 text-yellow-700'

  return base + 'bg-gray-100 text-gray-700'
}