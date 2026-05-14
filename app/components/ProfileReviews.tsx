'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Review = {
  id: string
  rating: number
  comment: string | null
  created_at: string | null
  reviewer_id: string | null
  reviewer_name: string
  reviewer_role: string | null
  job_title: string | null
}

type RawReview = {
  id: string
  rating: number | null
  comment: string | null
  created_at: string | null
  reviewer_id: string | null
  reviewer:
    | {
        full_name: string | null
        company_name: string | null
        role: string | null
      }
    | {
        full_name: string | null
        company_name: string | null
        role: string | null
      }[]
    | null
  job:
    | {
        title: string | null
      }
    | {
        title: string | null
      }[]
    | null
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
    loadReviews()
  }, [profileId])

  async function loadReviews() {
    setLoading(true)
    setErrorMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const targetId = profileId || user?.id

    if (!targetId) {
      setReviews([])
      setLoading(false)
      return
    }

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
        ),
        job:job_id (
          title
        )
      `)
      .eq('reviewee_id', targetId)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      setReviews([])
      setLoading(false)
      return
    }

    const cleanedReviews = ((data || []) as RawReview[]).map((review) => {
      const reviewer = Array.isArray(review.reviewer)
        ? review.reviewer[0]
        : review.reviewer

      const job = Array.isArray(review.job)
        ? review.job[0]
        : review.job

      return {
        id: review.id,
        rating: Number(review.rating || 0),
        comment: review.comment,
        created_at: review.created_at,
        reviewer_id: review.reviewer_id,
        reviewer_name:
          reviewer?.company_name ||
          reviewer?.full_name ||
          'CrewCall User',
        reviewer_role: reviewer?.role || null,
        job_title: job?.title || null,
      }
    })

    setReviews(cleanedReviews)
    setLoading(false)
  }

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0

    return (
      reviews.reduce((sum, review) => sum + review.rating, 0) /
      reviews.length
    )
  }, [reviews])

  const fiveStarCount = reviews.filter(
    (review) => review.rating === 5
  ).length

  function renderStars(value: number) {
    const rounded = Math.max(0, Math.min(5, Math.round(value)))

    return '★'.repeat(rounded) + '☆'.repeat(5 - rounded)
  }

  function trustLevel() {
    if (reviews.length >= 25 && averageRating >= 4.8) {
      return 'Elite Pro'
    }

    if (reviews.length >= 10 && averageRating >= 4.5) {
      return 'Top Rated'
    }

    if (reviews.length >= 3) {
      return 'Verified'
    }

    return 'New Member'
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <h2 className="text-3xl font-black text-white">Reviews</h2>

        <p className="mt-3 text-slate-400">Loading reputation...</p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
            Reputation
          </p>

          <h2 className="mt-2 text-4xl font-black text-white">
            Reviews & Ratings
          </h2>

          <p className="mt-3 max-w-2xl text-slate-400">
            Reputation built through completed CrewCall jobs.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200">
              {trustLevel()}
            </div>

            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-200">
              {fiveStarCount} Five-Star Reviews
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900 px-8 py-6 text-center">
          <p className="text-5xl font-black text-cyan-300">
            {reviews.length ? averageRating.toFixed(1) : '—'}
          </p>

          <p className="mt-2 text-xl text-yellow-400">
            {renderStars(averageRating)}
          </p>

          <p className="mt-3 text-sm font-bold uppercase tracking-widest text-slate-400">
            {reviews.length === 1
              ? '1 Review'
              : `${reviews.length} Reviews`}
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
          {errorMessage}
        </div>
      )}

      <div className="mt-8">
        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-6 text-sm font-semibold text-yellow-100">
            No reviews yet. Completed job reviews will appear here.
          </div>
        ) : (
          <div className="space-y-5">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-3xl border border-white/10 bg-slate-900 p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/profile?user=${review.reviewer_id}`}
                        className="text-xl font-black text-white hover:text-cyan-300"
                      >
                        {review.reviewer_name}
                      </Link>

                      {review.reviewer_role && (
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-cyan-200">
                          {review.reviewer_role}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-lg font-bold text-yellow-400">
                      {renderStars(review.rating)}
                    </p>

                    {review.job_title && (
                      <p className="mt-2 text-sm text-slate-400">
                        Job: {review.job_title}
                      </p>
                    )}
                  </div>

                  <div className="text-sm font-semibold text-slate-500">
                    {review.created_at
                      ? new Date(review.created_at).toLocaleDateString()
                      : ''}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/5 bg-black/20 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
                    {review.comment || 'No written feedback left.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}