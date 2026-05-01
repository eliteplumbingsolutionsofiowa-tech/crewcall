'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type WorkerProfile = {
  id: string
  full_name: string | null
  company_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  phone: string | null
}

type Review = {
  reviewed_user_id: string
  rating: number | null
}

type Application = {
  id: string
  worker_id: string
  status: string | null
  created_at: string
  profile: WorkerProfile | null
  reviews: Review[]
}

type ApplicantsListProps = {
  jobId: string
}

function getAverageRating(reviews: Review[]) {
  const ratings = reviews
    .map((review) => Number(review.rating || 0))
    .filter((rating) => rating > 0)

  if (!ratings.length) return null

  const total = ratings.reduce((sum, rating) => sum + rating, 0)
  return (total / ratings.length).toFixed(1)
}

export default function ApplicantsList({ jobId }: ApplicantsListProps) {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [hiringId, setHiringId] = useState<string | null>(null)

  useEffect(() => {
    loadApplicants()
  }, [jobId])

  const sortedApplications = useMemo(() => {
    return [...applications].sort((a, b) => {
      const ratingA = Number(getAverageRating(a.reviews) || 0)
      const ratingB = Number(getAverageRating(b.reviews) || 0)

      if (ratingB !== ratingA) return ratingB - ratingA

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [applications])

  async function loadApplicants() {
    setLoading(true)
    setMessage(null)

    const { data: rawApplications, error: applicationError } = await supabase
      .from('applications')
      .select('id, worker_id, status, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (applicationError) {
      setMessage(applicationError.message)
      setApplications([])
      setLoading(false)
      return
    }

    const seenWorkers = new Set<string>()

    const applicationData = (rawApplications || []).filter((app) => {
      if (!app.worker_id) return false
      if (seenWorkers.has(app.worker_id)) return false
      seenWorkers.add(app.worker_id)
      return true
    })

    const workerIds = applicationData
      .map((app) => app.worker_id)
      .filter(Boolean)

    if (!workerIds.length) {
      setApplications([])
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, trade, city, state, phone')
      .in('id', workerIds)

    if (profileError) {
      setMessage(profileError.message)
      setApplications([])
      setLoading(false)
      return
    }

    const { data: reviewData, error: reviewError } = await supabase
      .from('reviews')
      .select('reviewed_user_id, rating')
      .in('reviewed_user_id', workerIds)

    if (reviewError) {
      setMessage(reviewError.message)
      setApplications([])
      setLoading(false)
      return
    }

    const builtApplications = applicationData.map((app) => {
      const profile =
        (profileData || []).find((profile) => profile.id === app.worker_id) ||
        null

      const reviews = (reviewData || []).filter(
        (review) => review.reviewed_user_id === app.worker_id
      )

      return {
        id: app.id,
        worker_id: app.worker_id,
        status: app.status,
        created_at: app.created_at,
        profile,
        reviews,
      }
    })

    setApplications(builtApplications as Application[])
    setLoading(false)
  }

  async function hireWorker(application: Application) {
    if (!application.worker_id) {
      setMessage('Worker profile is missing.')
      return
    }

    setHiringId(application.id)
    setMessage(null)

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        status: 'assigned',
        assigned_worker_id: application.worker_id,
        assigned_application_id: application.id,
      })
      .eq('id', jobId)

    if (jobError) {
      setMessage(jobError.message)
      setHiringId(null)
      return
    }

    const { error: applicationError } = await supabase
      .from('applications')
      .update({ status: 'accepted' })
      .eq('id', application.id)

    if (applicationError) {
      setMessage(applicationError.message)
      setHiringId(null)
      return
    }

    await supabase
      .from('applications')
      .update({ status: 'declined' })
      .eq('job_id', jobId)
      .neq('id', application.id)

    setMessage('Worker hired successfully.')
    setHiringId(null)
    loadApplicants()
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-gray-600">Loading applicants...</p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Applicants</h2>
          <p className="text-sm text-gray-600">
            Review workers, ratings, and hire the best fit.
          </p>
        </div>

        <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          {applications.length} total
        </span>
      </div>

      {message && (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-800">
          {message}
        </div>
      )}

      {sortedApplications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center">
          <p className="font-semibold text-gray-900">No applicants yet.</p>
          <p className="mt-1 text-sm text-gray-600">
            Workers who apply for this job will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedApplications.map((application) => {
            const profile = application.profile
            const averageRating = getAverageRating(application.reviews)
            const status = application.status || 'pending'
            const workerName =
              profile?.full_name ||
              profile?.company_name ||
              'Unnamed Worker'

            return (
              <div
                key={`${application.worker_id}-${application.id}`}
                className="rounded-2xl border border-gray-200 p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {workerName}
                      </h3>

                      <p className="text-sm text-gray-600">
                        {profile?.trade || 'Trade not listed'}
                        {profile?.city || profile?.state ? ' • ' : ''}
                        {[profile?.city, profile?.state].filter(Boolean).join(', ')}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-yellow-50 px-3 py-1 text-sm font-semibold text-yellow-700">
                        {averageRating ? `⭐ ${averageRating}` : 'No reviews'}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold ${
                          status === 'accepted'
                            ? 'bg-green-50 text-green-700'
                            : status === 'declined'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-orange-50 text-orange-700'
                        }`}
                      >
                        {status}
                      </span>
                    </div>

                    <p className="text-sm text-gray-500">
                      Applied {new Date(application.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/messages?workerId=${application.worker_id}&jobId=${jobId}`}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Message
                    </Link>

                    <button
                      onClick={() => hireWorker(application)}
                      disabled={hiringId === application.id || status === 'accepted'}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {hiringId === application.id
                        ? 'Hiring...'
                        : status === 'accepted'
                          ? 'Hired'
                          : 'Hire Worker'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}