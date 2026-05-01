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
  payment_status: string | null
}

function formatDate(value: string | null) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleDateString()
}

export default function CompletedJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

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
        'id, title, trade, location, pay_rate, start_date, payment_status'
      )
      .or(`company_id.eq.${user.id},assigned_worker_id.eq.${user.id}`)
      .eq('status', 'completed')
      .order('start_date', { ascending: false })

    setJobs((data || []) as Job[])
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold mb-6">Completed Jobs</h1>

        {loading ? (
          <p>Loading...</p>
        ) : jobs.length === 0 ? (
          <p>No completed jobs yet.</p>
        ) : (
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
                  {/* VIEW JOB */}
                  <Link
                    href={`/jobs/${job.id}`}
                    className="rounded-xl border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    View Job
                  </Link>

                  {/* ⭐ LEAVE REVIEW BUTTON */}
                  <Link
                    href={`/jobs/${job.id}/review`}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Leave Review
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}