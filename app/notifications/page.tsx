'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Notification = {
  id: string
  user_id: string
  type: string | null
  title: string | null
  body: string | null
  link_url: string | null
  is_read: boolean | null
  read: boolean | null
  created_at: string
}

type NotificationUpdate = {
  is_read: boolean
  read: boolean
}

type Filter = 'all' | 'unread' | 'read'

type QueryError = {
  message: string
}

type OrderedQuery<T> = {
  order: (
    column: string,
    options?: { ascending?: boolean }
  ) => Promise<{ data: T[] | null; error: QueryError | null }>
}

type EqOrderQuery<T> = {
  eq: (column: string, value: string) => OrderedQuery<T>
}

type SelectTable<T> = {
  select: (columns: string) => EqOrderQuery<T>
}

type UpdateInQuery = {
  in: (
    column: string,
    values: string[]
  ) => Promise<{ data: null; error: QueryError | null }>
}

type UpdateTable<TUpdate> = {
  update: (value: TUpdate) => UpdateInQuery
}

type DeleteEqQuery = {
  eq: (
    column: string,
    value: string
  ) => Promise<{ data: null; error: QueryError | null }>
}

type DeleteTable = {
  delete: () => DeleteEqQuery
}

function notificationsSelectTable() {
  return supabase.from('notifications') as unknown as SelectTable<Notification>
}

function notificationsUpdateTable() {
  return supabase
    .from('notifications') as unknown as UpdateTable<NotificationUpdate>
}

function notificationsDeleteTable() {
  return supabase.from('notifications') as unknown as DeleteTable
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const loadNotifications = useCallback(async () => {
    setRefreshing(true)
    setErrorMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setErrorMessage('You must be logged in.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data, error } = await notificationsSelectTable()
      .select(
        `
        id,
        user_id,
        type,
        title,
        body,
        link_url,
        is_read,
        read,
        created_at
      `
      )
      .eq('user_id', user.id)
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      setErrorMessage(error.message)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const loaded = data || []

    setNotifications(loaded)

    const unreadIds = loaded
      .filter(
        (notification) =>
          notification.is_read === false || notification.read === false
      )
      .map((notification) => notification.id)

    if (unreadIds.length > 0) {
      await notificationsUpdateTable()
        .update({
          is_read: true,
          read: true,
        })
        .in('id', unreadIds)

      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          is_read: true,
          read: true,
        }))
      )

      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    }

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    loadNotifications()

    const refresh = () => {
      loadNotifications()
    }

    window.addEventListener('crewcall-refresh-nav', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)

    const visibility = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    document.addEventListener('visibilitychange', visibility)

    const channel = supabase
      .channel('notifications-page-live-upgraded')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        refresh
      )
      .subscribe()

    return () => {
      window.removeEventListener('crewcall-refresh-nav', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', visibility)
      supabase.removeChannel(channel)
    }
  }, [loadNotifications])

  async function markAllRead() {
    setMarkingAll(true)

    const unreadIds = notifications
      .filter(
        (notification) =>
          notification.is_read === false || notification.read === false
      )
      .map((notification) => notification.id)

    if (unreadIds.length === 0) {
      setMarkingAll(false)
      return
    }

    const { error } = await notificationsUpdateTable()
      .update({
        is_read: true,
        read: true,
      })
      .in('id', unreadIds)

    if (!error) {
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          is_read: true,
          read: true,
        }))
      )

      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    }

    setMarkingAll(false)
  }

  async function clearNotification(id: string) {
    const confirmed = window.confirm('Delete this notification permanently?')

    if (!confirmed) return

    const { error } = await notificationsDeleteTable()
      .delete()
      .eq('id', id)

    if (!error) {
      setNotifications((prev) =>
        prev.filter((notification) => notification.id !== id)
      )

      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    }
  }

  const unreadCount = notifications.filter(
    (notification) =>
      notification.is_read === false || notification.read === false
  ).length

  const filteredNotifications = useMemo(() => {
    const term = search.trim().toLowerCase()

    return notifications.filter((notification) => {
      const unread =
        notification.is_read === false || notification.read === false

      const matchesFilter =
        filter === 'all' ? true : filter === 'unread' ? unread : !unread

      const haystack = [notification.title, notification.body, notification.type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !term || haystack.includes(term)

      return matchesFilter && matchesSearch
    })
  }, [notifications, search, filter])

  function badgeClass(type: string | null) {
    if (!type) {
      return 'bg-slate-400/20 text-slate-100 border-slate-300/20'
    }

    const lowered = type.toLowerCase()

    if (lowered.includes('payment')) {
      return 'bg-emerald-400/20 text-emerald-100 border-emerald-300/20'
    }

    if (lowered.includes('message')) {
      return 'bg-cyan-400/20 text-cyan-100 border-cyan-300/20'
    }

    if (lowered.includes('invite')) {
      return 'bg-purple-400/20 text-purple-100 border-purple-300/20'
    }

    return 'bg-orange-400/20 text-orange-100 border-orange-300/20'
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black">Loading notifications...</p>
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
                  Alerts Center
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Notifications
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Realtime CrewCall alerts for messages, jobs, applications,
                  invites, and payments.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Total" value={notifications.length} />
                <StatCard label="Unread" value={unreadCount} />
                <StatCard
                  label="Read"
                  value={notifications.length - unreadCount}
                />
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6 md:p-8">
            {errorMessage && (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100">
                {errorMessage}
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_220px_auto_auto] lg:items-end">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                    Search
                  </label>

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search notifications..."
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                    Filter
                  </label>

                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as Filter)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
                  >
                    <option value="all">All</option>
                    <option value="unread">Unread</option>
                    <option value="read">Read</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={loadNotifications}
                  className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                >
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>

                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={markingAll || unreadCount === 0}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {markingAll ? 'Updating...' : 'Mark All Read'}
                </button>
              </div>
            </div>

            {filteredNotifications.length === 0 ? (
              <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-10 text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-cyan-400/10 text-5xl">
                  🔔
                </div>

                <h2 className="mt-6 text-3xl font-black text-white">
                  No notifications
                </h2>

                <p className="mt-3 text-sm font-bold text-slate-400">
                  Job updates, applications, messages, invites, and payment
                  alerts will appear here.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredNotifications.map((notification) => {
                  const unread =
                    notification.is_read === false ||
                    notification.read === false

                  return (
                    <article
                      key={notification.id}
                      className={`rounded-[2rem] border p-5 shadow-xl transition ${
                        unread
                          ? 'border-cyan-300/20 bg-cyan-400/10'
                          : 'border-white/10 bg-slate-950/60 hover:border-cyan-400/20'
                      }`}
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            {unread && (
                              <span className="rounded-full border border-cyan-300/20 bg-cyan-400/20 px-3 py-1 text-xs font-black uppercase tracking-wide text-cyan-100">
                                New
                              </span>
                            )}

                            {notification.type && (
                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${badgeClass(
                                  notification.type
                                )}`}
                              >
                                {notification.type}
                              </span>
                            )}
                          </div>

                          <h2 className="text-2xl font-black text-white">
                            {notification.title || 'Notification'}
                          </h2>

                          {notification.body && (
                            <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-300">
                              {notification.body}
                            </p>
                          )}

                          <p className="mt-5 text-xs font-black uppercase tracking-wide text-slate-500">
                            {new Date(notification.created_at).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-3 lg:justify-end">
                          {notification.link_url && (
                            <Link
                              href={notification.link_url}
                              className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300"
                            >
                              Open
                            </Link>
                          )}

                          <button
                            type="button"
                            onClick={() => clearNotification(notification.id)}
                            className="rounded-2xl border border-red-300/20 bg-red-400/15 px-5 py-3 text-sm font-black text-red-100 transition hover:bg-red-400/25"
                          >
                            Delete
                          </button>
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