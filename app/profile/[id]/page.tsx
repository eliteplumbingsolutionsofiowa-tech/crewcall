'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CrewCard } from '@/app/components/CrewCard'
import { CrewButton } from '@/app/components/CrewButton'

type Profile = {
  id: string
  role: 'company' | 'worker' | null
  full_name: string | null
  company_name: string | null
  phone: string | null
  city: string | null
  state: string | null
  trade: string | null
  insurance_provider: string | null
  years_experience: string | null
  job_experience: string | null
  liability_form_signed: boolean | null
}

type Review = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer_name: string
}

export default function PublicProfilePage() {
  const params = useParams()
  const profileId = String(params.id || '')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)

    // PROFILE
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single()

    // REVIEWS (clean join)
    const { data: reviewData } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        profiles!reviews_reviewer_id_fkey (
          full_name,
          company_name
        )
      `)
      .eq('reviewee_id', profileId)
      .order('created_at', { ascending: false })

    const cleaned: Review[] =
      reviewData?.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        reviewer_name:
          r.profiles?.company_name ||
          r.profiles?.full_name ||
          'User',
      })) || []

    setProfile(profileData)
    setReviews(cleaned)
    setLoading(false)
  }

  function avgRating() {
    if (!reviews.length) return '0.0'
    const total = reviews.reduce((sum, r) => sum + r.rating, 0)
    return (total / reviews.length).toFixed(1)
  }

  function name() {
    return profile?.company_name || profile?.full_name || 'Profile'
  }

  if (loading) {
    return (
      <main className="p-6">
        <p>Loading profile...</p>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="p-6">
        <p>Profile not found.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-bold">{name()}</h1>

          <p className="text-gray-600 mt-1">
            {profile.trade || 'No trade listed'} · {profile.city || 'Unknown'}
            {profile.state ? `, ${profile.state}` : ''}
          </p>

          <div className="mt-3 flex items-center gap-3">
            <span className="text-2xl font-bold">
              ⭐ {avgRating()}
            </span>
            <span className="text-sm text-gray-500">
              ({reviews.length} reviews)
            </span>
          </div>
        </div>

        {/* TRUST / COMPLIANCE (THIS IS HUGE FOR CREWCALL) */}
        <CrewCard>
          <h2 className="text-lg font-bold mb-3">Trust & Compliance</h2>

          <div className="grid md:grid-cols-3 gap-3 text-sm">

            <Badge
              label="Insurance"
              ok={!!profile.insurance_provider}
            />

            <Badge
              label="Liability Form"
              ok={!!profile.liability_form_signed}
            />

            <Badge
              label="Experience"
              ok={!!profile.years_experience}
            />

          </div>
        </CrewCard>

        {/* DETAILS */}
        <CrewCard>
          <h2 className="text-lg font-bold mb-3">Details</h2>

          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <Info label="Role" value={profile.role} />
            <Info label="Company" value={profile.company_name} />
            <Info label="Phone" value={profile.phone} />
            <Info label="Years Experience" value={profile.years_experience} />
          </div>
        </CrewCard>

        {/* EXPERIENCE */}
        <CrewCard>
          <h2 className="text-lg font-bold mb-3">Job Experience</h2>

          <p className="whitespace-pre-wrap text-gray-700">
            {profile.job_experience || 'No experience added yet.'}
          </p>
        </CrewCard>

        {/* REVIEWS */}
        <CrewCard>
          <h2 className="text-lg font-bold mb-3">Reviews</h2>

          {reviews.length === 0 ? (
            <p className="text-gray-500">
              No reviews yet — this user hasn’t been rated.
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="bg-gray-100 rounded-xl p-4"
                >
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">
                      {r.reviewer_name}
                    </span>

                    <span className="text-gray-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mt-1 text-yellow-500 text-sm">
                    {'★'.repeat(r.rating)}
                    {'☆'.repeat(5 - r.rating)}
                  </div>

                  {r.comment && (
                    <p className="mt-2 text-sm">{r.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CrewCard>

        {/* ACTIONS */}
        <div className="flex gap-3 flex-wrap">
          <CrewButton href="/workers">
            Back
          </CrewButton>

          <CrewButton href={`/messages?start=${profile.id}`} variant="ghost">
            Message
          </CrewButton>
        </div>
      </div>
    </main>
  )
}

/* ---------- SMALL COMPONENTS ---------- */

function Info({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="bg-gray-100 p-3 rounded-xl">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium">{value || 'Not listed'}</p>
    </div>
  )
}

function Badge({
  label,
  ok,
}: {
  label: string
  ok: boolean
}) {
  return (
    <div
      className={`rounded-xl p-3 text-center text-sm font-medium ${
        ok
          ? 'bg-green-100 text-green-700'
          : 'bg-red-100 text-red-600'
      }`}
    >
      {ok ? '✔' : '✖'} {label}
    </div>
  )
}