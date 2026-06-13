'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Notification = {
  id: string
  user_id: string | null
  type: string | null
  title: string | null
  body: string | null
  message: string | null
  link: string | null
  href: string | null
  is_read: boolean | null
  read: boolean | null
  created_at: string | null
}

type NotificationUpdate = {
  is_read: boolean
  read: boolean
}

type QueryError = {
  message: string
}

type LimitQuery<T> = {
  limit: (
    count: number
  ) => Promise<{ data: T[] | null; error: QueryError | null }>
}

type OrderQuery<T> = {
  order: (
    column: string,
    options?: { ascending?: boolean }
  ) => LimitQuery<T>
}

type EqOrderQuery<T> = {
  eq: (column: string, value: string) => OrderQuery<T>
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

function notificationsSelectTable() {
  return supabase.from('notifications') as unknown as SelectTable<Notification>
}

function notificationsUpdateTable() {
  return supabase
    .from('notifications') as unknown as UpdateTable<NotificationUpdate>
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const unreadCount = useMemo(() => {
    return notifications.filter(
      (notification) => !notification.is_read && !notification.read
    ).length
  }, [notifications])

  useEffect(() => {
    let mounted = true

    async function loadNotifications() {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (mounted) {
          setNotifications([])
          setLoading(false)
        }

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
          message,
          link,
          href,
          is_read,
          read,
          created_at
        `
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!mounted) return

      if (error) {
        setNotifications([])
        setLoading(false)
        return
      }

      setNotifications(data ?? [])
      setLoading(false)
    }

    loadNotifications()

    const intervalId = setInterval(loadNotifications, 30000)

    return () => {
      mounted = false
      clearInterval(intervalId)
    }
  }, [])

  async function markAllRead() {
    const unreadIds = notifications
      .filter((notification) => !notification.is_read && !notification.read)
      .map((notification) => notification.id)

    if (unreadIds.length === 0) return

    setNotifications((current) =>
      current.map((notification) =>
        unreadIds.includes(notification.id)
          ? { ...notification, is_read: true, read: true }
          : notification
      )
    )

    await notificationsUpdateTable()
      .update({
        is_read: true,
        read: true,
      })
      .in('id', unreadIds)
  }

  async function handleOpen() {
    const nextOpen = !open
    setOpen(nextOpen)

    if (nextOpen) {
      await markAllRead()
    }
  }

  function formatDate(value: string | null) {
    if (!value) return ''

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return ''

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="relative rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-900 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
      >
        Notifications

        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-black text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-80 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div>
              <p className="text-sm font-black text-slate-950">
                Notifications
              </p>

              <p className="text-xs font-bold text-slate-500">
                {unreadCount} unread
              </p>
            </div>

            <button
              type="button"
              onClick={markAllRead}
              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200"
            >
              Clear
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm font-bold text-slate-500">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-sm font-bold text-slate-500">
                No notifications yet.
              </div>
            ) : (
              notifications.map((notification) => {
                const href = notification.href || notification.link || null

                const content = (
                  <div className="block border-b border-slate-100 p-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-black text-slate-950">
                        {notification.title ||
                          notification.type ||
                          'Notification'}
                      </p>

                      <span className="text-xs font-bold text-slate-400">
                        {formatDate(notification.created_at)}
                      </span>
                    </div>

                    <p className="mt-1 text-sm font-semibold leading-5 text-slate-600">
                      {notification.body ||
                        notification.message ||
                        'You have a new CrewCall update.'}
                    </p>
                  </div>
                )

                if (href) {
                  return (
                    <Link key={notification.id} href={href}>
                      {content}
                    </Link>
                  )
                }

                return <div key={notification.id}>{content}</div>
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}