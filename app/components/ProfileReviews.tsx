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

function renderStars(rating: number) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

export default function ProfileReviews({
  profileId,
}: {
  profileId?: string
}) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadReviews() {
      setLoading(true)
      setErrorMessage(null)

      let targetProfileId = profileId

      if (!targetProfileId) {
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
          setErrorMessage('You must be logged in to view reviews.')
          setLoading(false)
          return
        }

        targetProfileId = user.id
      }

      const { data, error } = await supabase
        .from('reviews')
        .select(
          `
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
        `
        )
        .eq('reviewee_id', targetProfileId)
        .order('created_at', { ascending: false })

      if (error) {
        setErrorMessage(error.message)
        setLoading(false)
        return
      }

      const cleanedReviews = (data || []).map((review: any) => ({
  ...review,
  reviewer: Array.isArray(review.reviewer)
    ? review.reviewer[0]
    : review.reviewer,
}))

setReviews(cleanedReviews as unknown as Review[])
      setLoading(false)
    }

    loadReviews()
  }, [profileId])

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0
    const total = reviews.reduce((sum, review) => sum + review.rating, 0)
    return total / reviews.length
  }, [reviews])

  function getReviewerName(review: Review) {
    return (
      review.reviewer?.company_name ||
      review.reviewer?.full_name ||
      'Reviewer'
    )
  }

  function getReviewerRole(review: Review) {
    if (review.reviewer?.role === 'company') return 'Company'
    if (review.reviewer?.role === 'worker') return 'Worker'
    return 'User'
  }

  if (loading) {
    return (
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold">Reviews</h2>
        <div className="mt-4 text-gray-500">Loading reviews...</div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8 shadow-sm">
        <h2 className="text-2xl font-bold">Reviews</h2>
        <div className="mt-4 text-red-700">{errorMessage}</div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reviews</h2>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-2xl font-bold text-gray-900">
              {reviews.length > 0 ? averageRating.toFixed(1) : '—'}
            </span>
            <span className="text-lg text-yellow-500">
              {reviews.length > 0
                ? renderStars(Math.round(averageRating))
                : 'No ratings yet'}
            </span>
            <span className="text-sm text-gray-500">
              {reviews.length} review{reviews.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {reviews.length === 0 ? (
          <div className="rounded-2xl border bg-gray-50 p-6 text-gray-500">
            No reviews yet.
          </div>
        ) : (
          reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-2xl border bg-gray-50 p-6"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {getReviewerName(review)}
                  </div>

                  <div className="mt-1 text-sm text-gray-500">
                    {getReviewerRole(review)}
                  </div>

                  <div className="mt-2 text-lg text-yellow-500">
                    {renderStars(review.rating)}
                  </div>
                </div>

                <div className="text-sm text-gray-400">
                  {new Date(review.created_at).toLocaleDateString()}
                </div>
              </div>

              <p className="mt-4 text-gray-700">
                {review.comment?.trim() || 'No written feedback left.'}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}