'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type SentInvite = {
  id: string
  status: string | null
  created_at: string
  job_id: string
  worker_id: string
  jobs: {
    title: string | null
    location: string | null
    trade: string | null
  } | null
  worker: {
    full_name: string | null
    trade: string | null
    city: string | null
    state: string | null
  } | null
}

export default function CompanyInvitesPage() {
  const [invites, setInvites] = useState<SentInvite[]>([])
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
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
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
          title,
          location,
          trade
        ),
        worker:profiles!job_invites_worker_id_fkey (
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
      setLoading(false)
      return
    }

    setInvites((data as unknown as SentInvite[]) || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-gray-600">Loading sent invites...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sent Invites</h1>
          <p className="mt-2 text-gray-600">
            Track workers you invited to your jobs.
          </p>
        </div>

        <Link
          href="/workers"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Invite More Workers
        </Link>
      </div>

      {message && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      {invites.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            No sent invites yet
          </h2>
          <p className="mt-2 text-gray-600">
            Invite workers from the Find Workers page.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {invites.map((invite) => {
            const status = invite.status || 'pending'
            const workerName = invite.worker?.full_name || 'Unnamed Worker'
            const workerLocation =
              [invite.worker?.city, invite.worker?.state]
                .filter(Boolean)
                .join(', ') || 'Location not listed'

            return (
              <div
                key={invite.id}
                className="rounded-2xl border bg-white p-6 shadow-sm"
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
                      {status}
                    </span>

                    <h2 className="mt-3 text-xl font-bold text-gray-900">
                      {workerName}
                    </h2>

                    <p className="mt-1 text-sm text-gray-600">
                      {invite.worker?.trade || 'Trade not listed'} ·{' '}
                      {workerLocation}
                    </p>

                    <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                      <p>
                        <strong>Job:</strong>{' '}
                        {invite.jobs?.title || 'Untitled Job'}
                      </p>
                      <p>
                        <strong>Trade:</strong>{' '}
                        {invite.jobs?.trade || 'Not listed'}
                      </p>
                      <p>
                        <strong>Location:</strong>{' '}
                        {invite.jobs?.location || 'Not listed'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/profile/${invite.worker_id}`}
                      className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-100"
                    >
                      Worker Profile
                    </Link>

                    <Link
                      href={`/jobs/${invite.job_id}`}
                      className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-100"
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