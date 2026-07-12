'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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

type ReadFilter = 'all' | 'unread' | 'read'
type TypeFilter =
  | 'all'
  | 'messages'
  | 'jobs'
  | 'applications'
  | 'invites'
  | 'payments'
  | 'reviews'
  | 'system'

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

type UpdateEqQuery = {
  eq: (
    column: string,
    value: string
  ) => Promise<{ data: null; error: QueryError | null }>
}

type UpdateInQuery = {
  in: (
    column: string,
    values: string[]
  ) => Promise<{ data: null; error: QueryError | null }>
}

type UpdateQuery = UpdateEqQuery & UpdateInQuery

type UpdateTable<TUpdate> = {
  update: (value: TUpdate) => UpdateQuery
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

type ToastState = {
  id: string
  title: string
  body: string | null
  linkUrl: string | null
} | null

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

function isUnread(notification: Notification) {
  return notification.is_read === false || notification.read === false
}

function categoryFor(type: string | null): TypeFilter {
  const value = (type ?? '').toLowerCase()

  if (value.includes('message')) return 'messages'
  if (value.includes('application') || value.includes('applicant')) {
    return 'applications'
  }
  if (value.includes('invite')) return 'invites'
  if (value.includes('payment') || value.includes('payout')) return 'payments'
  if (value.includes('review') || value.includes('rating')) return 'reviews'
  if (
    value.includes('job') ||
    value.includes('hire') ||
    value.includes('assigned') ||
    value.includes('completed')
  ) {
    return 'jobs'
  }

  return 'system'
}

function relativeTime(value: string) {
  const created = new Date(value)
  const now = new Date()
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - created.getTime()) / 1000)
  )

  if (seconds < 10) return 'Just now'
  if (seconds < 60) return `${seconds} seconds ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`

  return created.toLocaleString()
}

export default function NotificationsPage() {
  const router = useRouter()
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [toast, setToast] = useState<ToastState>(null)

  const showToast = useCallback((notification: Notification) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }

    setToast({
      id: notification.id,
      title: notification.title || 'New CrewCall alert',
      body: notification.body,
      linkUrl: notification.link_url,
    })

    toastTimerRef.current = setTimeout(() => {
      setToast(null)
    }, 6000)
  }, [])

  const loadNotifications = useCallback(async () => {
    setRefreshing(true)
    setErrorMessage(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setUserId(null)
        setNotifications([])
        setErrorMessage('You must be logged in.')
        return
      }

      setUserId(user.id)

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
        .order('created_at', { ascending: false })

      if (error) {
        setErrorMessage(error.message)
        return
      }

      setNotifications(data ?? [])
    } catch (error) {
      console.error('Unable to load notifications:', error)
      setErrorMessage('Unable to load notifications. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    if (!userId) return

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        loadNotifications()
      }
    }

    const refreshOnFocus = () => {
      loadNotifications()
    }

    window.addEventListener('focus', refreshOnFocus)
    window.addEventListener('pageshow', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    const channel = supabase
      .channel(`notifications-page-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const inserted = payload.new as Notification

          setNotifications((current) => {
            if (current.some((item) => item.id === inserted.id)) {
              return current
            }

            return [inserted, ...current]
          })

          showToast(inserted)
          window.dispatchEvent(new Event('crewcall-refresh-nav'))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification

          setNotifications((current) =>
            current.map((item) => (item.id === updated.id ? updated : item))
          )

          window.dispatchEvent(new Event('crewcall-refresh-nav'))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const deleted = payload.old as Partial<Notification>

          if (!deleted.id) return

          setNotifications((current) =>
            current.filter((item) => item.id !== deleted.id)
          )

          window.dispatchEvent(new Event('crewcall-refresh-nav'))
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Notifications realtime channel failed.')
          setErrorMessage(
            'Live notifications temporarily disconnected. The page will refresh when you return.'
          )
        }
      })

    return () => {
      window.removeEventListener('focus', refreshOnFocus)
      window.removeEventListener('pageshow', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      supabase.removeChannel(channel)
    }
  }, [loadNotifications, showToast, userId])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  async function markNotificationRead(notification: Notification) {
    if (!isUnread(notification)) return true

    setWorkingId(notification.id)

    const { error } = await notificationsUpdateTable()
      .update({
        is_read: true,
        read: true,
      })
      .eq('id', notification.id)

    if (error) {
      setErrorMessage(error.message)
      setWorkingId(null)
      return false
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? { ...item, is_read: true, read: true }
          : item
      )
    )

    window.dispatchEvent(new Event('crewcall-refresh-nav'))
    setWorkingId(null)
    return true
  }

  async function openNotification(notification: Notification) {
    const success = await markNotificationRead(notification)

    if (!success) return

    if (notification.link_url) {
      router.push(notification.link_url)
    }
  }

  async function markAllRead() {
    const unreadIds = notifications.filter(isUnread).map((item) => item.id)

    if (unreadIds.length === 0) return

    setMarkingAll(true)
    setErrorMessage(null)

    const { error } = await notificationsUpdateTable()
      .update({
        is_read: true,
        read: true,
      })
      .in('id', unreadIds)

    if (error) {
      setErrorMessage(error.message)
      setMarkingAll(false)
      return
    }

    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        is_read: true,
        read: true,
      }))
    )

    window.dispatchEvent(new Event('crewcall-refresh-nav'))
    setMarkingAll(false)
  }

  async function clearNotification(id: string) {
    const confirmed = window.confirm('Delete this notification permanently?')

    if (!confirmed) return

    setWorkingId(id)
    setErrorMessage(null)

    const { error } = await notificationsDeleteTable().delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      setWorkingId(null)
      return
    }

    setNotifications((current) => current.filter((item) => item.id !== id))
    window.dispatchEvent(new Event('crewcall-refresh-nav'))
    setWorkingId(null)
  }

  const unreadCount = notifications.filter(isUnread).length

  const filteredNotifications = useMemo(() => {
    const term = search.trim().toLowerCase()

    return notifications.filter((notification) => {
      const unread = isUnread(notification)

      const matchesReadFilter =
        readFilter === 'all'
          ? true
          : readFilter === 'unread'
            ? unread
            : !unread

      const matchesTypeFilter =
        typeFilter === 'all'
          ? true
          : categoryFor(notification.type) === typeFilter

      const haystack = [
        notification.title,
        notification.body,
        notification.type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !term || haystack.includes(term)

      return matchesReadFilter && matchesTypeFilter && matchesSearch
    })
  }, [notifications, readFilter, search, typeFilter])

  function badgeClass(type: string | null) {
    const category = categoryFor(type)

    if (category === 'payments') {
      return 'border-emerald-300/20 bg-emerald-400/20 text-emerald-100'
    }

    if (category === 'messages') {
      return 'border-cyan-300/20 bg-cyan-400/20 text-cyan-100'
    }

    if (category === 'invites') {
      return 'border-purple-300/20 bg-purple-400/20 text-purple-100'
    }

    if (category === 'applications') {
      return 'border-blue-300/20 bg-blue-400/20 text-blue-100'
    }

    if (category === 'jobs') {
      return 'border-orange-300/20 bg-orange-400/20 text-orange-100'
    }

    if (category === 'reviews') {
      return 'border-yellow-300/20 bg-yellow-400/20 text-yellow-100'
    }

    return 'border-slate-300/20 bg-slate-400/20 text-slate-100'
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
    <main className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      {toast && (
        <div className="fixed right-4 top-24 z-[100] w-[calc(100%-2rem)] max-w-md animate-[pulse_0.45s_ease-out_1] rounded-3xl border border-cyan-300/30 bg-slate-950/95 p-5 shadow-2xl shadow-cyan-500/20 backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400 text-xl text-slate-950">
              🔔
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                New CrewCall Alert
              </p>

              <h2 className="mt-1 truncate text-lg font-black text-white">
                {toast.title}
              </h2>

              {toast.body && (
                <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-300">
                  {toast.body}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {toast.linkUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      const notification = notifications.find(
                        (item) => item.id === toast.id
                      )

                      if (notification) {
                        openNotification(notification)
                      } else {
                        router.push(toast.linkUrl as string)
                      }

                      setToast(null)
                    }}
                    className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
                  >
                    Open
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setToast(null)}
                  className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/20"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  Live Alerts Center
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Notifications
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  New messages, jobs, applications, invites, payments, and
                  reviews appear instantly without refreshing.
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
              <div className="grid gap-4 xl:grid-cols-[1fr_190px_210px_auto_auto] xl:items-end">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                    Search
                  </label>

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search notifications..."
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                    Status
                  </label>

                  <select
                    value={readFilter}
                    onChange={(event) =>
                      setReadFilter(event.target.value as ReadFilter)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
                  >
                    <option value="all">All</option>
                    <option value="unread">Unread</option>
                    <option value="read">Read</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                    Type
                  </label>

                  <select
                    value={typeFilter}
                    onChange={(event) =>
                      setTypeFilter(event.target.value as TypeFilter)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
                  >
                    <option value="all">All Types</option>
                    <option value="messages">Messages</option>
                    <option value="jobs">Jobs</option>
                    <option value="applications">Applications</option>
                    <option value="invites">Invites</option>
                    <option value="payments">Payments</option>
                    <option value="reviews">Reviews</option>
                    <option value="system">System</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={loadNotifications}
                  disabled={refreshing}
                  className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
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
                  New CrewCall activity will appear here instantly.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredNotifications.map((notification) => {
                  const unread = isUnread(notification)

                  return (
                    <article
                      key={notification.id}
                      className={`rounded-[2rem] border p-5 shadow-xl transition ${
                        unread
                          ? 'border-cyan-300/30 bg-cyan-400/10'
                          : 'border-white/10 bg-slate-950/60 hover:border-cyan-400/20'
                      }`}
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            {unread && (
                              <span className="animate-pulse rounded-full border border-cyan-300/20 bg-cyan-400/20 px-3 py-1 text-xs font-black uppercase tracking-wide text-cyan-100">
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

                          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-wide">
                            <span className="text-cyan-300">
                              {relativeTime(notification.created_at)}
                            </span>

                            <span className="text-slate-600">•</span>

                            <span className="text-slate-500">
                              {new Date(
                                notification.created_at
                              ).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 lg:justify-end">
                          {notification.link_url && (
                            <button
                              type="button"
                              onClick={() => openNotification(notification)}
                              disabled={workingId === notification.id}
                              className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {workingId === notification.id
                                ? 'Opening...'
                                : 'Open'}
                            </button>
                          )}

                          {unread && !notification.link_url && (
                            <button
                              type="button"
                              onClick={() =>
                                markNotificationRead(notification)
                              }
                              disabled={workingId === notification.id}
                              className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {workingId === notification.id
                                ? 'Updating...'
                                : 'Mark Read'}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => clearNotification(notification.id)}
                            disabled={workingId === notification.id}
                            className="rounded-2xl border border-red-300/20 bg-red-400/15 px-5 py-3 text-sm font-black text-red-100 transition hover:bg-red-400/25 disabled:cursor-not-allowed disabled:opacity-60"
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