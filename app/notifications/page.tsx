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
  read: boolean | null
  created_at: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadNotifications() {
      setLoading(true)
      setErrorMessage(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setErrorMessage('You must be logged in to view notifications.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, body, is_read, read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        setErrorMessage(error.message)
        setLoading(false)
        return
      }

      setNotifications((data || []) as Notification[])

      await supabase
        .from('notifications')
        .update({
          is_read: true,
          read: true,
        })
        .eq('user_id', user.id)

      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          is_read: true,
          read: true,
        }))
      )

      setLoading(false)
    }

    loadNotifications()
  }, [])

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-4xl font-bold">Notifications</h1>
        <div className="mt-6 rounded-3xl border bg-white p-8 shadow-sm">
          Loading notifications...
        </div>
      </main>
    )
  }

  if (errorMessage) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-4xl font-bold">Notifications</h1>
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {errorMessage}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-2 text-gray-500">
            Updates about messages, jobs, applicants, and payments.
          </p>
        </div>

        <Link
          href="/messages"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Messages
        </Link>
      </div>

      <div className="mt-6 space-y-4">
        {notifications.length === 0 ? (
          <div className="rounded-3xl border bg-white p-8 text-gray-500 shadow-sm">
            No notifications yet.
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className="rounded-3xl border bg-white p-6 shadow-sm"
            >
              <h2 className="text-lg font-bold text-gray-900">
                {notification.title ||
                  (notification.type === 'message'
                    ? 'New Message'
                    : 'Notification')}
              </h2>

              <p className="mt-2 text-gray-600">
                {notification.body || 'No details provided.'}
              </p>

              <p className="mt-4 text-sm text-gray-400">
                {new Date(notification.created_at).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </main>
  )
}