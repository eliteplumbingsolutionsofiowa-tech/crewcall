'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  company_id: string | null
  assigned_worker_id: string | null
}

type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
}

function ReviewContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()

  const jobId = String(params.id || '')
  const toUserId = searchParams.get('to')

  const [job, setJob] = useState<Job | null>(null)
  const [reviewee, setReviewee] = useState<Profile | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadReviewData()
  }, [jobId, toUserId])

  async function loadReviewData() {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to leave a review.')
      setLoading(false)
      return
    }

    if (!jobId || !toUserId) {
      setMessage('Missing review information.')
      setLoading(false)
      return
    }

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, company_id, assigned_worker_id')
      .eq('id', jobId)
      .returns<Job[]>()
      .maybeSingle()

    if (jobError || !jobData) {
      setMessage(jobError?.message || 'Job not found.')
      setLoading(false)
      return
    }

    const isCompany = user.id === jobData.company_id
    const isWorker = user.id === jobData.assigned_worker_id
    const validReviewTarget =
      toUserId === jobData.company_id || toUserId === jobData.assigned_worker_id

    if (!isCompany && !isWorker) {
      setMessage('You can only review jobs you were part of.')
      setLoading(false)
      return
    }

    if (!validReviewTarget || toUserId === user.id) {
      setMessage('Invalid review target.')
      setLoading(false)
      return
    }

    setJob(jobData)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, company_name')
      .eq('id', toUserId)
      .returns<Profile[]>()
      .maybeSingle()

    setReviewee(profileData || null)
    setLoading(false)
  }

  async function submitReview() {
    if (!job || !toUserId) return

    setSaving(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to submit a review.')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('reviews').insert({
      job_id: job.id,
      reviewer_id: user.id,
      reviewee_id: toUserId,
      rating,
      comment: comment.trim() || null,
    } as never)

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    router.push(`/profile?user=${toUserId}`)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-10">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow">
          Loading review...
        </div>
      </main>
    )
  }

  const revieweeName =
    reviewee?.company_name || reviewee?.full_name || 'CrewCall user'

  const showReviewForm =
    !message.includes('Missing') &&
    !message.includes('Invalid') &&
    !message.includes('only review') &&
    !message.includes('logged in')

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
          Completed Job Review
        </p>

        <h1 className="mt-2 text-3xl font-black text-gray-950">
          Review {revieweeName}
        </h1>

        {job?.title ? (
          <p className="mt-2 text-gray-600">
            Job: <span className="font-semibold">{job.title}</span>
          </p>
        ) : null}

        {message ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {message}
          </div>
        ) : null}

        {showReviewForm ? (
          <div className="mt-6">
            <label className="block text-sm font-bold text-gray-800">
              Rating
            </label>

            <select
              value={rating}
              onChange={(event) => setRating(Number(event.target.value))}
              className="mt-2 w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-blue-500"
            >
              {[5, 4, 3, 2, 1].map((number) => (
                <option key={number} value={number}>
                  {number} Stars
                </option>
              ))}
            </select>

            <label className="mt-5 block text-sm font-bold text-gray-800">
              Comment
            </label>

            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={5}
              className="mt-2 w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-blue-500"
              placeholder="How did the job go?"
            />

            <button
              type="button"
              onClick={submitReview}
              disabled={saving}
              className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        ) : null}

        <div className="mt-6">
          <Link
            href="/completed-jobs"
            className="text-sm font-bold text-blue-600 hover:underline"
          >
            Back to completed jobs
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 px-6 py-10">
          <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow">
            Loading review...
          </div>
        </main>
      }
    >
      <ReviewContent />
    </Suspense>
  )
}