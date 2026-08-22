'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  company_id: string | null
  assigned_worker_id: string | null
  status: string | null
  payment_status: string | null
}

type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
  role: string | null
}

type ExistingReview = {
  id: string
}

type ReviewInsert = {
  job_id: string
  reviewer_id: string
  reviewee_id: string
  rating: number
  comment: string | null
}

function getProfileName(profile: Profile | null) {
  if (!profile) return 'CrewCall user'
  return profile.company_name || profile.full_name || 'CrewCall user'
}

function ReviewContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()

  const jobId = String(params.id || '')
  const explicitToUserId = searchParams.get('to')

  const [job, setJob] = useState<Job | null>(null)
  const [reviewee, setReviewee] = useState<Profile | null>(null)
  const [toUserId, setToUserId] = useState<string | null>(explicitToUserId)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  const loadReviewData = useCallback(async () => {
    setLoading(true)
    setMessage('')
    setSuccess(false)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to leave a review.')
      setLoading(false)
      return
    }

    if (!jobId) {
      setMessage('Missing job information.')
      setLoading(false)
      return
    }

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, company_id, assigned_worker_id, status, payment_status')
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

    if (!isCompany && !isWorker) {
      setMessage('You can only review jobs you were part of.')
      setLoading(false)
      return
    }

    if (!jobData.company_id || !jobData.assigned_worker_id) {
      setMessage('This job is missing company or worker information.')
      setLoading(false)
      return
    }

    const automaticToUserId = isCompany
      ? jobData.assigned_worker_id
      : jobData.company_id

    const finalToUserId = explicitToUserId || automaticToUserId

    const validReviewTarget =
      finalToUserId === jobData.company_id ||
      finalToUserId === jobData.assigned_worker_id

    if (!validReviewTarget || finalToUserId === user.id) {
      setMessage('Invalid review target.')
      setLoading(false)
      return
    }

    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('job_id', jobData.id)
      .eq('reviewer_id', user.id)
      .eq('reviewee_id', finalToUserId)
      .returns<ExistingReview[]>()
      .maybeSingle()

    if (existingReview?.id) {
      setMessage('You already reviewed this user for this job.')
    }

    setJob(jobData)
    setToUserId(finalToUserId)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, role')
      .eq('id', finalToUserId)
      .returns<Profile[]>()
      .maybeSingle()

    setReviewee(profileData || null)
    setLoading(false)
  }, [jobId, explicitToUserId])

  useEffect(() => {
    loadReviewData()
  }, [loadReviewData])

  async function submitReview() {
    if (!job || !toUserId) {
      setMessage('Missing review information.')
      return
    }

    setSaving(true)
    setMessage('')
    setSuccess(false)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to submit a review.')
      setSaving(false)
      return
    }

    const reviewInsert: ReviewInsert = {
      job_id: job.id,
      reviewer_id: user.id,
      reviewee_id: toUserId,
      rating,
      comment: comment.trim() || null,
    }

    const { error } = await supabase.from('reviews').insert(reviewInsert as never)

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    setSuccess(true)
    setMessage('Review submitted successfully.')

    window.dispatchEvent(new Event('crewcall-refresh-nav'))

    setTimeout(() => {
      router.push(`/profile?user=${toUserId}`)
    }, 800)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black">Loading review...</p>
        </div>
      </main>
    )
  }

  const revieweeName = getProfileName(reviewee)

  const blockingMessage =
    message.includes('Missing') ||
    message.includes('Invalid') ||
    message.includes('only review') ||
    message.includes('logged in') ||
    message.includes('already reviewed') ||
    message.includes('missing company or worker')

  const showReviewForm = !blockingMessage && !success

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur">
        <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/10 p-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
            Completed Job Review
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
            Review {revieweeName}
          </h1>

          {job?.title && (
            <p className="mt-3 text-sm font-semibold text-slate-300">
              Job:{' '}
              <span className="font-black text-white">
                {job.title}
              </span>
            </p>
          )}

          {job && (
            <div className="mt-5 flex flex-wrap gap-3">
              <StatusPill value={job.status || 'open'} />
              <StatusPill value={job.payment_status || 'unpaid'} />
            </div>
          )}
        </div>

        <div className="p-8">
          {message && (
            <div
              className={`rounded-3xl border px-5 py-4 text-sm font-bold ${
                success
                  ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
                  : blockingMessage
                    ? 'border-red-400/20 bg-red-400/10 text-red-100'
                    : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
              }`}
            >
              {message}
            </div>
          )}

          {showReviewForm && (
            <div className="mt-6">
              <label className="block text-sm font-black text-slate-200">
                Rating
              </label>

              <select
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
              >
                {[5, 4, 3, 2, 1].map((number) => (
                  <option key={number} value={number}>
                    {number} Stars
                  </option>
                ))}
              </select>

              <label className="mt-5 block text-sm font-black text-slate-200">
                Review
              </label>

              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={6}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                placeholder="How did the job go?"
              />

              <button
                type="button"
                onClick={submitReview}
                disabled={saving}
                className="mt-6 rounded-2xl bg-blue-500 px-6 py-4 text-sm font-black text-white shadow-xl shadow-blue-500/20 transition hover:scale-[1.02] hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/completed-jobs"
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
            >
              Back to Completed Jobs
            </Link>

            {job && (
              <Link
                href={`/jobs/${job.id}`}
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
              >
                View Job
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function StatusPill({ value }: { value: string }) {
  const lowered = value.toLowerCase()

  const classes =
    lowered.includes('paid') ||
    lowered.includes('completed') ||
    lowered.includes('released')
      ? 'bg-emerald-400/20 text-emerald-100 ring-emerald-300/20'
      : lowered.includes('pending') || lowered.includes('progress')
        ? 'bg-orange-400/20 text-orange-100 ring-orange-300/20'
        : lowered.includes('unpaid')
          ? 'bg-slate-400/10 text-slate-200 ring-slate-300/20'
          : 'bg-cyan-400/20 text-cyan-100 ring-cyan-300/20'

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ring-1 ${classes}`}
    >
      {value.replaceAll('_', ' ')}
    </span>
  )
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-10 text-white">
          <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
            <p className="text-lg font-black">Loading review...</p>
          </div>
        </main>
      }
    >
      <ReviewContent />
    </Suspense>
  )
}