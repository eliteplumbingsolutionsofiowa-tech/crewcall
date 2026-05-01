'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ReviewForm({
  jobId,
  revieweeId,
  label,
}: {
  jobId: string
  revieweeId: string
  label: string
}) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    const user = session?.user

    if (sessionError || !user) {
      setMessage('You must be logged in.')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('reviews').upsert(
      {
        job_id: jobId,
        reviewer_id: user.id,
        reviewee_id: revieweeId,
        rating,
        comment: comment.trim() || null,
      },
      {
        onConflict: 'job_id,reviewer_id,reviewee_id',
      }
    )

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setMessage('Review submitted.')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-2xl border bg-white p-4">
      <div className="text-sm font-semibold text-gray-900">{label}</div>

      <div className="mt-3">
        <label className="block text-sm text-gray-700">Rating</label>
        <select
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="mt-1 w-full rounded-xl border px-3 py-2"
        >
          <option value={5}>5 - Great</option>
          <option value={4}>4 - Good</option>
          <option value={3}>3 - Okay</option>
          <option value={2}>2 - Poor</option>
          <option value={1}>1 - Bad</option>
        </select>
      </div>

      <div className="mt-3">
        <label className="block text-sm text-gray-700">Comment</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Leave a quick review..."
          className="mt-1 w-full rounded-xl border px-3 py-2"
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Review'}
        </button>

        {message && <div className="text-sm text-blue-600">{message}</div>}
      </div>
    </form>
  )
}