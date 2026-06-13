'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  jobId: string
  revieweeId: string
  existingRating?: number | null
  existingComment?: string | null
  onReviewSaved?: () => void
}

type ReviewPayload = {
  job_id: string
  reviewer_id: string
  reviewee_id: string
  rating: number
  comment: string | null
}

type QueryError = {
  message: string
}

type UpsertTable<TPayload> = {
  upsert: (
    value: TPayload,
    options: { onConflict: string }
  ) => Promise<{ data: null; error: QueryError | null }>
}

function reviewsTable() {
  return supabase.from('reviews') as unknown as UpsertTable<ReviewPayload>
}

export default function ReviewForm({
  jobId,
  revieweeId,
  existingRating = null,
  existingComment = null,
  onReviewSaved,
}: Props) {
  const [rating, setRating] = useState(existingRating || 5)
  const [comment, setComment] = useState(existingComment || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function saveReview() {
    setSaving(true)
    setMessage(null)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setMessage('You must be logged in to leave a review.')
        return
      }

      const payload: ReviewPayload = {
        job_id: jobId,
        reviewer_id: user.id,
        reviewee_id: revieweeId,
        rating,
        comment: comment.trim() ? comment.trim() : null,
      }

      const { error } = await reviewsTable().upsert(payload, {
        onConflict: 'job_id,reviewer_id,reviewee_id',
      })

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Review saved.')
      onReviewSaved?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Review failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black text-slate-900">Leave a review</h3>

      <div className="mt-4">
        <label className="text-sm font-black text-slate-700">Rating</label>

        <select
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500"
        >
          <option value={5}>5 stars</option>
          <option value={4}>4 stars</option>
          <option value={3}>3 stars</option>
          <option value={2}>2 stars</option>
          <option value={1}>1 star</option>
        </select>
      </div>

      <div className="mt-4">
        <label className="text-sm font-black text-slate-700">Comment</label>

        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={4}
          placeholder="How did the job go?"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
          {message}
        </p>
      )}

      <button
        type="button"
        onClick={saveReview}
        disabled={saving}
        className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Saving...' : 'Save review'}
      </button>
    </div>
  )
}