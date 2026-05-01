'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string
  trade: string | null
  location: string | null
  pay_rate: string | null
  start_date: string | null
  status: string | null
  payment_status: string | null
}

type Stats = {
  assigned: number
  completed: number
  paid: number
  unpaid: number
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

  useEffect(() => {
    loadJobs()
  }, [])

  async function loadJobs() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data } = await supabase
      .from('jobs')
      .select(
        'id, title, trade, location, pay_rate, start_date, status, payment_status'
      )
      .eq('assigned_worker_id', user.id)

    const jobList = (data || []) as Job[]
    setJobs(jobList)

    setStats({
      assigned: jobList.filter((j) => j.status === 'assigned').length,
      completed: jobList.filter((j) => j.status === 'completed').length,
      paid: jobList.filter((j) => j.payment_status === 'paid').length,
      unpaid: jobList.filter((j) => j.payment_status !== 'paid').length,
    })
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        {/* HEADER */}
        <section className="mb-8 rounded-2xl border bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Worker Dashboard</h1>
              <p className="text-gray-600 mt-2">
                Track assigned jobs, completed work, and payment status.
              </p>
            </div>

            <Link
              href="/invites"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              View Invites
            </Link>
          </div>
        </section>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
              <p className="text-gray-500 text-sm">{s.label}</p>
              <p className="text-2xl font-bold mt-2">{s.value}</p>
            </div>
          ))}
        </div>

        {/* JOBS */}
        <div className="space-y-6">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-2xl border bg-white p-6 shadow-sm flex justify-between items-center"
            >
              <div>
                <h2 className="text-xl font-bold">{job.title}</h2>
                <p className="text-gray-600 text-sm">
                  {job.trade} • {job.location}
                </p>
                <p className="text-sm mt-2">Pay: {job.pay_rate}</p>
                <p className="text-sm">
                  Start: {formatDate(job.start_date)}
                </p>
              </div>

              <div className="flex gap-3">
                {/* FIXED BUTTONS */}
                <Link
                  href={`/jobs/${job.id}`}
                  className="rounded-xl border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                >
                  View Job
                </Link>

                <Link
                  href={`/messages`}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Messages
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}