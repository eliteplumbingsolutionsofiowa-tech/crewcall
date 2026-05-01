'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Review = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer_id: string
  reviewer: {
    full_name: string | null
    company_name: string | null
    role: string | null
  } | null
}

export default function ProfileReviews({
  profileId,
  jobId,
}: {
  profileId?: string
  jobId?: string // 👈 NEW: allows leaving review after job
}) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // ⭐ NEW REVIEW STATE
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [canReview, setCanReview] = useState(false)

  useEffect(() => {
    loadReviews()
  }, [profileId])

  async function loadReviews() {
    setLoading(true)
    setErrorMessage(null)

    let targetProfileId = profileId

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!targetProfileId) {
      if (!user) {
        setLoading(false)
        return
      }
      targetProfileId = user.id
    }

    // LOAD REVIEWS
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        reviewer_id,
        reviewer:reviewer_id (
          full_name,
          company_name,
          role
        )
      `)
      .eq('reviewee_id', targetProfileId)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      setLoading(false)
      return
    }

    const cleaned = (data || []).map((r: any) => ({
      ...r,
      reviewer: Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer,
    }))

    setReviews(cleaned as Review[])

    // 🔥 CHECK IF USER CAN REVIEW (job completed + not already reviewed)
    if (user && jobId && targetProfileId !== user.id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('status, assigned_worker_id, company_id')
        .eq('id', jobId)
        .maybeSingle()

      if (job?.status === 'completed') {
        const { data: existing } = await supabase
          .from('reviews')
          .select('id')
          .eq('job_id', jobId)
          .eq('reviewer_id', user.id)
          .maybeSingle()

        if (!existing) {
          setCanReview(true)
        }
      }
    }

    setLoading(false)
  }

  async function submitReview() {
    setSubmitting(true)
    setErrorMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !profileId || !jobId) {
      setErrorMessage('Missing review data.')
      setSubmitting(false)
      return
    }

    const { error } = await supabase.from('reviews').insert({
      reviewer_id: user.id,
      reviewee_id: profileId,
      job_id: jobId,
      rating,
      comment,
    })

    if (error) {
      setErrorMessage(error.message)
      setSubmitting(false)
      return
    }

    setRating(5)
    setComment('')
    setCanReview(false)

    await loadReviews()
    setSubmitting(false)
  }

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0
    return (
      reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    )
  }, [reviews])

  function renderStars(rating: number) {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating)
  }

  function getName(r: Review) {
    return (
      r.reviewer?.company_name ||
      r.reviewer?.full_name ||
      'User'
    )
  }

  if (loading) return <div>Loading reviews...</div>

  return (
    <div className="rounded-3xl border bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-bold">Reviews</h2>

      {/* ⭐ SUMMARY */}
      <div className="mt-3 flex items-center gap-3">
        <span className="text-xl font-bold">
          {reviews.length ? averageRating.toFixed(1) : '—'}
        </span>
        <span className="text-yellow-500">
          {reviews.length
            ? renderStars(Math.round(averageRating))
            : 'No ratings'}
        </span>
        <span className="text-sm text-gray-500">
          ({reviews.length})
        </span>
      </div>

      {/* 🔥 LEAVE REVIEW */}
      {canReview && (
        <div className="mt-6 rounded-xl border p-4">
          <h3 className="font-semibold mb-2">Leave a Review</h3>

          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="mb-2 w-full border rounded px-3 py-2"
          >
            {[5,4,3,2,1].map((n) => (
              <option key={n} value={n}>{n} Stars</option>
            ))}
          </select>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write feedback..."
            className="w-full border rounded px-3 py-2 mb-2"
          />

          <button
            onClick={submitReview}
            disabled={submitting}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      )}

      {/* LIST */}
      <div className="mt-6 space-y-4">
        {reviews.length === 0 ? (
          <div className="text-gray-500">No reviews yet</div>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="border rounded p-4">
              <div className="flex justify-between">
                <div>
                  <div className="font-semibold">{getName(r)}</div>
                  <div className="text-yellow-500">
                    {renderStars(r.rating)}
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  {new Date(r.created_at).toLocaleDateString()}
                </div>
              </div>

              <p className="mt-2 text-sm text-gray-700">
                {r.comment || 'No comment'}
              </p>
            </div>
          ))
        )}
      </div>

      {errorMessage && (
        <div className="mt-4 text-red-600 text-sm">
          {errorMessage}
        </div>
      )}
    </div>
  )
}