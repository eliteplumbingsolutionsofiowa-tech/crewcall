'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
  phone: string | null
  city: string | null
  state: string | null
  role: string | null
}

type Review = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  jobs: {
    title: string | null
  } | null
  reviewer: {
    full_name: string | null
    company_name: string | null
  } | null
}

export default function PublicProfilePage() {
  const params = useParams()
  const profileId = params.id as string

  const [profile, setProfile] = useState<Profile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, phone, city, state, role')
        .eq('id', profileId)
        .single()

      setProfile(profileData || null)

      const { data: reviewData } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          jobs:job_id (
            title
          ),
          reviewer:reviewer_id (
            full_name,
            company_name
          )
        `)
        .eq('reviewee_id', profileId)
        .order('created_at', { ascending: false })

      setReviews((reviewData as Review[]) || [])
      setLoading(false)
    }

    loadProfile()
  }, [profileId])

  if (loading) return <div className="p-6">Loading profile...</div>
  if (!profile) return <div className="p-6">Profile not found.</div>

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
          {profile.role || 'Profile'}
        </p>

        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          {profile.full_name || profile.company_name || 'CrewCall User'}
        </h1>

        <p className="mt-2 text-gray-600">
          {[profile.city, profile.state].filter(Boolean).join(', ') ||
            'Location not listed'}
        </p>

        {profile.phone && (
          <p className="mt-1 text-gray-600">{profile.phone}</p>
        )}

        <div className="mt-4 rounded-xl bg-gray-100 px-4 py-3">
          {reviews.length > 0 ? (
            <p className="font-semibold text-gray-800">
              ⭐ {averageRating.toFixed(1)} average rating · {reviews.length}{' '}
              review{reviews.length === 1 ? '' : 's'}
            </p>
          ) : (
            <p className="text-gray-600">No reviews yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold">Reviews</h2>

        {reviews.length === 0 ? (
          <p className="text-gray-500">This user does not have reviews yet.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const reviewerName =
                review.reviewer?.company_name ||
                review.reviewer?.full_name ||
                'CrewCall User'

              return (
                <div key={review.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-gray-900">
                      {'⭐'.repeat(review.rating)}
                    </p>

                    <p className="text-sm text-gray-500">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {review.jobs?.title && (
                    <p className="mt-1 text-sm text-gray-500">
                      Job: {review.jobs.title}
                    </p>
                  )}

                  {review.comment && (
                    <p className="mt-3 text-gray-700">{review.comment}</p>
                  )}

                  <p className="mt-3 text-sm text-gray-500">
                    Reviewed by {reviewerName}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}