'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  start_date: string | null
}

type Company = {
  id: string
  full_name: string | null
  company_name: string | null
  city: string | null
  state: string | null
}

type Invite = {
  id: string
  job_id: string
  worker_id: string
  company_id: string
  status: 'pending' | 'accepted' | 'declined' | null
  worker_seen: boolean | null
  created_at: string
  job: Job | null
  company: Company | null
}

export default function WorkerInvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'declined'>('all')
  const [workingId, setWorkingId] = useState<string | null>(null)

  const filteredInvites = useMemo(() => {
    if (filter === 'all') return invites
    return invites.filter((invite) => invite.status === filter)
  }, [invites, filter])

  const counts = useMemo(() => {
    return {
      all: invites.length,
      pending: invites.filter((invite) => invite.status === 'pending').length,
      accepted: invites.filter((invite) => invite.status === 'accepted').length,
      declined: invites.filter((invite) => invite.status === 'declined').length,
    }
  }, [invites])

  const loadInvites = useCallback(async () => {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to view worker invites.')
      setInvites([])
      setLoading(false)
      return
    }

    await supabase
      .from('job_invites')
      .update({ worker_seen: true })
      .eq('worker_id', user.id)
      .eq('worker_seen', false)

    const { data, error } = await supabase
      .from('job_invites')
      .select(
        `
        id,
        job_id,
        worker_id,
        company_id,
        status,
        worker_seen,
        created_at,
        job:jobs!job_invites_job_id_fkey (
          id,
          title,
          trade,
          location,
          pay_rate,
          start_date
        ),
        company:profiles!job_invites_company_id_fkey (
          id,
          full_name,
          company_name,
          city,
          state
        )
      `
      )
      .eq('worker_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setInvites([])
      setLoading(false)
      return
    }

    const rows = (data ?? []) as unknown as Array<
      Omit<Invite, 'job' | 'company'> & {
        job: Job | Job[] | null
        company: Company | Company[] | null
      }
    >

    const cleaned: Invite[] = rows.map((invite) => ({
      id: invite.id,
      job_id: invite.job_id,
      worker_id: invite.worker_id,
      company_id: invite.company_id,
      status: invite.status,
      worker_seen: invite.worker_seen,
      created_at: invite.created_at,
      job: Array.isArray(invite.job) ? invite.job[0] || null : invite.job || null,
      company: Array.isArray(invite.company)
        ? invite.company[0] || null
        : invite.company || null,
    }))

    setInvites(cleaned)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadInvites()
  }, [loadInvites])

  function updateInviteStatus(
    inviteId: string,
    status: 'pending' | 'accepted' | 'declined'
  ) {
    setInvites((current) =>
      current.map((invite) =>
        invite.id === inviteId
          ? {
              ...invite,
              status,
              worker_seen: true,
            }
          : invite
      )
    )
  }

  async function acceptInvite(invite: Invite) {
    const confirmed = window.confirm('Accept this invite and take this job?')
    if (!confirmed) return

    setWorkingId(invite.id)
    setMessage('')
    updateInviteStatus(invite.id, 'accepted')

    const { error: inviteError } = await supabase
      .from('job_invites')
      .update({
        status: 'accepted',
        worker_seen: true,
        company_seen: false,
      })
      .eq('id', invite.id)

    if (inviteError) {
      updateInviteStatus(invite.id, 'pending')
      setMessage(inviteError.message)
      setWorkingId(null)
      return
    }

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        status: 'assigned',
        assigned_worker_id: invite.worker_id,
      })
      .eq('id', invite.job_id)
      .is('assigned_worker_id', null)

    if (jobError) {
      updateInviteStatus(invite.id, 'pending')

      await supabase
        .from('job_invites')
        .update({
          status: 'pending',
          worker_seen: true,
          company_seen: true,
        })
        .eq('id', invite.id)

      setMessage(jobError.message)
      setWorkingId(null)
      return
    }

    await supabase
      .from('job_invites')
      .update({
        status: 'declined',
        worker_seen: true,
        company_seen: false,
      })
      .eq('job_id', invite.job_id)
      .neq('id', invite.id)

    await supabase.from('notifications').insert({
      user_id: invite.company_id,
      type: 'invite',
      title: 'Worker accepted invite',
      body: 'A worker accepted your job invite.',
      link_url: `/jobs/${invite.job_id}`,
      is_read: false,
      read: false,
    })

    setMessage('Invite accepted. Job assigned to you.')
    await loadInvites()
    setWorkingId(null)
  }

  async function declineInvite(invite: Invite) {
    const confirmed = window.confirm('Decline this invite?')
    if (!confirmed) return

    setWorkingId(invite.id)
    setMessage('')
    updateInviteStatus(invite.id, 'declined')

    const { error } = await supabase
      .from('job_invites')
      .update({
        status: 'declined',
        worker_seen: true,
        company_seen: false,
      })
      .eq('id', invite.id)

    if (error) {
      updateInviteStatus(invite.id, 'pending')
      setMessage(error.message)
      setWorkingId(null)
      return
    }

    await supabase.from('notifications').insert({
      user_id: invite.company_id,
      type: 'invite',
      title: 'Worker declined invite',
      body: 'A worker declined your job invite.',
      link_url: `/jobs/${invite.job_id}`,
      is_read: false,
      read: false,
    })

    setMessage('Invite declined.')
    await loadInvites()
    setWorkingId(null)
  }

  function companyName(invite: Invite) {
    return invite.company?.company_name || invite.company?.full_name || 'Company'
  }

  function statusClasses(status: Invite['status']) {
    if (status === 'accepted') {
      return 'border-emerald-300/20 bg-emerald-400/15 text-emerald-100'
    }

    if (status === 'declined') {
      return 'border-red-300/20 bg-red-400/15 text-red-100'
    }

    return 'border-yellow-300/20 bg-yellow-400/15 text-yellow-100'
  }

  function formatDate(value: string | null) {
    if (!value) return 'No date listed'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return 'No date listed'
    }

    return date.toLocaleDateString()
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  CrewCall Worker
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Invites
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Review job invites from companies and accept or decline opportunities.
                </p>
              </div>

              <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 text-center">
                <p className="text-3xl font-black text-cyan-100">
                  {filteredInvites.length}
                </p>

                <p className="text-xs font-black uppercase tracking-wide text-cyan-300">
                  Active Results
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6 md:p-8">
            {message && (
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-sm font-bold text-cyan-100">
                {message}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {(['all', 'pending', 'accepted', 'declined'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilter(status)}
                  className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                    filter === status
                      ? 'bg-cyan-400 text-slate-950'
                      : 'border border-white/10 bg-white/10 text-white hover:bg-white/15'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}{' '}
                  <span className="opacity-70">({counts[status]})</span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-8">
                <p className="text-lg font-black text-white">Loading invites...</p>
              </div>
            ) : filteredInvites.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-8 text-center">
                <p className="text-xl font-black text-white">No invites found.</p>

                <p className="mt-2 text-sm font-semibold text-slate-400">
                  Job invites from companies will appear here.
                </p>

                <Link
                  href="/jobs"
                  className="mt-6 inline-flex rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
                >
                  Browse Jobs
                </Link>
              </div>
            ) : (
              <div className="grid gap-5">
                {filteredInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-xl shadow-black/10 transition hover:border-cyan-300/30"
                  >
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="truncate text-3xl font-black text-white">
                            {invite.job?.title || 'Untitled Job'}
                          </h2>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${statusClasses(
                              invite.status
                            )}`}
                          >
                            {invite.status || 'pending'}
                          </span>
                        </div>

                        <p className="mt-3 text-sm font-semibold text-slate-300">
                          From:{' '}
                          <span className="font-black text-white">
                            {companyName(invite)}
                          </span>
                        </p>

                        <p className="mt-3 text-sm font-semibold text-slate-400">
                          {invite.job?.trade || 'Trade not listed'} •{' '}
                          {invite.job?.location || 'Location not listed'}
                        </p>

                        <p className="mt-2 text-2xl font-black text-cyan-300">
                          {invite.job?.pay_rate || 'Pay not listed'}
                        </p>

                        <p className="mt-2 text-sm font-semibold text-slate-400">
                          Start: {formatDate(invite.job?.start_date || null)}
                        </p>

                        <p className="mt-3 text-xs font-semibold text-slate-500">
                          Sent {new Date(invite.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3 lg:justify-end">
                        <Link
                          href={`/jobs/${invite.job_id}`}
                          className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
                        >
                          View Job
                        </Link>

                        <Link
                          href={`/profile?user=${invite.company_id}`}
                          className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
                        >
                          View Company
                        </Link>

                        <Link
                          href={`/messages?user=${invite.company_id}&job=${invite.job_id}`}
                          className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400"
                        >
                          Message
                        </Link>

                        {invite.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => acceptInvite(invite)}
                              disabled={workingId === invite.id}
                              className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white hover:bg-emerald-400 disabled:opacity-60"
                            >
                              {workingId === invite.id ? 'Accepting...' : 'Accept'}
                            </button>

                            <button
                              type="button"
                              onClick={() => declineInvite(invite)}
                              disabled={workingId === invite.id}
                              className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-black text-white hover:bg-red-400 disabled:opacity-60"
                            >
                              {workingId === invite.id ? 'Declining...' : 'Decline'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}