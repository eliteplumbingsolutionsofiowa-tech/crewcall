'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type UserRole = 'worker' | 'company' | null

export default function Navbar() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [role, setRole] = useState<UserRole>(null)
  const [menuOpen, setMenuOpen] = useState(false)

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

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <nav className="sticky top-0 z-50 border-b bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-20 items-center justify-between gap-4">
          <Link
            href="/"
            onClick={closeMenu}
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-md">
              C
            </div>

            <div className="leading-tight">
              <p className="text-xl font-black text-slate-950">
                Crew<span className="text-blue-600">Call</span>
              </p>
              <p className="hidden text-xs font-bold text-slate-500 sm:block">
                Find help. Find work. Fast.
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            <NavLink href="/jobs">Jobs</NavLink>

            {role === 'worker' && (
              <>
                <NavLink href="/my-applications">Applications</NavLink>
                <NavLink href="/completed-jobs">Completed Jobs</NavLink>
                <NavLink href="/invites">Invites</NavLink>
                <NavLink href="/worker/dashboard">Dashboard</NavLink>
              </>
            )}

            {role === 'company' && (
              <>
                <NavLink href="/workers">Find Workers</NavLink>
                <NavLink href="/post-job" highlight>
                  Post Job
                </NavLink>
                <NavLink href="/my-jobs">My Jobs</NavLink>
                <NavLink href="/completed-jobs">Completed Jobs</NavLink>
                <NavLink href="/company/invites">Invites</NavLink>
                <NavLink href="/dashboard">Dashboard</NavLink>
              </>
            )}

            <NotificationLink unreadCount={unreadCount} />

            <NavLink href="/messages">Messages</NavLink>
            <NavLink href="/profile">Profile</NavLink>
          </div>

          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-2xl font-black text-slate-800 lg:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? '×' : '☰'}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-100 py-4 lg:hidden">
            <div className="grid gap-2">
              <MobileLink href="/jobs" onClick={closeMenu}>
                Jobs
              </MobileLink>

              {role === 'worker' && (
                <>
                  <MobileLink href="/my-applications" onClick={closeMenu}>
                    Applications
                  </MobileLink>

                  <MobileLink href="/completed-jobs" onClick={closeMenu}>
                    Completed Jobs
                  </MobileLink>

                  <MobileLink href="/invites" onClick={closeMenu}>
                    Invites
                  </MobileLink>

                  <MobileLink href="/worker/dashboard" onClick={closeMenu}>
                    Dashboard
                  </MobileLink>
                </>
              )}

              {role === 'company' && (
                <>
                  <MobileLink href="/workers" onClick={closeMenu}>
                    Find Workers
                  </MobileLink>

                  <MobileLink href="/post-job" onClick={closeMenu} highlight>
                    Post Job
                  </MobileLink>

                  <MobileLink href="/my-jobs" onClick={closeMenu}>
                    My Jobs
                  </MobileLink>

                  <MobileLink href="/completed-jobs" onClick={closeMenu}>
                    Completed Jobs
                  </MobileLink>

                  <MobileLink href="/company/invites" onClick={closeMenu}>
                    Invites
                  </MobileLink>

                  <MobileLink href="/dashboard" onClick={closeMenu}>
                    Dashboard
                  </MobileLink>
                </>
              )}

              <MobileLink href="/notifications" onClick={closeMenu}>
                Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}
              </MobileLink>

              <MobileLink href="/messages" onClick={closeMenu}>
                Messages
              </MobileLink>

              <MobileLink href="/profile" onClick={closeMenu}>
                Profile
              </MobileLink>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

function NavLink({
  href,
  children,
  highlight = false,
}: {
  href: string
  children: React.ReactNode
  highlight?: boolean
}) {
  return (
    <Link
      href={href}
      className={
        highlight
          ? 'rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white hover:bg-orange-600'
          : 'rounded-2xl px-4 py-3 text-sm font-black text-slate-800 hover:bg-slate-100'
      }
    >
      {children}
    </Link>
  )
}

function MobileLink({
  href,
  children,
  onClick,
  highlight = false,
}: {
  href: string
  children: React.ReactNode
  onClick: () => void
  highlight?: boolean
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={
        highlight
          ? 'rounded-2xl bg-orange-500 px-4 py-4 text-base font-black text-white'
          : 'rounded-2xl bg-slate-50 px-4 py-4 text-base font-black text-slate-800 hover:bg-slate-100'
      }
    >
      {children}
    </Link>
  )
}

function NotificationLink({ unreadCount }: { unreadCount: number }) {
  return (
    <Link
      href="/notifications"
      className="relative rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-800 hover:bg-slate-100"
    >
      🔔

      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-black text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  )
}