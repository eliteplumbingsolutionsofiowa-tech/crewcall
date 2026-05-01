'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Invite = {
  id: string
  status: string | null
  created_at: string
  job_id: string
  worker_id: string
  jobs: {
    id: string
    title: string | null
    trade: string | null
    location: string | null
    pay_rate: string | null
  } | null
  worker: {
    id: string
    full_name: string | null
    trade: string | null
    city: string | null
    state: string | null
  } | null
}

export default function CompanyInvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadInvites()
  }, [])

  async function loadInvites() {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('You must be logged in.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('job_invites')
      .select(`
        id,
        status,
        created_at,
        job_id,
        worker_id,
        jobs (
          id,
          title,
          trade,
          location,
          pay_rate
        ),
        worker:profiles!job_invites_worker_id_fkey (
          id,
          full_name,
          trade,
          city,
          state
        )
      `)
      .eq('company_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setInvites([])
    } else {
      setInvites((data as unknown as Invite[]) || [])
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p className="text-gray-600">Loading sent invites...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sent Invites</h1>
          <p className="text-gray-600">
            Track workers you invited to your jobs.
          </p>
        </div>

        <Link
          href="/workers"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Find Workers
        </Link>
      </div>

      {message && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {message}
        </div>
      )}

      {invites.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">No sent invites yet</h2>
          <p className="mt-1 text-gray-600">
            Invite workers from the Find Workers page.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {invites.map((invite) => {
            const status = invite.status || 'pending'
            const worker = invite.worker
            const job = invite.jobs

            return (
              <div
                key={invite.id}
                className="rounded-2xl border bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        status === 'accepted'
                          ? 'bg-green-100 text-green-700'
                          : status === 'declined'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {status.toUpperCase()}
                    </span>

                    <h2 className="mt-3 text-xl font-bold">
                      {worker?.full_name || 'Unnamed Worker'}
                    </h2>

                    <p className="mt-1 text-sm text-gray-600">
                      {worker?.trade || 'Trade not listed'} •{' '}
                      {[worker?.city, worker?.state].filter(Boolean).join(', ') ||
                        'Location not listed'}
                    </p>

                    <div className="mt-4 rounded-xl bg-gray-50 p-4">
                      <p className="text-sm font-semibold text-gray-900">
                        Job Invited To
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {job?.title || 'Untitled Job'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {job?.trade || 'Trade not listed'} •{' '}
                        {job?.location || 'Location not listed'} • Pay:{' '}
                        {job?.pay_rate || 'Not listed'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/profile/${invite.worker_id}`}
                      className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                    >
                      Worker Profile
                    </Link>

                    <Link
                      href={`/jobs/${invite.job_id}`}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      View Job
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}