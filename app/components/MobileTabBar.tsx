'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Role = 'company' | 'worker' | null

type Profile = {
  role: Role
}

export default function MobileTabBar() {
  const pathname = usePathname()
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<Role>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)

  const loadCounts = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setUserId(null)
      setRole(null)
      setUnreadMessages(0)
      setUnreadNotifications(0)
      return
    }

    setUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle<Profile>()

    setRole(profile?.role ?? null)

    const { count: messageCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false)

    const { count: notificationCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .or('is_read.eq.false,read.eq.false')

    setUnreadMessages(messageCount ?? 0)
    setUnreadNotifications(notificationCount ?? 0)
  }, [])

  useEffect(() => {
    loadCounts()

    const refresh = () => {
      loadCounts()
    }

    window.addEventListener('crewcall-refresh-nav', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)

    const messagesChannel = supabase
      .channel('mobile-tab-messages-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        refresh
      )
      .subscribe()

    const notificationsChannel = supabase
      .channel('mobile-tab-notifications-live')
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
      supabase.removeChannel(messagesChannel)
      supabase.removeChannel(notificationsChannel)
    }
  }, [loadCounts])

  async function handleLogout() {
    setLoggingOut(true)

    await supabase.auth.signOut()

    setUserId(null)
    setRole(null)
    setUnreadMessages(0)
    setUnreadNotifications(0)

    window.dispatchEvent(new Event('crewcall-refresh-nav'))

    router.push('/login')
    router.refresh()
  }

  const jobsHref = useMemo(() => {
    if (role === 'company') return '/my-jobs'
    return '/jobs'
  }, [role])

  const alertsCount = unreadMessages + unreadNotifications

  if (!userId) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-slate-950/90 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-2xl shadow-black/40 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2 rounded-[2rem] border border-white/10 bg-white/10 p-2">
          <TabItem
            href="/"
            label="Home"
            icon="⌂"
            active={pathname === '/'}
          />

          <TabItem
            href="/login"
            label="Login"
            icon="→"
            active={pathname.startsWith('/login')}
          />
        </div>
      </nav>
    )
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-slate-950/90 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-2xl shadow-black/40 backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-6 gap-2 rounded-[2rem] border border-white/10 bg-white/10 p-2">
        <TabItem
          href="/dashboard"
          label="Home"
          icon="⌂"
          active={pathname === '/dashboard'}
        />

        <TabItem
          href={jobsHref}
          label={role === 'company' ? 'Jobs' : 'Find'}
          icon="⚒"
          active={
            pathname.startsWith('/jobs') ||
            pathname.startsWith('/my-jobs') ||
            pathname.startsWith('/company/jobs')
          }
        />

        <TabItem
          href="/messages"
          label="Chat"
          icon="✉"
          count={unreadMessages}
          active={pathname.startsWith('/messages')}
        />

        <TabItem
          href="/notifications"
          label="Alerts"
          icon="!"
          count={alertsCount}
          active={pathname.startsWith('/notifications')}
        />

        <TabItem
          href="/profile"
          label="Profile"
          icon="●"
          active={pathname.startsWith('/profile')}
        />

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="
            relative flex flex-col items-center justify-center
            rounded-2xl
            px-2 py-2
            text-xs font-black
            text-red-200
            transition
            hover:bg-red-500/20
            hover:text-white
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          <span className="text-lg leading-none">×</span>
          <span className="mt-1 leading-none">
            {loggingOut ? 'Out...' : 'Logout'}
          </span>
        </button>
      </div>
    </nav>
  )
}

function TabItem({
  href,
  label,
  icon,
  active,
  count = 0,
}: {
  href: string
  label: string
  icon: string
  active: boolean
  count?: number
}) {
  return (
    <Link
      href={href}
      className={`relative flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-xs font-black transition ${
        active
          ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20'
          : 'text-slate-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="mt-1 leading-none">{label}</span>

      {count > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow-lg shadow-orange-500/30">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}