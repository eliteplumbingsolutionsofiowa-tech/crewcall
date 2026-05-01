'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string
  trade: string | null
  location: string | null
  pay_rate: string | null
  status: string | null
  payment_status: string | null
  paid_at: string | null
  company_id: string
  assigned_worker_id: string | null
}

type Profile = {
  id: string
  role: string | null
}

export default function CompletedJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCompletedJobs()
  }, [])

  async function loadCompletedJobs() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    setProfile(profileData as Profile | null)

    let query = supabase
      .from('jobs')
      .select('*')
      .eq('payment_status', 'paid')
      .order('paid_at', { ascending: false })

    if (profileData?.role === 'company') {
      query = query.eq('company_id', user.id)
    }

    if (profileData?.role === 'worker') {
      query = query.eq('assigned_worker_id', user.id)
    }

    const { data, error } = await query

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    setJobs((data || []) as Job[])
    setLoading(false)
  }

  if (loading) {
    return <main className="p-6">Loading completed jobs...</main>
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Completed Jobs</h1>
          <p className="mt-2 text-gray-600">
            Paid jobs and completed work history.
          </p>
        </div>

        <Link
          href="/jobs"
          className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white"
        >
          Back to Jobs
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold">No completed jobs yet</h2>
          <p className="mt-2 text-gray-600">
            Paid jobs will show up here after checkout is complete.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="block rounded-2xl border bg-white p-6 shadow-sm hover:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">{job.title}</h2>

                  <div className="mt-3 space-y-1 text-gray-600">
                    <p>Location: {job.location || 'Not listed'}</p>
                    <p>Trade: {job.trade || 'Not listed'}</p>
                    <p>Pay: {job.pay_rate || 'Not listed'}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-green-100 px-4 py-2 font-semibold text-green-800">
                  Paid ✅
                </div>
              </div>

              {job.paid_at && (
                <p className="mt-4 text-sm text-gray-500">
                  Paid on {new Date(job.paid_at).toLocaleDateString()}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}