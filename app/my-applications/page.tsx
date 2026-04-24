'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Application = {
  id: string
  status: string
  created_at: string
  jobs: {
    id: string
    title: string
    trade: string
    location: string
    pay_rate: string | null
    start_date: string | null
    status: string
    company_id: string
    hired_worker_id: string | null
    company: {
      full_name: string | null
      company_name: string | null
    } | null
  } | null
}

type Review = {
  id: string
  job_id: string
  reviewer_id: string
  reviewee_id: string
  rating: number
  comment: string | null
}

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [ratingByJob, setRatingByJob] = useState<Record<string, number>>({})
  const [commentByJob, setCommentByJob] = useState<Record<string, string>>({})
  const [savingJobId, setSavingJobId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadApplications() {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setApplications([])
        setLoading(false)
        return
      }

      setUserId(user.id)

      const { data } = await supabase
        .from('applications')
        .select(`
          id,
          status,
          created_at,
          jobs (
            id,
            title,
            trade,
            location,
            pay_rate,
            start_date,
            status,
            company_id,
            hired_worker_id,
            company:company_id (
              full_name,
              company_name
            )
          )
        `)
        .eq('worker_id', user.id)
        .order('created_at', { ascending: false })

      const applicationList = (data as Application[]) || []
      setApplications(applicationList)

      const jobIds = applicationList
        .map((app) => app.jobs?.id)
        .filter(Boolean) as string[]

      if (jobIds.length > 0) {
        const { data: reviewData } = await supabase
          .from('reviews')
          .select('id, job_id, reviewer_id, reviewee_id, rating, comment')
          .eq('reviewer_id', user.id)
          .in('job_id', jobIds)

        setReviews((reviewData as Review[]) || [])
      }

      setLoading(false)
    }

    loadApplications()
  }, [])

  async function submitCompanyReview(jobId: string, companyId: string) {
    if (!userId) return

    setSavingJobId(jobId)
    setErrorMessage(null)

    const rating = ratingByJob[jobId] || 5
    const comment = commentByJob[jobId]?.trim() || null

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        job_id: jobId,
        reviewer_id: userId,
        reviewee_id: companyId,
        rating,
        comment,
      })
      .select('id, job_id, reviewer_id, reviewee_id, rating, comment')
      .single()

    if (error) {
      console.error(error)
      setErrorMessage('Could not submit company review.')
      setSavingJobId(null)
      return
    }

    setReviews((prev) => [...prev, data as Review])
    setSavingJobId(null)
  }

  if (loading) {
    return <div className="p-6">Loading your applications...</div>
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Applications</h1>
        <p className="mt-2 text-gray-600">
          Track jobs you applied to and review companies after completed work.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {errorMessage}
        </div>
      )}

      {applications.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-gray-600">You have not applied to any jobs yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((application) => {
            const job = application.jobs
            if (!job) return null

            const companyName =
              job.company?.company_name ||
              job.company?.full_name ||
              'Company'

            const isHired =
              application.status === 'hired' ||
              job.hired_worker_id === userId

            const isCompleted = job.status === 'completed'
            const existingReview = reviews.find(
              (review) =>
                review.job_id === job.id &&
                review.reviewer_id === userId &&
                review.reviewee_id === job.company_id
            )

            return (
              <div
                key={application.id}
                className="rounded-2xl border bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {job.title}
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      {job.trade} • {job.location}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Company: {companyName}
                    </p>

                    <div className="mt-3 space-y-1 text-sm text-gray-600">
                      <p>
                        <span className="font-medium text-gray-900">Pay:</span>{' '}
                        {job.pay_rate || 'Not listed'}
                      </p>
                      <p>
                        <span className="font-medium text-gray-900">
                          Start Date:
                        </span>{' '}
                        {job.start_date || 'Not listed'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-2 md:items-end">
                    {isCompleted && isHired ? (
                      <span className="rounded-full bg-gray-200 px-3 py-1 text-sm font-semibold text-gray-700">
                        Completed
                      </span>
                    ) : isHired ? (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                        Hired
                      </span>
                    ) : application.status === 'rejected' ? (
                      <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                        Not Selected
                      </span>
                    ) : (
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-700">
                        Pending
                      </span>
                    )}

                    <Link
                      href={`/jobs/${job.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      View Job
                    </Link>

                    <Link
                      href={`/profiles/${job.company_id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      View Company
                    </Link>
                  </div>
                </div>

                {isCompleted && isHired && (
                  <div className="mt-5 rounded-xl border bg-gray-50 p-4">
                    <h3 className="font-bold text-gray-900">Review Company</h3>

                    {existingReview ? (
                      <div className="mt-3 rounded-xl bg-green-50 p-4 text-green-800">
                        <p className="font-semibold">
                          Review submitted: {'⭐'.repeat(existingReview.rating)}
                        </p>
                        {existingReview.comment && (
                          <p className="mt-2">{existingReview.comment}</p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <select
                          value={ratingByJob[job.id] || 5}
                          onChange={(e) =>
                            setRatingByJob((prev) => ({
                              ...prev,
                              [job.id]: Number(e.target.value),
                            }))
                          }
                          className="rounded-xl border px-4 py-2"
                        >
                          <option value={5}>5 Stars</option>
                          <option value={4}>4 Stars</option>
                          <option value={3}>3 Stars</option>
                          <option value={2}>2 Stars</option>
                          <option value={1}>1 Star</option>
                        </select>

                        <textarea
                          value={commentByJob[job.id] || ''}
                          onChange={(e) =>
                            setCommentByJob((prev) => ({
                              ...prev,
                              [job.id]: e.target.value,
                            }))
                          }
                          placeholder="How was this company to work for?"
                          className="min-h-24 w-full rounded-xl border px-4 py-3"
                        />

                        <button
                          onClick={() =>
                            submitCompanyReview(job.id, job.company_id)
                          }
                          disabled={savingJobId === job.id}
                          className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white disabled:opacity-50"
                        >
                          {savingJobId === job.id
                            ? 'Submitting...'
                            : 'Submit Company Review'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}