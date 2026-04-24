'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  company_id: string | null
  status: string | null
}

type AcceptedApplication = {
  worker_id: string
}

export default function ReviewPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const jobId = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [alreadyReviewed, setAlreadyReviewed] = useState(false)

  const [job, setJob] = useState<Job | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [revieweeId, setRevieweeId] = useState<string | null>(null)

  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  useEffect(() => {
    async function loadPage() {
      if (!jobId) {
        setErrorMessage('Job ID is missing.')
        setLoading(false)
        return
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setErrorMessage('You must be logged in.')
        setLoading(false)
        return
      }

      setCurrentUserId(user.id)

      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, title, company_id, status')
        .eq('id', jobId)
        .maybeSingle()

      if (!jobData) {
        setErrorMessage('Job not found.')
        setLoading(false)
        return
      }

      setJob(jobData as Job)

      const { data: acceptedApp } = await supabase
        .from('job_applications')
        .select('worker_id')
        .eq('job_id', jobId)
        .eq('status', 'accepted')
        .maybeSingle()

      const accepted = acceptedApp as AcceptedApplication | null

      if (!accepted?.worker_id) {
        setErrorMessage('No accepted worker found.')
        setLoading(false)
        return
      }

      let reviewTarget = null

      if (user.id === jobData.company_id) {
        reviewTarget = accepted.worker_id
      } else if (user.id === accepted.worker_id) {
        reviewTarget = jobData.company_id
      } else {
        setErrorMessage('You are not part of this job.')
        setLoading(false)
        return
      }

      setRevieweeId(reviewTarget)

      // 🔥 CHECK IF ALREADY REVIEWED
      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('job_id', jobId)
        .eq('reviewer_id', user.id)
        .maybeSingle()

      if (existingReview) {
        setAlreadyReviewed(true)
      }

      setLoading(false)
    }

    loadPage()
  }, [jobId])

  async function handleSubmit() {
    if (!jobId || !currentUserId || !revieweeId) return

    setSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const { error } = await supabase.from('reviews').insert({
      job_id: jobId,
      reviewer_id: currentUserId,
      reviewee_id: revieweeId,
      rating,
      comment: comment.trim() || null,
    })

    if (error) {
      setErrorMessage(error.message)
      setSubmitting(false)
      return
    }

    setSuccessMessage('Review submitted!')
    setSubmitting(false)

    setTimeout(() => {
      router.push('/profile')
    }, 1000)
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-3xl border bg-white p-8 shadow-sm">
          Loading review page...
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6">
        <Link href={`/jobs/${jobId}`} className="text-sm text-blue-600 hover:underline">
          ← Back to Job
        </Link>
      </div>

      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold">Leave a Review</h1>

        <p className="mt-3 text-gray-600">
          Share feedback for {job?.title || 'this job'}.
        </p>

        {/* 🔥 Already reviewed */}
        {alreadyReviewed && (
          <div className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
            You already left a review for this job.
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700">
            {successMessage}
          </div>
        )}

        {/* 🔥 Disable form if already reviewed */}
        {!alreadyReviewed && (
          <>
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-900">
                Rating
              </label>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="mt-2 w-full rounded-2xl border px-4 py-3"
              >
                <option value={5}>5 - Excellent</option>
                <option value={4}>4 - Good</option>
                <option value={3}>3 - Okay</option>
                <option value={2}>2 - Poor</option>
                <option value={1}>1 - Bad</option>
              </select>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-900">
                Comment
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={5}
                className="mt-2 w-full rounded-2xl border px-4 py-3"
                placeholder="How did it go?"
              />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>

              <Link
                href={`/jobs/${jobId}`}
                className="rounded-2xl border px-5 py-3 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  )
}