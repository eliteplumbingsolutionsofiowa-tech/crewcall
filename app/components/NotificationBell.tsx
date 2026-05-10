'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Notification = {
  id: string
  user_id: string
  title: string | null
  body: string | null
  link_url: string | null
  read: boolean | null
  created_at: string
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    loadNotifications()
  }, [])

  async function loadNotifications() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    setUserId(user.id)

    const { data } = await supabase
      .from('notifications')
      .select('id, user_id, title, body, link_url, read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    setNotifications((data || []) as Notification[])
  }

  async function markAllRead() {
    if (!userId) return

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)

    await loadNotifications()
  }

  async function handleOpen() {
    setOpen(!open)
    await loadNotifications()
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
      >
        🔔

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-black text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-80 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-gray-900">
              Notifications
            </h3>

            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {notifications.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                No notifications yet.
              </div>
            ) : (
              notifications.map((notification) => {
                const content = (
                  <div
                    className={`rounded-xl border p-3 ${
                      notification.read
                        ? 'border-gray-100 bg-gray-50'
                        : 'border-blue-100 bg-blue-50'
                    }`}
                  >
                    <p className="text-sm font-black text-gray-900">
                      {notification.title || 'CrewCall Notification'}
                    </p>

                    <p className="mt-1 text-xs text-gray-600">
                      {notification.body || ''}
                    </p>

                    <p className="mt-2 text-[11px] font-semibold text-gray-400">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                )

                if (notification.link_url) {
                  return (
                    <Link
                      key={notification.id}
                      href={notification.link_url}
                      onClick={() => setOpen(false)}
                    >
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