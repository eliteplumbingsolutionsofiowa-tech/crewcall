'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Notification = {
  id: string
  title: string | null
  body: string | null
  read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let activeChannel: ReturnType<typeof supabase.channel> | null = null
    let isMounted = true

    async function fetchNotifications(userId: string) {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, body, read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        if (isMounted) {
          setErrorMessage(error.message)
        }
        return
      }

      if (isMounted) {
        setNotifications((data || []) as Notification[])
      }
    }

    async function loadNotifications() {
      setLoading(true)
      setErrorMessage(null)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        if (isMounted) {
          setErrorMessage(sessionError.message)
          setLoading(false)
        }
        return
      }

      const user = session?.user

      if (!user) {
        if (isMounted) {
          setErrorMessage('You must be logged in to view notifications.')
          setLoading(false)
        }
        return
      }

      await fetchNotifications(user.id)

      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)

      if (!updateError && isMounted) {
        setNotifications((prev) =>
          prev.map((item) => ({
            ...item,
            read: true,
          }))
        )
      }

      const channelName = `notifications-page-${user.id}-${Date.now()}`

      activeChannel = supabase.channel(channelName)

      activeChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          await fetchNotifications(user.id)
        }
      )

      activeChannel.subscribe()

      if (isMounted) {
        setLoading(false)
      }
    }

    loadNotifications()

    return () => {
      isMounted = false
      if (activeChannel) {
        supabase.removeChannel(activeChannel)
      }
    }
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
      <h1 className="text-4xl font-bold">Notifications</h1>

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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {notification.title || 'Notification'}
                  </h2>
                  <p className="mt-2 text-gray-600">
                    {notification.body || 'No details provided.'}
                  </p>
                </div>

                {!notification.read && (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    New
                  </span>
                )}
              </div>

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