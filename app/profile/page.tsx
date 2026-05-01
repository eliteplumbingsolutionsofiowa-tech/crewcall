'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
  role: 'worker' | 'company' | null
}

type Review = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer: {
    full_name: string | null
    company_name: string | null
  } | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    // PROFILE
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    setProfile(profileData)

    // REVIEWS
    const { data: reviewData } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        reviewer:profiles!reviews_reviewer_id_fkey (
          full_name,
          company_name
        )
      `)
      .eq('reviewee_id', user.id)
      .order('created_at', { ascending: false })

    const cleaned = (reviewData || []).map((r: any) => ({
      ...r,
      reviewer: Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer,
    }))

    setReviews(cleaned)
    setLoading(false)
  }

  function averageRating() {
    if (reviews.length === 0) return 0
    const total = reviews.reduce((sum, r) => sum + r.rating, 0)
    return (total / reviews.length).toFixed(1)
  }

  if (loading) {
    return (
      <main className="p-6">
        <p>Loading profile...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-4xl">
        {/* PROFILE HEADER */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">
            {profile?.company_name || profile?.full_name || 'User'}
          </h1>

          <p className="mt-2 text-gray-600 capitalize">
            Role: {profile?.role}
          </p>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-xl font-semibold text-gray-900">
              ⭐ {averageRating()}
            </span>
            <span className="text-sm text-gray-500">
              ({reviews.length} reviews)
            </span>
          </div>
        </div>

        {/* REVIEWS */}
        <div className="mt-6">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Reviews</h2>

          {reviews.length === 0 ? (
            <div className="rounded-2xl border bg-white p-6 text-gray-600">
              No reviews yet.
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => {
                const name =
                  r.reviewer?.company_name ||
                  r.reviewer?.full_name ||
                  'User'

                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">
                        {name}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="mt-2 text-yellow-500">
                      {'★'.repeat(r.rating)}
                      {'☆'.repeat(5 - r.rating)}
                    </div>

                    {r.comment && (
                      <p className="mt-2 text-gray-700">{r.comment}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}