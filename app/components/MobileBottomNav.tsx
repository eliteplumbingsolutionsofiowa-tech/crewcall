'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Role = 'company' | 'worker' | null

type Profile = {
  role: Role
}

export default function MobileBottomNav() {
  const pathname = usePathname()

  const [role, setRole] = useState<Role>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  const loadCounts = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setRole(null)
      setUnreadMessages(0)
      setUnreadNotifications(0)
      return
    }

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

    const refresh = () => loadCounts()

    window.addEventListener('crewcall-refresh-nav', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)

    const messageChannel = supabase
      .channel('crewcall-mobile-nav-messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        refresh
      )
      .subscribe()

    const notificationChannel = supabase
      .channel('crewcall-mobile-nav-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        refresh
      )
      .subscribe()

    return () => {
      window.removeEventListener('crewcall-refresh-nav', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)

      supabase.removeChannel(messageChannel)
      supabase.removeChannel(notificationChannel)
    }
  }, [loadCounts])

  const jobsHref = role === 'company' ? '/my-jobs' : '/jobs'
  const jobsLabel = role === 'company' ? 'My Jobs' : 'Jobs'
  const alertTotal = unreadMessages + unreadNotifications

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-slate-950/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-2xl shadow-black/40 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        <MobileTab
          href="/dashboard"
          label="Home"
          icon="⌂"
          active={pathname === '/dashboard'}
        />

        <MobileTab
          href={jobsHref}
          label={jobsLabel}
          icon="▣"
          active={
            role === 'company'
              ? pathname.startsWith('/my-jobs')
              : pathname.startsWith('/jobs')
          }
        />

        <MobileTab
          href="/messages"
          label="Messages"
          icon="✉"
          count={unreadMessages}
          active={pathname.startsWith('/messages')}
        />

        <MobileTab
          href="/notifications"
          label="Alerts"
          icon="!"
          count={alertTotal}
          active={pathname.startsWith('/notifications')}
        />

        <MobileTab
          href="/profile"
          label="Profile"
          icon="●"
          active={pathname.startsWith('/profile')}
        />
      </div>
    </nav>
  )
}

function MobileTab({
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
      className={`
        relative flex min-h-[58px] flex-col items-center justify-center gap-1
        rounded-2xl px-2 py-2 text-center no-underline
        transition-all duration-200 active:scale-[0.96]
        ${
          active
            ? 'border border-cyan-400/50 bg-cyan-400/15 !text-cyan-200 shadow-lg shadow-cyan-500/10'
            : 'border border-white/10 bg-slate-900/90 !text-white shadow-md shadow-black/20'
        }
      `}
    >
      <span className="text-lg leading-none !text-inherit">{icon}</span>
      <span className="text-[10px] font-black leading-none !text-inherit">
        {label}
      </span>

      {count > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-black !text-white shadow-lg shadow-orange-500/30">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}