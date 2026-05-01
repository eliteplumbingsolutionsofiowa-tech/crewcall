'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CrewCard } from '@/app/components/CrewCard'
import { CrewButton } from '@/app/components/CrewButton'

type Worker = {
  id: string
  full_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  years_experience: string | null
  liability_form_signed: boolean | null
  reviews?: {
    rating: number
  }[]
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWorkers()
  }, [])

  async function loadWorkers() {
    setLoading(true)

    const { data } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        trade,
        city,
        state,
        years_experience,
        liability_form_signed,
        reviews:reviews!reviews_reviewee_id_fkey (
          rating
        )
      `)
      .eq('role', 'worker')
      .order('full_name', { ascending: true })

    setWorkers((data as Worker[]) || [])
    setLoading(false)
  }

  function avgRating(worker: Worker) {
    const reviews = worker.reviews || []
    if (reviews.length === 0) return '0.0'
    const total = reviews.reduce((sum, review) => sum + review.rating, 0)
    return (total / reviews.length).toFixed(1)
  }

  function reviewCount(worker: Worker) {
    return worker.reviews?.length || 0
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            CrewCall
          </p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            Find Workers
          </h1>
          <p className="mt-2 text-gray-600">
            Browse tradespeople, check reviews, and invite workers to your jobs.
          </p>
        </div>

        {loading && <p className="text-gray-600">Loading workers...</p>}

        {!loading && workers.length === 0 && (
          <CrewCard>
            <p className="text-gray-600">No workers found yet.</p>
          </CrewCard>
        )}

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {workers.map((worker) => {
            const count = reviewCount(worker)

            return (
              <CrewCard key={worker.id} className="space-y-4">
                <div>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                    {(worker.full_name || 'W').charAt(0).toUpperCase()}
                  </div>

                  <h2 className="text-lg font-bold text-gray-900">
                    {worker.full_name || 'Unnamed Worker'}
                  </h2>

                  <p className="text-sm font-medium text-blue-600">
                    {worker.trade || 'No trade listed'}
                  </p>

                  <p className="text-sm text-gray-500">
                    {[worker.city, worker.state].filter(Boolean).join(', ') ||
                      'Location not listed'}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                  <div>
                    <strong>Experience:</strong>{' '}
                    {worker.years_experience || 'Not listed'}
                  </div>

                  <div className="mt-2">
                    <strong>Rating:</strong> ⭐ {avgRating(worker)} ({count}{' '}
                    {count === 1 ? 'review' : 'reviews'})
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {worker.liability_form_signed ? (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      Liability on file
                    </span>
                  ) : (
                    <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                      Liability missing
                    </span>
                  )}

                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    Available
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  <CrewButton href={`/profile/${worker.id}`}>
                    View Profile
                  </CrewButton>

                  <CrewButton href={`/workers/${worker.id}/invite`} variant="ghost">
                    Invite
                  </CrewButton>
                </div>
              </CrewCard>
            )
          })}
        </div>
      </div>
    </main>
  )
}