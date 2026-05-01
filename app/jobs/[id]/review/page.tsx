'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ReviewPage() {
  const params = useParams()
  const router = useRouter()

  const jobId = String(params.id || '')

  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  async function submitReview() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    // get job to find who to review
    const { data: job } = await supabase
      .from('jobs')
      .select('company_id, assigned_worker_id')
      .eq('id', jobId)
      .single()

    if (!job) return

    // determine who is reviewing who
    let revieweeId = ''

    if (user.id === job.company_id) {
      revieweeId = job.assigned_worker_id
    } else {
      revieweeId = job.company_id
    }

    await supabase.from('reviews').insert({
      job_id: jobId,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      rating,
      comment,
    })

    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-xl bg-white p-8 rounded-2xl shadow">
        <h1 className="text-2xl font-bold mb-4">Leave a Review</h1>

        <label className="block mb-2">Rating</label>
        <select
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="w-full border p-2 rounded mb-4"
        >
          {[5,4,3,2,1].map(n => (
            <option key={n} value={n}>{n} Stars</option>
          ))}
        </select>

        <label className="block mb-2">Comment</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full border p-2 rounded mb-6"
        />

        <button
          onClick={submitReview}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl"
        >
          Submit Review
        </button>
      </div>
    </main>
  )
}