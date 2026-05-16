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
  payment_status: string | null
  payout_status: string | null
  company_id: string | null
  assigned_worker_id: string | null

  company_name?: string | null
  worker_name?: string | null

  review_target_id?: string | null
  review_target_name?: string | null

  already_reviewed?: boolean
}

type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
}

type ExistingReview = {
  job_id: string
}

function formatDate(value: string | null) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleDateString()
}

export default function CompletedJobsPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadJobs()
  }, [])

  async function loadJobs() {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to view completed jobs.')
      setJobs([])
      setLoading(false)
      return
    }

    setCurrentUserId(user.id)

    const { data: jobsData, error: jobsError } = await supabase
      .from('jobs')
      .select(
        `
        id,
        title,
        trade,
        location,
        pay_rate,
        start_date,
        payment_status,
        payout_status,
        company_id,
        assigned_worker_id
      `
      )
      .or(`company_id.eq.${user.id},assigned_worker_id.eq.${user.id}`)
      .eq('status', 'completed')
      .order('start_date', { ascending: false })

    if (jobsError) {
      setMessage(jobsError.message)
      setJobs([])
      setLoading(false)
      return
    }

    const rawJobs = (jobsData || []) as Job[]

    const profileIds = Array.from(
      new Set(
        rawJobs
          .flatMap((job) => [job.company_id, job.assigned_worker_id])
          .filter((id): id is string => Boolean(id))
      )
    )

    let profileMap = new Map<string, Profile>()

    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, company_name')
        .in('id', profileIds)

      profileMap = new Map(
        ((profiles || []) as Profile[]).map((profile) => [
          profile.id,
          profile,
        ])
      )
    }

    const { data: existingReviews } = await supabase
      .from('reviews')
      .select('job_id')
      .eq('reviewer_id', user.id)

    const reviewedJobIds = new Set(
      ((existingReviews || []) as ExistingReview[]).map(
        (review) => review.job_id
      )
    )

    const mergedJobs = rawJobs.map((job) => {
      const company = job.company_id
        ? profileMap.get(job.company_id)
        : null

      const worker = job.assigned_worker_id
        ? profileMap.get(job.assigned_worker_id)
        : null

      const companyName =
        company?.company_name || company?.full_name || 'Company'

      const workerName =
        worker?.full_name || worker?.company_name || 'Worker'

      const reviewTargetId =
        user.id === job.company_id
          ? job.assigned_worker_id
          : job.company_id

      const reviewTargetName =
        reviewTargetId === job.assigned_worker_id
          ? workerName
          : companyName

      return {
        ...job,
        company_name: companyName,
        worker_name: workerName,
        review_target_id: reviewTargetId || null,
        review_target_name: reviewTargetName || 'CrewCall User',
        already_reviewed: reviewedJobIds.has(job.id),
      }
    })

    setJobs(mergedJobs)
    setLoading(false)
  }

  function badge(label: string, value: string | null | undefined) {
    const clean = value || 'unknown'

    const classes =
      clean === 'paid' || clean === 'released'
        ? 'border-green-200 bg-green-50 text-green-700'
        : 'border-yellow-200 bg-yellow-50 text-yellow-800'

    return (
      <span
        className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${classes}`}
      >
        {label}: {clean}
      </span>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-100 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-xl">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-600">
            Job Archive
          </p>

          <h1 className="mt-3 text-4xl font-black text-slate-950">
            Completed Jobs
          </h1>

          <p className="mt-3 text-lg text-slate-600">
            Review completed work, payout status, and job history.
          </p>
        </section>

        {message && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            Loading completed jobs...
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-8 shadow-sm">
            <h2 className="text-xl font-black text-yellow-900">
              No completed jobs yet
            </h2>

            <p className="mt-2 text-yellow-800">
              Completed jobs will show here once work is finished.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-xl"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-950">
                      {job.title || 'Untitled Job'}
                    </h2>

                    <p className="mt-2 text-slate-600">
                      {job.trade || 'Trade not listed'} •{' '}
                      {job.location || 'Location not listed'}
                    </p>

                    <div className="mt-4 grid gap-2 text-sm text-slate-700">
                      {job.company_id && (
                        <p>
                          Company:{' '}
                          <Link
                            href={`/profile?user=${job.company_id}`}
                            className="font-bold text-blue-700 hover:underline"
                          >
                            {job.company_name}
                          </Link>
                        </p>
                      )}

                      {job.assigned_worker_id && (
                        <p>
                          Worker:{' '}
                          <Link
                            href={`/profile?user=${job.assigned_worker_id}`}
                            className="font-bold text-blue-700 hover:underline"
                          >
                            {job.worker_name}
                          </Link>
                        </p>
                      )}

                      <p>Pay: {job.pay_rate || 'Not listed'}</p>

                      <p>Start: {formatDate(job.start_date)}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {badge('Payment', job.payment_status)}
                      {badge('Payout', job.payout_status)}

                      {job.already_reviewed && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700">
                          Reviewed
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 lg:w-[240px] lg:flex-col">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="rounded-xl border border-blue-600 px-4 py-3 text-center text-sm font-bold text-blue-600 hover:bg-blue-50"
                    >
                      View Job
                    </Link>

                    {job.review_target_id ? (
                      job.already_reviewed ? (
                        <button
                          disabled
                          className="cursor-not-allowed rounded-xl bg-gray-300 px-4 py-3 text-center text-sm font-bold text-gray-600"
                        >
                          Review Submitted
                        </button>
                      ) : (
                        <Link
                          href={`/jobs/${job.id}/review?to=${job.review_target_id}`}
                          className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-blue-700"
                        >
                          Review {job.review_target_name}
                        </Link>
                      )
                    ) : (
                      <button
                        disabled
                        className="cursor-not-allowed rounded-xl bg-gray-300 px-4 py-3 text-center text-sm font-bold text-gray-600"
                      >
                        Review unavailable
                      </button>
                    )}

                    {currentUserId && job.review_target_id && (
                      <Link
                        href={`/profile?user=${job.review_target_id}`}
                        className="rounded-xl border border-orange-500 px-4 py-3 text-center text-sm font-bold text-orange-600 hover:bg-orange-50"
                      >
                        View Their Profile
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}