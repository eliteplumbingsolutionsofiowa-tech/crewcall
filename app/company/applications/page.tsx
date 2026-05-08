'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Application = {
  id: string
  job_id: string
  worker_id: string
  status: string | null
  created_at: string
  job_title: string | null
  job_location: string | null
  worker_name: string | null
  worker_email: string | null
  worker_rating: number
  review_count: number
}

export default function CompanyApplicationsPage() {
  const router = useRouter()

  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadApplications()
  }, [])

  async function loadApplications() {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title, location')
      .eq('company_id', user.id)

    if (jobsError) {
      setMessage(jobsError.message)
      setLoading(false)
      return
    }

    if (!jobs || jobs.length === 0) {
      setApplications([])
      setLoading(false)
      return
    }

    const jobMap = new Map(
      jobs.map((j: any) => [j.id, { title: j.title, location: j.location }])
    )

    const jobIds = jobs.map((j: any) => j.id)

    const { data: apps, error: appsError } = await supabase
      .from('applications')
      .select('id, job_id, worker_id, status, created_at')
      .in('job_id', jobIds)
      .order('created_at', { ascending: false })

    if (appsError) {
      setMessage(appsError.message)
      setApplications([])
      setLoading(false)
      return
    }

    const rawApps = apps || []

    const workerIds = Array.from(
      new Set(rawApps.map((a: any) => a.worker_id).filter(Boolean))
    )

    let profileMap = new Map<string, any>()

    if (workerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          reviews:reviews!reviews_reviewee_id_fkey (rating)
        `)
        .in('id', workerIds)

      profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))
    }

    const merged: Application[] = rawApps.map((a: any) => {
      const job = jobMap.get(a.job_id)
      const worker = profileMap.get(a.worker_id)

      const reviews = worker?.reviews || []
      const total = reviews.reduce((sum: number, r: any) => sum + r.rating, 0)
      const avg = reviews.length ? total / reviews.length : 0

      return {
        id: a.id,
        job_id: a.job_id,
        worker_id: a.worker_id,
        status: a.status,
        created_at: a.created_at,
        job_title: job?.title || 'Untitled Job',
        job_location: job?.location || 'Location not set',
        worker_name: worker?.full_name || 'Worker',
        worker_email: worker?.email || null,
        worker_rating: Number(avg.toFixed(1)),
        review_count: reviews.length,
      }
    })

    setApplications(merged)
    setLoading(false)
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Application[]>()

    for (const app of applications) {
      if (!map.has(app.job_id)) {
        map.set(app.job_id, [])
      }

      map.get(app.job_id)!.push(app)
    }

    return Array.from(map.entries())
  }, [applications])

  function badge(status: string | null) {
    const s = status || 'pending'

    const styles =
      s === 'accepted'
        ? 'border-green-200 bg-green-100 text-green-700'
        : s === 'rejected'
          ? 'border-red-200 bg-red-100 text-red-700'
          : 'border-yellow-200 bg-yellow-100 text-yellow-800'

    return (
      <span
        className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${styles}`}
      >
        {s}
      </span>
    )
  }

  async function hire(app: Application) {
    setActionLoading(app.id)
    setMessage(null)

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        status: 'assigned',
        assigned_worker_id: app.worker_id,
      })
      .eq('id', app.job_id)

    if (jobError) {
      setMessage(jobError.message)
      setActionLoading(null)
      return
    }

    await supabase
      .from('applications')
      .update({ status: 'accepted' })
      .eq('id', app.id)

    await supabase
      .from('applications')
      .update({ status: 'rejected' })
      .eq('job_id', app.job_id)
      .neq('id', app.id)

    setMessage(`${app.worker_name || 'Worker'} has been hired.`)
    setActionLoading(null)
    await loadApplications()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-gray-600">Loading applications...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Applications</h1>
          <p className="mt-1 text-gray-600">
            Review workers who applied to your posted jobs.
          </p>
        </div>

        {message && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-800">
            {message}
          </div>
        )}

        {grouped.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              No applications yet
            </h2>
            <p className="mt-2 text-gray-600">
              Applications will appear here when workers apply to your jobs.
            </p>
          </div>
        )}

        {grouped.map(([jobId, apps]) => (
          <div key={jobId} className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900">
                {apps[0].job_title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {apps[0].job_location}
              </p>
            </div>

            <div className="grid gap-4">
              {apps.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <Link
                      href={`/workers/${a.worker_id}`}
                      className="text-lg font-bold text-blue-700 hover:underline"
                    >
                      {a.worker_name || 'Worker Profile'}
                    </Link>

                    {a.worker_email && (
                      <p className="mt-1 text-sm text-gray-600">
                        {a.worker_email}
                      </p>
                    )}

                    <p className="mt-1 text-sm text-gray-700">
                      ⭐ {a.worker_rating || '0.0'} ({a.review_count} reviews)
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      Applied {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:min-w-40 sm:items-end">
                    {badge(a.status)}

                    <Link
                      href={`/workers/${a.worker_id}`}
                      className="text-sm font-semibold text-blue-600 hover:underline"
                    >
                      View Profile
                    </Link>

                    <Link
                      href={`/messages?workerId=${a.worker_id}&jobId=${a.job_id}`}
                      className="text-sm font-semibold text-gray-600 hover:underline"
                    >
                      Message
                    </Link>

                    {a.status !== 'accepted' && (
                      <button
                        onClick={() => hire(a)}
                        disabled={actionLoading === a.id}
                        className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionLoading === a.id ? 'Hiring...' : 'Hire'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}