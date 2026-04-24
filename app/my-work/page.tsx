'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  location: string | null
  trade: string | null
  pay_rate: string | null
  status: string | null
  company_id: string | null
  profiles: {
    full_name: string | null
    company_name: string | null
  } | null
}

function formatTrade(trade: string | null) {
  if (!trade) return 'Not listed'

  return String(trade)
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function formatStatus(status: string | null) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

function formatPay(payRate: string | null) {
  if (!payRate) return 'Not set'

  const value = String(payRate).trim()

  if (
    value.toLowerCase().includes('/hr') ||
    value.toLowerCase().includes('/hour')
  ) {
    return value.startsWith('$') ? value : `$${value}`
  }

  const cleaned = value.replace(/[^0-9.]/g, '')
  if (!cleaned) return value

  const num = Number(cleaned)
  if (!Number.isFinite(num)) return value

  return `$${num.toFixed(2)}`
}

export default function MyWorkPage() {
  const [loading, setLoading] = useState(true)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])

  useEffect(() => {
    async function loadWork() {
      setLoading(true)
      setErrorMessage(null)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      const user = session?.user

      if (sessionError) {
        setErrorMessage(sessionError.message)
        setLoading(false)
        return
      }

      if (!user) {
        setNeedsLogin(true)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('jobs')
        .select(
          `
          id,
          title,
          location,
          trade,
          pay_rate,
          status,
          company_id,
          profiles:company_id (
            full_name,
            company_name
          )
          `
        )
        .eq('assigned_to', user.id)
        .in('status', ['assigned', 'completed'])
        .order('created_at', { ascending: false })

      if (error) {
        setErrorMessage(error.message)
        setLoading(false)
        return
      }

      setJobs((data || []) as Job[])
      setLoading(false)
    }

    loadWork()
  }, [])

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-4xl font-bold">My Work</h1>
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          Loading work...
        </div>
      </main>
    )
  }

  if (needsLogin) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-4xl font-bold">My Work</h1>
        <div className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
          You must be logged in to view your work.
        </div>
      </main>
    )
  }

  if (errorMessage) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-4xl font-bold">My Work</h1>
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          Failed to load work: {errorMessage}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-4xl font-bold">My Work</h1>

      <div className="mt-8 grid gap-6">
        {jobs.length === 0 ? (
          <div className="rounded-3xl border bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold">No assigned jobs yet</h2>
            <p className="mt-2 text-gray-600">
              Once you get hired for a job, it will show up here.
            </p>
            <div className="mt-5">
              <Link
                href="/jobs"
                className="rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white"
              >
                Browse Jobs
              </Link>
            </div>
          </div>
        ) : (
          jobs.map((job) => {
            const isCompleted = job.status === 'completed'
            const companyName =
              job.profiles?.company_name ||
              job.profiles?.full_name ||
              'Company'

            return (
              <div
                key={job.id}
                className="rounded-3xl border bg-white p-8 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {job.title || 'Untitled Job'}
                    </h2>

                    <div className="mt-3 space-y-2 text-gray-700">
                      <div>
                        <span className="font-semibold text-gray-900">
                          Company:
                        </span>{' '}
                        {companyName}
                      </div>

                      <div>
                        <span className="font-semibold text-gray-900">
                          Location:
                        </span>{' '}
                        {job.location || 'No location listed'}
                      </div>

                      <div>
                        <span className="font-semibold text-gray-900">
                          Trade:
                        </span>{' '}
                        {formatTrade(job.trade)}
                      </div>

                      <div>
                        <span className="font-semibold text-gray-900">Pay:</span>{' '}
                        {formatPay(job.pay_rate)}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                      isCompleted
                        ? 'border-blue-200 bg-blue-100 text-blue-700'
                        : 'border-green-200 bg-green-100 text-green-700'
                    }`}
                  >
                    {formatStatus(job.status)}
                  </div>
                </div>

                {isCompleted && (
                  <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-800">
                    This job has been marked completed.
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white"
                  >
                    View Job
                  </Link>

                  <Link
                    href="/messages"
                    className="rounded-2xl border px-5 py-3 text-sm font-medium hover:bg-gray-50"
                  >
                    Open Messages
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}