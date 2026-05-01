'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LoadingSpinner from '@/app/components/LoadingSpinner'
import StatusCard from '@/app/components/StatusCard'

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
  assigned_worker_id: string | null
  created_at: string | null
}

type Stats = {
  assigned: number
  completed: number
  paid: number
  unpaid: number
}

export default function WorkerDashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats>({
    assigned: 0,
    completed: 0,
    paid: 0,
    unpaid: 0,
  })
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    setErrorMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      setErrorMessage(userError.message)
      setLoading(false)
      return
    }

    if (!user) {
      setErrorMessage('You must be logged in to view your dashboard.')
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
        assigned_worker_id,
        created_at
      `
      )
      .eq('assigned_worker_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      setJobs([])
      setLoading(false)
      return
    }

    const loadedJobs = (data as Job[]) || []

    setJobs(loadedJobs)
    setStats({
      assigned: loadedJobs.filter((job) => job.status === 'assigned').length,
      completed: loadedJobs.filter((job) => job.status === 'completed').length,
      paid: loadedJobs.filter((job) => job.payment_status === 'paid').length,
      unpaid: loadedJobs.filter((job) => job.payment_status !== 'paid').length,
    })

    setLoading(false)
  }

  function formatDate(value: string | null) {
    if (!value) return 'Not listed'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return 'Not listed'
    }

    return date.toLocaleDateString()
  }

  function jobStatusTone(status: string | null) {
    if (status === 'completed') {
      return 'bg-blue-100 text-blue-700'
    }

    if (status === 'assigned') {
      return 'bg-blue-100 text-blue-700'
    }

    if (status === 'cancelled') {
      return 'bg-red-100 text-red-700'
    }

    return 'bg-slate-100 text-slate-700'
  }

  function paymentTone(paymentStatus: string | null) {
    if (paymentStatus === 'paid') {
      return 'bg-emerald-100 text-emerald-700'
    }

    if (paymentStatus === 'pending') {
      return 'bg-orange-100 text-orange-700'
    }

    return 'bg-yellow-100 text-yellow-700'
  }

  function paymentLabel(paymentStatus: string | null) {
    if (paymentStatus === 'paid') return 'Paid'
    if (paymentStatus === 'pending') return 'Pending'
    return 'Unpaid'
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-10">
        <LoadingSpinner label="Loading worker dashboard..." />
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-950">
            Worker Dashboard
          </h1>

          <p className="mt-2 text-base text-slate-600">
            Track assigned jobs, completed work, and payment status.
          </p>
        </div>

        <Link
          href="/invites"
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
        >
          View Invites
        </Link>
      </div>

      {errorMessage && (
        <StatusCard
          title="Could not load dashboard"
          message={errorMessage}
          tone="danger"
        />
      )}

      {!errorMessage && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <StatCard label="Assigned" value={stats.assigned} />
            <StatCard label="Completed" value={stats.completed} />
            <StatCard label="Paid" value={stats.paid} />
            <StatCard label="Unpaid" value={stats.unpaid} />
          </section>

          {jobs.length === 0 ? (
            <div className="mt-8">
              <StatusCard
                title="No assigned jobs yet"
                message="When a company hires or assigns you to a job, it will show up here."
                actionText="Browse Jobs"
                actionHref="/jobs"
                tone="warning"
              />
            </div>
          ) : (
            <section className="mt-8 space-y-5">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-4 py-1 text-xs font-black uppercase ${jobStatusTone(
                            job.status
                          )}`}
                        >
                          {job.status || 'Unknown'}
                        </span>

                        <span
                          className={`rounded-full px-4 py-1 text-xs font-black uppercase ${paymentTone(
                            job.payment_status
                          )}`}
                        >
                          {paymentLabel(job.payment_status)}
                        </span>
                      </div>

                      <h2 className="mt-4 text-2xl font-black text-slate-950">
                        {job.title || 'Untitled Job'}
                      </h2>

                      <p className="mt-2 text-base text-slate-600">
                        {job.trade || 'Trade not listed'} •{' '}
                        {job.location || 'Location not listed'}
                      </p>

                      <div className="mt-3 space-y-1 text-base text-slate-600">
                        <p>
                          <span className="font-semibold text-slate-800">
                            Pay:
                          </span>{' '}
                          {job.pay_rate || 'Not listed'}
                        </p>

                        <p>
                          <span className="font-semibold text-slate-800">
                            Start Date:
                          </span>{' '}
                          {formatDate(job.start_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="rounded-xl border border-slate-900 px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100"
                      >
                        View Job
                      </Link>

                      <Link
                        href={`/messages?jobId=${job.id}`}
                        className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
                      >
                        Messages
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <p className="text-base font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
    </div>
  )
}