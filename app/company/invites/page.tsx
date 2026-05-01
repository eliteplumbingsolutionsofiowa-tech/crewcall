'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { CrewButton } from '@/app/components/CrewButton'

type Invite = {
  id: string
  status: string | null
  created_at: string
  job_id: string
  company_id: string
  worker_id: string
  jobs:
    | {
        id: string
        title: string | null
        trade: string | null
        location: string | null
        pay_rate: string | null
        start_date: string | null
        status: string | null
      }[]
    | null
  company:
    | {
        id: string
        full_name: string | null
        company_name: string | null
        city: string | null
        state: string | null
      }[]
    | null
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
      .from('invites')
      .select(`
        id,
        status,
        created_at,
        job_id,
        company_id,
        worker_id,
        jobs (
          id,
          title,
          trade,
          location,
          pay_rate,
          start_date,
          status
        ),
        company:company_id (
          id,
          full_name,
          company_name,
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

  function badgeClass(status: string | null) {
    if (status === 'accepted') return 'bg-emerald-100 text-emerald-700'
    if (status === 'rejected') return 'bg-red-100 text-red-700'
    if (status === 'sent') return 'bg-blue-100 text-blue-700'
    return 'bg-amber-100 text-amber-700'
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-orange-500 p-8 text-white shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">
            Company
          </p>
          <h1 className="mt-2 text-3xl font-bold">Invites</h1>
          <p className="mt-2 max-w-2xl text-blue-50">
            Manage workers you’ve invited to your jobs.
          </p>
        </div>

        {message && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            Loading invites...
          </div>
        ) : invites.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              No invites sent
            </h2>
            <p className="mt-2 text-slate-600">
              Invite workers from your job pages.
            </p>
            <div className="mt-5">
              <CrewButton href="/my-jobs">View My Jobs</CrewButton>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {invites.map((invite) => {
              const job = invite.jobs?.[0] || null
              const company = invite.company?.[0] || null

              return (
                <div
                  key={invite.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900">
                          {job?.title || 'Untitled job'}
                        </h2>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${badgeClass(
                            invite.status
                          )}`}
                        >
                          {invite.status || 'sent'}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                        <p>Trade: {job?.trade || 'Not listed'}</p>
                        <p>Location: {job?.location || 'Not listed'}</p>
                        <p>Pay: {job?.pay_rate || 'Not listed'}</p>
                        <p>
                          Company:{' '}
                          {company?.company_name ||
                            company?.full_name ||
                            'Not listed'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/jobs/${invite.job_id}`}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
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
      </div>
    </main>
  )
}