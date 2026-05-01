'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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

    // JOBS
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, title, location')
      .eq('company_id', user.id)

    if (!jobs || jobs.length === 0) {
      setApplications([])
      setLoading(false)
      return
    }

    const jobMap = new Map(
      jobs.map((j: any) => [j.id, { title: j.title, location: j.location }])
    )

    const jobIds = jobs.map((j: any) => j.id)

    // APPLICATIONS
    const { data: apps } = await supabase
      .from('applications')
      .select('id, job_id, worker_id, status, created_at')
      .in('job_id', jobIds)
      .order('created_at', { ascending: false })

    const rawApps = apps || []

    // WORKERS
    const workerIds = Array.from(
      new Set(rawApps.map((a: any) => a.worker_id))
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

    // MERGE + ADD RATINGS
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

        job_title: job?.title || null,
        job_location: job?.location || null,

        worker_name: worker?.full_name || 'Worker',
        worker_email: worker?.email || null,
        worker_rating: Number(avg.toFixed(1)),
        review_count: reviews.length,
      }
    })

    setApplications(merged)
    setLoading(false)
  }

  // GROUP BY JOB (clean UI)
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
        ? 'bg-green-100 text-green-700'
        : s === 'rejected'
        ? 'bg-red-100 text-red-700'
        : 'bg-yellow-100 text-yellow-800'

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles}`}>
        {s}
      </span>
    )
  }

  async function hire(app: Application) {
    const { error } = await supabase
      .from('jobs')
      .update({
        status: 'assigned',
        assigned_worker_id: app.worker_id,
      })
      .eq('id', app.job_id)

    if (error) {
      alert(error.message)
      return
    }

    await supabase
      .from('applications')
      .update({ status: 'accepted' })
      .eq('id', app.id)

    loadApplications()
  }

  if (loading) {
    return <div className="p-6">Loading applications...</div>
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Applications</h1>

        {grouped.length === 0 && (
          <div className="bg-white p-6 rounded-xl border">
            No applications yet.
          </div>
        )}

        {grouped.map(([jobId, apps]) => (
          <div key={jobId} className="space-y-4">
            <div className="bg-white p-5 rounded-xl border shadow-sm">
              <h2 className="text-xl font-bold">
                {apps[0].job_title}
              </h2>
              <p className="text-sm text-gray-500">
                {apps[0].job_location}
              </p>
            </div>

            <div className="grid gap-4">
              {apps.map((a) => (
                <div
                  key={a.id}
                  className="bg-white border rounded-xl p-5 shadow-sm flex justify-between items-center"
                >
                  <div>
                    <h3 className="font-bold text-lg">
                      {a.worker_name}
                    </h3>

                    <p className="text-sm text-gray-600">
                      {a.worker_email}
                    </p>

                    <p className="text-sm mt-1">
                      ⭐ {a.worker_rating} ({a.review_count})
                    </p>

                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {badge(a.status)}

                    <Link
                      href={`/profile/${a.worker_id}`}
                      className="text-blue-600 text-sm font-medium"
                    >
                      View Profile
                    </Link>

                    <Link
                      href={`/messages?user=${a.worker_id}`}
                      className="text-gray-600 text-sm"
                    >
                      Message
                    </Link>

                    {a.status !== 'accepted' && (
                      <button
                        onClick={() => hire(a)}
                        className="bg-green-600 text-white px-4 py-1 rounded text-sm"
                      >
                        Hire
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