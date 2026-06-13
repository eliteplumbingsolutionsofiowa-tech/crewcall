'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type CompanyProfile = {
  id: string
  role: 'company' | 'worker' | null
  full_name: string | null
  company_name: string | null
  phone: string | null
  city: string | null
  state: string | null
  verified: boolean | null
}

type Review = {
  id: string
  rating: number | null
  comment: string | null
  created_at: string
  reviewer_id: string | null
}

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  status: string | null
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-black text-blue-700">
      {label}
    </span>
  )
}

export default function CompanyProfilePage() {
  const params = useParams()
  const companyId = String(params?.id || '')

  const [company, setCompany] = useState<CompanyProfile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [completedJobs, setCompletedJobs] = useState<Job[]>([])
  const [openJobs, setOpenJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void loadCompany()
  }, [companyId])

  async function loadCompany() {
    setLoading(true)
    setMessage(null)

    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, company_name, phone, city, state, verified')
      .eq('id', companyId)
      .maybeSingle()

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    const companyData = data as CompanyProfile | null

    if (!companyData || companyData.role !== 'company') {
      setMessage('Company profile not found.')
      setLoading(false)
      return
    }

    setCompany(companyData)

    const { data: reviewData } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, reviewer_id')
      .eq('reviewee_id', companyId)
      .order('created_at', { ascending: false })

    setReviews((reviewData as Review[]) || [])

    const { data: completedData } = await supabase
      .from('jobs')
      .select('id, title, trade, location, status')
      .eq('company_id', companyId)
      .eq('status', 'completed')

    setCompletedJobs((completedData as Job[]) || [])

    const { data: openData } = await supabase
      .from('jobs')
      .select('id, title, trade, location, status')
      .eq('company_id', companyId)
      .eq('status', 'open')
      .order('id', { ascending: false })

    setOpenJobs((openData as Job[]) || [])

    setLoading(false)
  }

  const averageRating = useMemo(() => {
    const ratings = reviews
      .map((review) => Number(review.rating || 0))
      .filter((rating) => rating > 0)

    if (ratings.length === 0) return 0

    return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
  }, [reviews])

  const ratingDisplay = averageRating > 0 ? averageRating.toFixed(1) : 'New'

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-100 p-6">
        <div className="mx-auto max-w-6xl rounded-[2rem] bg-white/90 p-8 shadow-xl">
          Loading company profile...
        </div>
      </main>
    )
  }

  if (!company) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-100 p-6">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-red-200 bg-red-50 p-8 text-red-700 shadow-xl">
          {message || 'Company not found.'}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/jobs"
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          ← Back to jobs
        </Link>

        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-600">
                Company Profile
              </p>

              <h1 className="mt-3 text-5xl font-black text-slate-950">
                {company.company_name || company.full_name || 'Company'}
              </h1>

              <p className="mt-3 text-lg text-slate-600">
                {[company.city, company.state].filter(Boolean).join(', ') ||
                  'Location not listed'}
              </p>

              {company.phone && (
                <p className="mt-2 text-slate-600">Phone: {company.phone}</p>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                {company.verified && <Badge label="Verified Company" />}
                <Badge label={`${completedJobs.length} Completed Jobs`} />
                <Badge label={`${reviews.length} Reviews`} />
              </div>
            </div>

            <div className="rounded-3xl border border-blue-100 bg-blue-50 px-8 py-7 text-center shadow-sm">
              <p className="text-5xl font-black text-blue-700">
                ★ {ratingDisplay}
              </p>

              <p className="mt-2 text-sm font-semibold text-blue-600">
                Average Rating
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-xl">
            <h2 className="text-3xl font-black text-slate-950">Open Jobs</h2>

            <div className="mt-6 space-y-4">
              {openJobs.length === 0 ? (
                <p className="text-slate-500">No open jobs.</p>
              ) : (
                openJobs.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <p className="text-xl font-black text-slate-950">
                      {job.title || 'Untitled Job'}
                    </p>

                    <p className="mt-2 text-sm text-slate-600">
                      {job.trade || 'Trade not listed'} ·{' '}
                      {job.location || 'Location not listed'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-xl">
            <h2 className="text-3xl font-black text-slate-950">Reviews</h2>

            <div className="mt-6 space-y-4">
              {reviews.length === 0 ? (
                <p className="text-slate-500">No reviews yet.</p>
              ) : (
                reviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-black text-slate-950">
                        CrewCall User
                      </p>

                      <p className="font-black text-yellow-500">
                        ★ {review.rating || 0}
                      </p>
                    </div>

                    {review.comment && (
                      <p className="mt-3 text-slate-700">{review.comment}</p>
                    )}

                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {formatDate(review.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}