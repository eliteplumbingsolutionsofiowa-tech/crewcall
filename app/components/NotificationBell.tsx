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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInitialNotifications()
  }, [])

  async function loadInitialNotifications() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setNotifications([])
      setUserId(null)
      setLoading(false)
      return
    }

    setUserId(user.id)
    await loadNotifications(user.id)
  }

  async function loadNotifications(currentUserId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, type, title, body, is_read, created_at')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error(error.message)
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

    const unreadIds = notifications
      .filter((notification) => !notification.is_read)
      .map((notification) => notification.id)

    if (unreadIds.length === 0) return

    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        is_read: true,
      }))
    )

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) {
      console.error(error.message)
    }
  }

  async function toggleOpen() {
    const nextOpen = !open
    setOpen(nextOpen)

    if (nextOpen) {
      await markAllRead()

      if (userId) {
        await loadNotifications(userId)
      }
    }
  }

  function getNotificationStyle(type: string | null) {
    switch (type) {
      case 'hire':
        return 'border-green-400/30 bg-green-400/10'

      case 'message':
        return 'border-cyan-400/30 bg-cyan-400/10'

      case 'payment':
        return 'border-orange-400/30 bg-orange-400/10'

      case 'payout':
        return 'border-emerald-400/30 bg-emerald-400/10'

      case 'review':
        return 'border-yellow-400/30 bg-yellow-400/10'

      default:
        return 'border-white/10 bg-white/5'
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg text-white transition hover:bg-white/10"
      >
        🔔

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[22px] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[11px] font-black text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-4 w-[360px] overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                CrewCall
              </p>

              <h3 className="mt-1 text-lg font-black text-white">
                Notifications
              </h3>
            </div>

            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-sm font-bold text-cyan-300 hover:text-cyan-200"
            >
              View All
            </Link>
          </div>

          <div className="max-h-[500px] overflow-y-auto p-4">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm font-semibold text-slate-400">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm font-semibold text-slate-400">
                No notifications yet.
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href="/notifications"
                    onClick={() => setOpen(false)}
                    className={`block rounded-2xl border p-4 transition hover:scale-[1.01] hover:border-cyan-400/30 ${getNotificationStyle(
                      notification.type
                    )}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-white">
                          {notification.title || 'CrewCall Notification'}
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {notification.body || 'No details provided.'}
                        </p>
                      </div>

                      {!notification.is_read && (
                        <div className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-400" />
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                        {notification.type || 'general'}
                      </p>

                      <p className="text-right text-[11px] text-slate-500">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}