'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Notification = {
  id: string
  user_id: string
  type: string | null
  title: string | null
  body: string | null
  is_read: boolean | null
  created_at: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    loadNotifications()

    const channelName = `notifications-page-${Date.now()}`

    const channel = supabase.channel(channelName)

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
      },
      () => {
        loadNotifications()
      }
    )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function loadNotifications() {
    setLoading(true)
    setErrorMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setNotifications([])
      setErrorMessage('You must be logged in to view notifications.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('notifications')
      .select(
        `
        id,
        user_id,
        type,
        title,
        body,
        is_read,
        created_at
      `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setNotifications([])
      setErrorMessage(error.message)
      setLoading(false)
      return
    }

    setNotifications((data as Notification[]) || [])
    setLoading(false)
  }

  async function markAllRead() {
    const unreadIds = notifications
      .filter((notification) => !notification.is_read)
      .map((notification) => notification.id)

    if (unreadIds.length === 0) return

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds)

    if (error) {
      alert(error.message)
      return
    }

    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        is_read: true,
      }))
    )
  }

  function getNotificationLink(notification: Notification) {
    switch (notification.type) {
      case 'message':
        return '/messages'

      case 'job':
        return '/jobs'

      case 'application':
        return '/applications'

      case 'invite':
        return '/company/invites'

      case 'payment':
        return '/billing'

      default:
        return '/notifications'
    }
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-orange-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[32px] bg-white/90 p-10 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.35em] text-blue-600">
                CrewCall
              </p>

              <h1 className="text-5xl font-black tracking-tight text-slate-900">
                Notifications
              </h1>

              <p className="mt-5 max-w-2xl text-xl text-slate-600">
                Live updates about messages, jobs, applicants,
                negotiations, and payments.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-bold text-green-700">
                  LIVE UPDATES ON
                </span>

                <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                  {unreadCount} UNREAD
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/messages"
                className="rounded-2xl border-2 border-blue-600 px-6 py-4 text-lg font-bold text-blue-600 transition hover:bg-blue-50"
              >
                Messages
              </Link>

              <button
                type="button"
                onClick={markAllRead}
                className="rounded-2xl bg-blue-500 px-6 py-4 text-lg font-bold text-white transition hover:bg-blue-600"
              >
                Mark All Read
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-5 text-lg font-semibold text-red-700">
              {errorMessage}
            </div>
          )}

          {loading ? (
            <div className="mt-10 rounded-3xl bg-white p-10 shadow-lg">
              <p className="text-lg text-slate-500">
                Loading notifications...
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="mt-10 rounded-3xl bg-white p-10 shadow-lg">
              <p className="text-xl text-slate-500">No notifications yet.</p>
            </div>
          ) : (
            <div className="mt-10 space-y-5">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={getNotificationLink(notification)}
                  className={`block rounded-3xl border p-6 shadow-lg transition hover:scale-[1.01] ${
                    notification.is_read
                      ? 'border-slate-200 bg-white'
                      : 'border-blue-200 bg-blue-50'
                  }`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-slate-900">
                          {notification.title || 'Notification'}
                        </h2>

                        {!notification.is_read && (
                          <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                            NEW
                          </span>
                        )}
                      </div>

                      <p className="mt-3 text-lg text-slate-600">
                        {notification.body || 'No additional details.'}
                      </p>
                    </div>

                    <div className="text-sm font-semibold text-slate-400">
                      {new Date(notification.created_at).toLocaleString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}