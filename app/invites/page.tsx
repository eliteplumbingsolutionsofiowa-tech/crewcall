'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: 'company' | 'worker' | null
  full_name?: string | null
  company_name?: string | null
}

type InviteJob = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  status: string | null
}

type InviteCompany = {
  id?: string
  full_name: string | null
  company_name: string | null
}

type InviteWorker = {
  id?: string
  full_name: string | null
}

type Invite = {
  id: string
  status: string
  job_id: string
  worker_id: string
  company_id: string
  created_at: string
  worker_seen: boolean | null
  company_seen: boolean | null
  jobs: InviteJob | null
  company: InviteCompany | null
  worker: InviteWorker | null
}

type RawInvite = Omit<Invite, 'jobs' | 'company' | 'worker'> & {
  jobs: InviteJob | InviteJob[] | null
  company: InviteCompany | InviteCompany[] | null
  worker: InviteWorker | InviteWorker[] | null
}

type ProfileFile = {
  id: string
  user_id: string
  category: string | null
  file_url: string | null
  created_at: string
}

type InviteStatus = 'all' | 'pending' | 'accepted' | 'declined'

type InviteUpdate = {
  status?: string
  worker_seen?: boolean
  company_seen?: boolean
}

type JobUpdate = {
  status: string
  assigned_worker_id: string
}

type NotificationInsert = {
  user_id: string
  type: string
  title: string
  body: string
  link_url: string
  is_read: boolean
  read?: boolean
}

function firstOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value
}

function normalizeInvite(raw: RawInvite): Invite {
  return {
    ...raw,
    jobs: firstOrNull(raw.jobs),
    company: firstOrNull(raw.company),
    worker: firstOrNull(raw.worker),
  }
}

export default function InvitesPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [profileFiles, setProfileFiles] = useState<ProfileFile[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState<InviteStatus>('all')
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadInvites = useCallback(async () => {
    setLoading(true)
    setRefreshing(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to view invites.')
      setInvites([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name, company_name')
      .eq('id', user.id)
      .maybeSingle<Profile>()

    if (profileError) {
      setMessage(profileError.message)
      setInvites([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const currentProfile = profileData || null

    setProfile(currentProfile)

    if (!currentProfile?.role) {
      setMessage('Profile role missing.')
      setInvites([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    if (currentProfile.role === 'worker') {
      await supabase
        .from('job_invites')
        .update({
          worker_seen: true,
        } satisfies InviteUpdate)
        .match({
          worker_id: user.id,
          worker_seen: false,
        })
    }

    if (currentProfile.role === 'company') {
      await supabase
        .from('job_invites')
        .update({
          company_seen: true,
        } satisfies InviteUpdate)
        .match({
          company_id: user.id,
          company_seen: false,
        })
    }

    window.dispatchEvent(new Event('crewcall-refresh-nav'))

    const filterColumn =
      currentProfile.role === 'company' ? 'company_id' : 'worker_id'

    const { data, error } = await supabase
      .from('job_invites')
      .select(
        `
        id,
        status,
        job_id,
        worker_id,
        company_id,
        created_at,
        worker_seen,
        company_seen,
        jobs:job_id (
          id,
          title,
          trade,
          location,
          pay_rate,
          status
        ),
        company:profiles!job_invites_company_id_fkey (
          id,
          full_name,
          company_name
        ),
        worker:profiles!job_invites_worker_id_fkey (
          id,
          full_name
        )
      `
      )
      .eq(filterColumn, user.id)
      .order('created_at', { ascending: false })
      .returns<RawInvite[]>()

    if (error) {
      setMessage(error.message)
      setInvites([])
      setLoading(false)
      setRefreshing(false)
      return
    }
        const cleaned = (data ?? []).map(normalizeInvite)

    setInvites(cleaned)

    const userIds = Array.from(
      new Set(
        cleaned.flatMap((invite) => [
          invite.company_id,
          invite.worker_id,
        ])
      )
    )

    if (userIds.length > 0) {
      const { data: files } = await supabase
        .from('profile_files')
        .select('id, user_id, category, file_url, created_at')
        .in('user_id', userIds)
        .eq('category', 'profile_photo')
        .order('created_at', { ascending: false })
        .returns<ProfileFile[]>()

      setProfileFiles(files ?? [])
    } else {
      setProfileFiles([])
    }

    window.dispatchEvent(new Event('crewcall-refresh-nav'))

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    let mounted = true

    async function refresh() {
      if (!mounted) return

      await loadInvites()

      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    }

    void refresh()

    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    window.addEventListener('crewcall-refresh-nav', refresh)

    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }

    document.addEventListener(
      'visibilitychange',
      visibilityHandler
    )

    const inviteChannel = supabase
      .channel('crewcall-invites')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_invites',
        },
        () => {
          void refresh()
        }
      )
      .subscribe()

    const notificationChannel = supabase
      .channel('crewcall-invite-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          void refresh()
        }
      )
      .subscribe()

    return () => {
      mounted = false

      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      window.removeEventListener(
        'crewcall-refresh-nav',
        refresh
      )

      document.removeEventListener(
        'visibilitychange',
        visibilityHandler
      )

      void supabase.removeChannel(inviteChannel)
      void supabase.removeChannel(notificationChannel)
    }
  }, [loadInvites])

  const photoByUserId = useMemo(() => {
    const map = new Map<string, string>()

    for (const file of profileFiles) {
      if (
        file.user_id &&
        file.category === 'profile_photo' &&
        file.file_url &&
        !map.has(file.user_id)
      ) {
        map.set(file.user_id, file.file_url)
      }
    }

    return map
  }, [profileFiles])

  const filteredInvites = useMemo(() => {
    if (filter === 'all') return invites

    return invites.filter((invite) => invite.status === filter)
  }, [invites, filter])

  const counts = useMemo(
    () => ({
      all: invites.length,
      pending: invites.filter((i) => i.status === 'pending').length,
      accepted: invites.filter((i) => i.status === 'accepted').length,
      declined: invites.filter((i) => i.status === 'declined').length,
    }),
    [invites]
  )
    async function acceptInvite(invite: Invite) {
    setWorkingId(invite.id)
    setMessage('')

    const { error: inviteError } = await supabase
      .from('job_invites')
      .update({
        status: 'accepted',
        worker_seen: true,
        company_seen: false,
      } satisfies InviteUpdate)
      .eq('id', invite.id)

    if (inviteError) {
      setMessage(inviteError.message)
      setWorkingId(null)
      return
    }

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        status: 'assigned',
        assigned_worker_id: invite.worker_id,
      } satisfies JobUpdate)
      .eq('id', invite.job_id)

    if (jobError) {
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
      } satisfies InviteUpdate)
      .eq('job_id', invite.job_id)
      .neq('id', invite.id)

    await supabase.from('notifications').insert({
      user_id: invite.company_id,
      type: 'invite',
      title: 'Worker accepted invite',
      body: `${invite.worker?.full_name || 'A worker'} accepted your invite.`,
      link_url: `/jobs/${invite.job_id}`,
      is_read: false,
      read: false,
    } satisfies NotificationInsert)

    window.dispatchEvent(new Event('crewcall-refresh-nav'))

    await loadInvites()
    setWorkingId(null)
  }

  async function declineInvite(invite: Invite) {
    setWorkingId(invite.id)
    setMessage('')

    const { error } = await supabase
      .from('job_invites')
      .update({
        status: 'declined',
        worker_seen: true,
        company_seen: false,
      } satisfies InviteUpdate)
      .eq('id', invite.id)

    if (error) {
      setMessage(error.message)
      setWorkingId(null)
      return
    }

    await supabase.from('notifications').insert({
      user_id: invite.company_id,
      type: 'invite',
      title: 'Worker declined invite',
      body: `${invite.worker?.full_name || 'A worker'} declined your invite.`,
      link_url: `/jobs/${invite.job_id}`,
      is_read: false,
      read: false,
    } satisfies NotificationInsert)

    window.dispatchEvent(new Event('crewcall-refresh-nav'))

    await loadInvites()
    setWorkingId(null)
  }

  function getOtherParty(invite: Invite) {
    if (profile?.role === 'worker') {
      return invite.company?.company_name || invite.company?.full_name || 'Company'
    }

    return invite.worker?.full_name || 'Worker'
  }

  function getOtherPartyId(invite: Invite) {
    if (profile?.role === 'worker') {
      return invite.company_id
    }

    return invite.worker_id
  }

  function getOtherPartyPhoto(invite: Invite) {
    return photoByUserId.get(getOtherPartyId(invite)) || null
  }

  function statusClasses(status: string) {
    if (status === 'accepted') {
      return 'border-emerald-300/20 bg-emerald-400/15 text-emerald-100'
    }

    if (status === 'declined') {
      return 'border-red-300/20 bg-red-400/15 text-red-100'
    }

    return 'border-yellow-300/20 bg-yellow-400/15 text-yellow-100'
  }

  function messageHref(invite: Invite) {
    if (profile?.role === 'worker') {
      return `/messages?user=${invite.company_id}&job=${invite.job_id}`
    }

    return `/messages?user=${invite.worker_id}&job=${invite.job_id}`
  }
    return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  CrewCall Invites
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Invites
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  {profile?.role === 'worker'
                    ? 'Review job invites from companies and accept or decline opportunities.'
                    : 'Track invites you sent to workers and monitor responses.'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <StatCard label="All" value={counts.all} />
                <StatCard label="Pending" value={counts.pending} />
                <StatCard label="Accepted" value={counts.accepted} />
                <StatCard label="Declined" value={counts.declined} />
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6 md:p-8">
            {message && (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100">
                {message}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {(['all', 'pending', 'accepted', 'declined'] as const).map(
                (status) => (
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
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => void loadInvites()}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {loading ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-8">
                <p className="text-lg font-black text-white">
                  Loading invites...
                </p>
              </div>
            ) : filteredInvites.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-8 text-center">
                <p className="text-xl font-black text-white">
                  No invites found.
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-400">
                  Your invite activity will appear here.
                </p>
              </div>
            ) : (
              <div className="grid gap-5">
                {filteredInvites.map((invite) => {
                  const otherParty = getOtherParty(invite)
                  const otherPhoto = getOtherPartyPhoto(invite)

                  return (
                    <div
                      key={invite.id}
                      className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-xl shadow-black/10 transition hover:border-cyan-300/30"
                    >
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex flex-1 gap-4">
                          {otherPhoto ? (
                            <img
                              src={otherPhoto}
                              alt={otherParty}
                              className="h-20 w-20 shrink-0 rounded-3xl border border-white/10 object-cover shadow-lg"
                            />
                          ) : (
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 text-3xl font-black text-white shadow-lg">
                              {otherParty.charAt(0)}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <h2 className="truncate text-3xl font-black text-white">
                                {invite.jobs?.title || 'Untitled Job'}
                              </h2>

                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${statusClasses(
                                  invite.status
                                )}`}
                              >
                                {invite.status}
                              </span>
                            </div>

                            <p className="mt-3 text-sm font-semibold text-slate-300">
                              {profile?.role === 'worker' ? 'From' : 'To'}:{' '}
                              <span className="font-black text-white">
                                {otherParty}
                              </span>
                            </p>

                            <p className="mt-3 text-sm font-semibold text-slate-400">
                              {invite.jobs?.trade || 'Trade not listed'} •{' '}
                              {invite.jobs?.location || 'Location not listed'}
                            </p>

                            <p className="mt-2 text-2xl font-black text-cyan-300">
                              {invite.jobs?.pay_rate || 'Pay not listed'}
                            </p>

                            <p className="mt-3 text-xs font-semibold text-slate-500">
                              Sent{' '}
                              {new Date(invite.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 lg:justify-end">
                          <Link
                            href={`/jobs/${invite.job_id}`}
                            className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
                          >
                            View Job
                          </Link>

                          <Link
                            href={`/profile?user=${getOtherPartyId(invite)}`}
                            className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
                          >
                            View Profile
                          </Link>

                          <Link
                            href={messageHref(invite)}
                            className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400"
                          >
                            Message
                          </Link>

                          {profile?.role === 'worker' &&
                            invite.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void acceptInvite(invite)}
                                  disabled={workingId === invite.id}
                                  className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white hover:bg-emerald-400 disabled:opacity-60"
                                >
                                  {workingId === invite.id
                                    ? 'Accepting...'
                                    : 'Accept'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void declineInvite(invite)}
                                  disabled={workingId === invite.id}
                                  className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-black text-white hover:bg-red-400 disabled:opacity-60"
                                >
                                  {workingId === invite.id
                                    ? 'Declining...'
                                    : 'Decline'}
                                </button>
                              </>
                            )}
                        </div>
                      </div>
                    </div>
                  )
                })}
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