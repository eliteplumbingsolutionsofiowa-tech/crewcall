'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Review = {
  id: string
  rating: number
}

function renderStars(rating: number) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

export default function ProfileRatingSummary({
  profileId,
}: {
  profileId: string
}) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadReviews() {
      setLoading(true)

      const { data } = await supabase
        .from('reviews')
        .select('id, rating')
        .eq('reviewee_id', profileId)

      setReviews((data || []) as Review[])
      setLoading(false)
    }

    loadReviews()
  }, [profileId])

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0
    const total = reviews.reduce((sum, review) => sum + review.rating, 0)
    return total / reviews.length
  }, [reviews])

  if (loading) {
    return (
      <div className="rounded-2xl border bg-gray-50 p-4">
        <div className="text-sm text-gray-500">Loading rating...</div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-gray-50 p-4">
      <div className="text-sm font-medium uppercase tracking-wide text-gray-500">
        Rating
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="text-3xl font-bold text-gray-900">
          {reviews.length > 0 ? averageRating.toFixed(1) : '—'}
        </span>

        <span className="text-yellow-500">
          {reviews.length > 0
            ? renderStars(Math.round(averageRating))
            : 'No ratings yet'}
        </span>

        <span className="text-sm text-gray-500">
          {reviews.length} review{reviews.length === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  )
}