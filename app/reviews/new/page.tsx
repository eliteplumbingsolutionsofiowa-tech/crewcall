'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function NewReviewPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading review...</div>}>
      <NewReviewContent />
    </Suspense>
  )
}

function NewReviewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const jobId = searchParams.get('job')
  const workerId = searchParams.get('worker')

  const [userId, setUserId] = useState<string | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setUserId(user?.id ?? null)
    }

    loadUser()
  }, [])

  async function submitReview() {
    if (!jobId || !workerId || !userId) {
      setMessage('Missing review information.')
      return
    }

    setSaving(true)
    setMessage(null)

    const { error } = await supabase.from('reviews').insert({
      job_id: jobId,
      reviewer_id: userId,
      reviewee_id: workerId,
      rating,
      comment: comment.trim() || null,
    })

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    router.push(`/jobs/${jobId}`)
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Leave Review</h1>
        <p className="mt-2 text-slate-600">
          Rate the worker after the completed job.
        </p>

        {message && (
          <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        <div className="mt-6 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold">Rating</label>
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="w-full rounded-xl border px-4 py-3"
            >
              <option value={5}>5 Stars</option>
              <option value={4}>4 Stars</option>
              <option value={3}>3 Stars</option>
              <option value={2}>2 Stars</option>
              <option value={1}>1 Star</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">Review</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How did this worker do?"
              className="min-h-32 w-full rounded-xl border px-4 py-3"
            />
          </div>

          <button
            onClick={submitReview}
            disabled={saving}
            className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </main>
  )
}