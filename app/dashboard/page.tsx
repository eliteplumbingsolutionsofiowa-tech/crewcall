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
      .select(`
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
      `)
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
      return 'bg-emerald-100 text-emerald-700'
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
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-100 px-6 py-10">
        <LoadingSpinner label="Loading worker dashboard..." />
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-orange-100 px-4 py-10">
      <div className="absolute left-[-120px] top-20 h-72 w-72 rounded-full bg-blue-300/30 blur-3xl" />
      <div className="absolute right-[-100px] top-40 h-72 w-72 rounded-full bg-orange-300/30 blur-3xl" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-600">
              CrewCall Worker
            </p>

            <h1 className="mt-2 text-5xl font-black tracking-tight text-slate-950">
              Dashboard
            </h1>

            <p className="mt-3 max-w-2xl text-lg text-slate-600">
              Track your assigned work, completed jobs, and payments in one place.
            </p>
          </div>

          <Link
            href="/invites"
            className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-sm font-black text-white shadow-xl shadow-blue-500/20 transition hover:scale-[1.02]"
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
            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Assigned"
                value={stats.assigned}
                gradient="from-blue-500 to-cyan-500"
              />

              <StatCard
                label="Completed"
                value={stats.completed}
                gradient="from-emerald-500 to-green-500"
              />

              <StatCard
                label="Paid"
                value={stats.paid}
                gradient="from-purple-500 to-indigo-500"
              />

              <StatCard
                label="Unpaid"
                value={stats.unpaid}
                gradient="from-orange-500 to-red-500"
              />
            </section>

            {jobs.length === 0 ? (
              <div className="mt-10">
                <StatusCard
                  title="No assigned jobs yet"
                  message="When a company hires or assigns you to a job, it will show up here."
                  actionText="Browse Jobs"
                  actionHref="/jobs"
                  tone="warning"
                />
              </div>
            ) : (
              <section className="mt-10 space-y-6">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-2xl shadow-slate-900/5 backdrop-blur"
                  >
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-3">
                          <span
                            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${jobStatusTone(
                              job.status
                            )}`}
                          >
                            {job.status || 'Unknown'}
                          </span>

                          <span
                            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${paymentTone(
                              job.payment_status
                            )}`}
                          >
                            {paymentLabel(job.payment_status)}
                          </span>
                        </div>

                        <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
                          {job.title || 'Untitled Job'}
                        </h2>

                        <p className="mt-2 text-lg text-slate-600">
                          {job.trade || 'Trade not listed'} •{' '}
                          {job.location || 'Location not listed'}
                        </p>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                              Pay Rate
                            </p>

                            <p className="mt-2 text-xl font-black text-slate-950">
                              {job.pay_rate || 'Not listed'}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                              Start Date
                            </p>

                            <p className="mt-2 text-xl font-black text-slate-950">
                              {formatDate(job.start_date)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 lg:w-[260px] lg:flex-col">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center text-sm font-black text-slate-900 shadow-sm transition hover:scale-[1.02] hover:bg-slate-50"
                        >
                          View Job
                        </Link>

                        <Link
                          href={`/messages?jobId=${job.id}`}
                          className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-4 text-center text-sm font-black text-white shadow-xl shadow-blue-500/20 transition hover:scale-[1.02]"
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
      </div>
    </main>
  )
}

function StatCard({
  label,
  value,
  gradient,
}: {
  label: string
  value: number
  gradient: string
}) {
  return (
    <div
      className={`rounded-[2rem] bg-gradient-to-br ${gradient} p-6 text-white shadow-2xl`}
    >
      <p className="text-sm font-black uppercase tracking-[0.25em] text-white/80">
        {label}
      </p>

      <p className="mt-5 text-5xl font-black tracking-tight">{value}</p>
    </div>
  )
}