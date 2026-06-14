'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type AdminProfile = {
  id: string
  is_admin: boolean | null
}

type UserProfile = {
  id: string
  role: 'company' | 'worker' | null
  full_name: string | null
  company_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  phone: string | null
  is_admin: boolean | null
  is_online: boolean | null
  last_seen: string | null
  created_at: string | null
}

type UserCounts = {
  total: number
  companies: number
  workers: number
  admins: number
  online: number
}

const emptyCounts: UserCounts = {
  total: 0,
  companies: 0,
  workers: 0,
  admins: 0,
  online: 0,
}

export default function AdminUsersPage() {
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'company' | 'worker' | 'admin'>(
    'all'
  )

  const loadUsers = useCallback(async () => {
    setRefreshing(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to access admin users.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data: adminData, error: adminError } = await supabase
      .from('profiles')
      .select('id, is_admin')
      .eq('id', user.id)
      .maybeSingle<AdminProfile>()

    if (adminError) {
      setMessage(adminError.message)
      setLoading(false)
      setRefreshing(false)
      return
    }

    setAdminProfile(adminData || null)

    if (!adminData?.is_admin) {
      setMessage('You do not have admin access.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select(
        `
        id,
        role,
        full_name,
        company_name,
        trade,
        city,
        state,
        phone,
        is_admin,
        is_online,
        last_seen,
        created_at
      `
      )
      .order('created_at', { ascending: false })
      .returns<UserProfile[]>()

    if (error) {
      setMessage(error.message)
      setUsers([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    setUsers(data ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const counts = useMemo<UserCounts>(() => {
    return {
      total: users.length,
      companies: users.filter((user) => user.role === 'company').length,
      workers: users.filter((user) => user.role === 'worker').length,
      admins: users.filter((user) => user.is_admin).length,
      online: users.filter((user) => isActuallyOnline(user)).length,
    }
  }, [users])

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()

    return users.filter((user) => {
      const searchable = [
        user.full_name,
        user.company_name,
        user.role,
        user.trade,
        user.city,
        user.state,
        user.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !term || searchable.includes(term)

      const matchesRole =
        roleFilter === 'all'
          ? true
          : roleFilter === 'admin'
            ? Boolean(user.is_admin)
            : user.role === roleFilter

      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl shadow-black/20 backdrop-blur">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            CrewCall Admin
          </p>
          <h1 className="mt-3 text-3xl font-black">Loading users...</h1>
        </div>
      </main>
    )
  }

  if (!adminProfile?.is_admin) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-400/20 bg-red-500/10 p-8 shadow-2xl shadow-black/20">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-red-300">
            Access denied
          </p>
          <h1 className="mt-3 text-3xl font-black text-white">
            Admin access required
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-red-100/80">
            {message || 'This page is only available to CrewCall admins.'}
          </p>
          <Link
            href="/admin"
            className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
          >
            Back to Admin
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <Link
                  href="/admin"
                  className="text-sm font-black text-cyan-300 hover:text-cyan-200"
                >
                  ← Back to Admin
                </Link>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  CrewCall Admin
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Users
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Search companies, workers, admins, online users, and newly
                  created accounts.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadUsers()}
                disabled={refreshing}
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? 'Refreshing...' : 'Refresh Users'}
              </button>
            </div>
          </div>

          <div className="space-y-6 p-6 md:p-8">
            {message && (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100">
                {message}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <AdminUserStat label="Total Users" value={counts.total} />
              <AdminUserStat label="Companies" value={counts.companies} />
              <AdminUserStat label="Workers" value={counts.workers} />
              <AdminUserStat label="Admins" value={counts.admins} />
              <AdminUserStat label="Online" value={counts.online} />
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, company, trade, city, state, phone..."
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                />

                <select
                  value={roleFilter}
                  onChange={(event) =>
                    setRoleFilter(
                      event.target.value as 'all' | 'company' | 'worker' | 'admin'
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none focus:border-cyan-300/50"
                >
                  <option value="all">All Users</option>
                  <option value="company">Companies</option>
                  <option value="worker">Workers</option>
                  <option value="admin">Admins</option>
                </select>
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-8 text-center">
                <p className="text-xl font-black text-white">No users found.</p>
                <p className="mt-2 text-sm font-semibold text-slate-400">
                  Try changing your search or filter.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                {filteredUsers.map((user) => {
                  const displayName =
                    user.company_name || user.full_name || 'Unnamed User'
                  const online = isActuallyOnline(user)

                  return (
                    <article
                      key={user.id}
                      className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-xl shadow-black/10 transition hover:border-cyan-300/30"
                    >
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 text-3xl font-black text-white shadow-lg">
                          {displayName.charAt(0).toUpperCase()}

                          <span
                            className={`absolute -right-1 -top-1 h-5 w-5 rounded-full border-4 border-slate-950 ${
                              online ? 'bg-lime-400' : 'bg-slate-500'
                            }`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-2xl font-black text-white">
                              {displayName}
                            </h2>

                            <Badge label={user.role || 'No role'} />

                            {user.is_admin && <Badge label="Admin" tone="cyan" />}
                          </div>

                          <p
                            className={`mt-1 text-xs font-black uppercase tracking-wide ${
                              online ? 'text-lime-300' : 'text-slate-500'
                            }`}
                          >
                            {presenceLabel(user)}
                          </p>

                          <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-300 sm:grid-cols-2">
                            <p>
                              <span className="text-cyan-300">Trade:</span>{' '}
                              {user.trade || 'Not listed'}
                            </p>

                            <p>
                              <span className="text-cyan-300">Phone:</span>{' '}
                              {user.phone || 'Not listed'}
                            </p>

                            <p>
                              <span className="text-cyan-300">Location:</span>{' '}
                              {[user.city, user.state].filter(Boolean).join(', ') ||
                                'Not listed'}
                            </p>

                            <p>
                              <span className="text-cyan-300">Joined:</span>{' '}
                              {formatDate(user.created_at)}
                            </p>
                          </div>

                          <div className="mt-5 grid gap-3 sm:grid-cols-3">
                            <Link
                              href={`/profile?user=${user.id}`}
                              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-white/15"
                            >
                              Profile
                            </Link>

                            <Link
                              href={`/messages?user=${user.id}`}
                              className="rounded-2xl bg-blue-500 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-blue-400"
                            >
                              Message
                            </Link>

                            <Link
                              href={`/admin/users/${user.id}`}
                              className="rounded-2xl bg-cyan-400 px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-cyan-300"
                            >
                              Manage
                            </Link>
                          </div>
                        </div>
                      </div>
                    </article>
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

function AdminUserStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-4xl font-black text-white">{value}</p>
    </div>
  )
}

function Badge({
  label,
  tone = 'slate',
}: {
  label: string
  tone?: 'slate' | 'cyan'
}) {
  const classes =
    tone === 'cyan'
      ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
      : 'border-white/10 bg-white/10 text-slate-200'

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${classes}`}
    >
      {label}
    </span>
  )
}

function isActuallyOnline(profile: UserProfile | null) {
  if (!profile?.is_online || !profile.last_seen) return false

  const lastSeen = new Date(profile.last_seen).getTime()

  if (Number.isNaN(lastSeen)) return false

  return Date.now() - lastSeen < 90_000
}

function presenceLabel(profile: UserProfile | null) {
  if (isActuallyOnline(profile)) return 'Online now'
  if (!profile?.last_seen) return 'Offline'

  return `Last seen ${formatRelativeTime(profile.last_seen)}`
}

function formatDate(value: string | null) {
  if (!value) return 'Not listed'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Not listed'

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()

  if (Number.isNaN(date.getTime())) return 'recently'

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}