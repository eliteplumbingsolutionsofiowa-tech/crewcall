'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
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

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadUserAndNotifications()
  }, [])

  useEffect(() => {
    if (!userId) return

    const channelName = `notifications-bell-${userId}-${Date.now()}`

    const channel = supabase.channel(channelName)

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        loadNotifications(userId)
      }
    )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  async function loadUserAndNotifications() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setUserId(null)
      setNotifications([])
      return
    }

    setUserId(user.id)
    await loadNotifications(user.id)
  }

  async function loadNotifications(currentUserId: string) {
    setLoading(true)

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
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Notification load error:', error.message)
      setNotifications([])
      setLoading(false)
      return
    }

    setNotifications((data as Notification[]) || [])
    setLoading(false)
  }

  const unreadCount = useMemo(() => {
    return notifications.filter((notification) => !notification.is_read).length
  }, [notifications])

  async function markAllRead() {
    if (!userId) return

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) {
      console.error('Mark all read error:', error.message)
      return
    }

    await loadNotifications(userId)
  }

  async function handleOpen() {
    const nextOpen = !open
    setOpen(nextOpen)

    if (nextOpen && userId) {
      await loadNotifications(userId)
      await markAllRead()
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="relative rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-100"
      >
        🔔

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-black text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-80 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-gray-900">Notifications</h3>

            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {loading ? (
              <div className="rounded-xl bg-gray-50 p-4 text-sm font-semibold text-gray-500">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                No notifications yet.
              </div>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className={`block rounded-xl border p-3 transition hover:shadow-sm ${
                    notification.is_read
                      ? 'border-gray-100 bg-gray-50'
                      : 'border-blue-100 bg-blue-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-black text-gray-900">
                      {notification.title || 'CrewCall Notification'}
                    </p>

                    {!notification.is_read && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white">
                        NEW
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs leading-relaxed text-gray-600">
                    {notification.body || 'No additional details.'}
                  </p>

                  <p className="mt-2 text-[11px] font-semibold text-gray-400">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}