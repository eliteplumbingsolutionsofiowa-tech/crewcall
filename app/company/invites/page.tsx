'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: 'company' | 'worker' | null
  full_name: string | null
  company_name: string | null
}

type Invite = {
  id: string
  job_id: string
  worker_id: string
  company_id: string
  status: string | null
  company_seen: boolean | null
  created_at: string
  job: {
    id: string
    title: string | null
    trade: string | null
    location: string | null
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
  const [profile, setProfile] = useState<Profile | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState<
    'all' | 'pending' | 'accepted' | 'declined'
  >('all')

  const loadInvites = useCallback(async () => {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to view company invites.')
      setInvites([])
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name, company_name')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profileData) {
      setMessage(profileError?.message || 'Profile not found.')
      setInvites([])
      setLoading(false)
      return
    }

    const currentProfile = profileData as Profile
    setProfile(currentProfile)

    if (currentProfile.role !== 'company') {
      setMessage('Only companies can view this page.')
      setInvites([])
      setLoading(false)
      return
    }

    await supabase
      .from('job_invites')
      const supabaseUntyped = supabase as any

await supabaseUntyped
  .from('job_invites')
  .update({ company_seen: true })
  .eq('company_id', user.id)
  .eq('company_seen', false)
      .eq('company_id', user.id)
      .eq('company_seen', false)

    window.dispatchEvent(new Event('crewcall-refresh-nav'))

    const { data, error } = await supabase
      .from('job_invites')
      .select(`
        id,
        job_id,
        worker_id,
        company_id,
        status,
        company_seen,
        created_at,
        job:jobs!job_invites_job_id_fkey (
          id,
          title,
          trade,
          location
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
      setLoading(false)
      return
    }

    const cleaned: Invite[] = ((data || []) as any[]).map((invite) => ({
      id: invite.id,
      job_id: invite.job_id,
      worker_id: invite.worker_id,
      company_id: invite.company_id,
      status: invite.status || 'pending',
      company_seen: invite.company_seen,
      created_at: invite.created_at,
      job: Array.isArray(invite.job)
        ? invite.job[0] || null
        : invite.job || null,
      worker: Array.isArray(invite.worker)
        ? invite.worker[0] || null
        : invite.worker || null,
    }))

    setInvites(cleaned)
    setLoading(false)
  }, [])

  useEffect(() => {
    let mounted = true

    async function boot() {
      if (!mounted) return
      await loadInvites()
    }

    boot()

    const refresh = async () => {
      if (!mounted) return
      await loadInvites()
      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    }

    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    window.addEventListener('crewcall-refresh-nav', refresh)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    const inviteChannel = supabase
      .channel('company-invites-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_invites',
        },
        refresh
      )
      .subscribe()

    return () => {
      mounted = false
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      window.removeEventListener('crewcall-refresh-nav', refresh)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(inviteChannel)
    }
  }, [loadInvites])

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

  function statusClasses(status: string | null) {
    if (status === 'accepted') {
      return 'border-emerald-300/20 bg-emerald-400/15 text-emerald-100'
    }

    if (status === 'declined') {
      return 'border-red-300/20 bg-red-400/15 text-red-100'
    }

    return 'border-yellow-300/20 bg-yellow-400/15 text-yellow-100'
  }

  function statusLabel(status: string | null) {
    return status || 'pending'
  }

  function workerName(invite: Invite) {
    return invite.worker?.full_name || 'Worker'
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black">Loading company invites...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  Company Invites
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Sent Worker Invites
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Track every worker you invited, see who accepted, and keep
                  your company-side invite badge cleared as soon as this page
                  opens.
                </p>

                {profile?.company_name && (
                  <p className="mt-2 text-sm font-black text-cyan-200">
                    {profile.company_name}
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <StatCard label="All" value={counts.all} />
                <StatCard label="Pending" value={counts.pending} />
                <StatCard label="Accepted" value={counts.accepted} />
                <StatCard label="Declined" value={counts.declined} />
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6 md:p-8">
            {message && (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100">
                {message}
              </div>
            )}

            <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-950/50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <FilterButton
                  label="All"
                  active={filter === 'all'}
                  count={counts.all}
                  onClick={() => setFilter('all')}
                />

                <FilterButton
                  label="Pending"
                  active={filter === 'pending'}
                  count={counts.pending}
                  onClick={() => setFilter('pending')}
                />

                <FilterButton
                  label="Accepted"
                  active={filter === 'accepted'}
                  count={counts.accepted}
                  onClick={() => setFilter('accepted')}
                />

                <FilterButton
                  label="Declined"
                  active={filter === 'declined'}
                  count={counts.declined}
                  onClick={() => setFilter('declined')}
                />
              </div>

              <button
                type="button"
                onClick={loadInvites}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20"
              >
                Refresh
              </button>
            </div>

            {filteredInvites.length === 0 ? (
              <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-8 text-center">
                <p className="text-xl font-black text-white">
                  No invites found.
                </p>

                <p className="mt-2 text-sm font-bold text-slate-400">
                  Invite workers from the Find Workers or job detail screens.
                </p>

                <div className="mt-5 flex justify-center">
                  <Link
                    href="/workers"
                    className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20"
                  >
                    Find Workers
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredInvites.map((invite) => (
                  <article
                    key={invite.id}
                    className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-5 shadow-xl transition hover:border-cyan-400/20"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${statusClasses(
                              invite.status
                            )}`}
                          >
                            {statusLabel(invite.status)}
                          </span>

                          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-300">
                            Sent {new Date(invite.created_at).toLocaleString()}
                          </span>
                        </div>

                        <h2 className="text-2xl font-black text-white">
                          {workerName(invite)}
                        </h2>

                        <p className="mt-1 text-sm font-bold text-slate-300">
                          {invite.worker?.trade || 'Trade not listed'}
                          {invite.worker?.city || invite.worker?.state
                            ? ` • ${invite.worker?.city || ''}${
                                invite.worker?.city && invite.worker?.state
                                  ? ', '
                                  : ''
                              }${invite.worker?.state || ''}`
                            : ''}
                        </p>

                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                            Job Invite
                          </p>

                          <h3 className="mt-2 text-lg font-black text-white">
                            {invite.job?.title || 'Untitled Job'}
                          </h3>

                          <p className="mt-1 text-sm font-bold text-slate-400">
                            {invite.job?.trade || 'Trade not listed'} •{' '}
                            {invite.job?.location || 'Location not listed'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Link
                          href={`/jobs/${invite.job_id}`}
                          className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20"
                        >
                          View Job
                        </Link>

                        <Link
                          href={`/profile/${invite.worker_id}`}
                          className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                        >
                          Worker Profile
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 text-center">
      <p className="text-3xl font-black text-cyan-100">{value}</p>
      <p className="text-xs font-black uppercase tracking-wide text-cyan-300">
        {label}
      </p>
    </div>
  )
}

function FilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
        active
          ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20'
          : 'border border-white/10 bg-white/10 text-white hover:bg-white/20'
      }`}
    >
      {label} ({count})
    </button>
  )
}