'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type UserRole = 'worker' | 'company' | null

export default function Navbar() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [role, setRole] = useState<UserRole>(null)

  useEffect(() => {
    let activeChannel: ReturnType<typeof supabase.channel> | null = null
    let isMounted = true

    async function fetchUnreadCount(userId: string) {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false)

      if (!error && isMounted) {
        setUnreadCount(count || 0)
      }
    }

    async function loadNavbarData() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const user = session?.user

      if (!user) {
        if (isMounted) {
          setUnreadCount(0)
          setRole(null)
        }
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (!profileError && isMounted) {
        setRole((profile?.role as UserRole) || null)
      }

      await fetchUnreadCount(user.id)

      const channelName = `notifications-nav-${user.id}-${Date.now()}`

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
          await fetchUnreadCount(user.id)
        }
      )

      activeChannel.subscribe()
    }

    loadNavbarData()

    return () => {
      isMounted = false
      if (activeChannel) {
        supabase.removeChannel(activeChannel)
      }
    }
  }, [])

  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-2xl font-bold text-gray-900">
          CrewCall
        </Link>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <Link
            href="/jobs"
            className="rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Jobs
          </Link>

          {role === 'worker' && (
            <Link
              href="/my-applications"
              className="rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              My Applications
            </Link>
          )}

          {role === 'company' && (
            <>
              <Link
                href="/company/jobs"
                className="rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                My Jobs
              </Link>

              <Link
                href="/jobs/new"
                className="rounded-xl bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Post Job
              </Link>
            </>
          )}

          <Link
            href="/messages"
            className="rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Messages
          </Link>

          <Link
            href="/notifications"
            className="relative rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Notifications

            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          <Link
            href="/profile"
            className="rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Profile
          </Link>
        </div>
      </div>
    </nav>
  )
}