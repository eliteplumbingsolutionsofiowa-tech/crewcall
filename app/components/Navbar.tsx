'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type UserRole = 'company' | 'worker' | null

type Profile = {
  id: string
  role: UserRole
}

export default function Navbar() {
  const [role, setRole] = useState<UserRole>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [signedIn, setSignedIn] = useState(false)

  const fetchCounts = useCallback(async (userId: string) => {
    const [messagesRes, notificationsRes] = await Promise.all([
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .match({
          recipient_id: userId,
          is_read: false,
        }),

      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .or('is_read.eq.false,read.eq.false'),
    ])

    if (!messagesRes.error) {
      setUnreadMessages(messagesRes.count ?? 0)
    }

    if (!notificationsRes.error) {
      setUnreadNotifications(notificationsRes.count ?? 0)
    }
  }, [])

  const loadNav = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSignedIn(false)
      setRole(null)
      setUnreadMessages(0)
      setUnreadNotifications(0)
      return
    }

    setSignedIn(true)

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .returns<Profile[]>()
      .maybeSingle()

    if (!profileError && profileData) {
      setRole(profileData.role || null)
    }

    await fetchCounts(user.id)
  }, [fetchCounts])

  useEffect(() => {
    let isMounted = true

    async function safeLoadNav() {
      if (!isMounted) {
        return
      }

      await loadNav()
    }

    void safeLoadNav()

    const intervalId = window.setInterval(() => {
      void safeLoadNav()
    }, 30000)

    window.addEventListener('crewcall-refresh-nav', safeLoadNav)
    window.addEventListener('focus', safeLoadNav)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
      window.removeEventListener('crewcall-refresh-nav', safeLoadNav)
      window.removeEventListener('focus', safeLoadNav)
    }
  }, [loadNav])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const dashboardHref =
    role === 'company'
      ? '/company/dashboard'
      : role === 'worker'
        ? '/worker/dashboard'
        : '/jobs'

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white">
            C
          </div>

          <div>
            <p className="text-lg font-black leading-none text-slate-950">
              CrewCall
            </p>

            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Skilled Trades
            </p>
          </div>
        </Link>

        <div className="hidden items-center gap-1 xl:flex">
          {signedIn ? (
            <>
              <Link
                href={dashboardHref}
                className="rounded-2xl px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
              >
                Dashboard
              </Link>

              <Link
                href="/jobs"
                className="rounded-2xl px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
              >
                Jobs
              </Link>

              {role === 'company' ? (
                <>
                  <Link
                    href="/post-job"
                    className="rounded-2xl px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    Post Job
                  </Link>

                  <Link
                    href="/company/jobs"
                    className="rounded-2xl px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    My Jobs
                  </Link>

                  <Link
                    href="/company/worker-map"
                    className="rounded-2xl bg-cyan-50 px-3 py-2 text-sm font-black text-cyan-700 transition hover:bg-cyan-100"
                  >
                    Worker Map
                  </Link>

                  <Link
                    href="/company/analytics"
                    className="rounded-2xl px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    Analytics
                  </Link>

                  <Link
                    href="/saved-workers"
                    className="rounded-2xl px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    Saved Workers
                  </Link>
                </>
              ) : null}

              {role === 'worker' ? (
                <>
                  <Link
                    href="/applications"
                    className="rounded-2xl px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    Applications
                  </Link>

                  <Link
                    href="/saved-jobs"
                    className="rounded-2xl px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    Saved Jobs
                  </Link>
                </>
              ) : null}

              <Link
                href="/notifications"
                className="relative rounded-2xl px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
              >
                Alerts

                {unreadNotifications > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-xs font-black text-white">
                    {unreadNotifications > 99
                      ? '99+'
                      : unreadNotifications}
                  </span>
                ) : null}
              </Link>

              <Link
                href="/messages"
                className="relative rounded-2xl px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
              >
                Messages

                {unreadMessages > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-black text-white">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                ) : null}
              </Link>

              <Link
                href="/profile"
                className="rounded-2xl px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
              >
                Profile
              </Link>

              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-2xl px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
              >
                Login
              </Link>

              <Link
                href="/signup"
                className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-black text-white transition hover:bg-orange-400"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          {signedIn ? (
            <>
              {role === 'company' ? (
                <Link
                  href="/company/worker-map"
                  className="rounded-2xl bg-cyan-100 px-3 py-2 text-sm font-black text-cyan-800"
                >
                  Map
                </Link>
              ) : null}

              <Link
                href="/notifications"
                className="relative rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-900"
              >
                Alerts

                {unreadNotifications > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-xs font-black text-white">
                    {unreadNotifications > 99
                      ? '99+'
                      : unreadNotifications}
                  </span>
                ) : null}
              </Link>

              <Link
                href="/messages"
                className="relative rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-900"
              >
                Msg

                {unreadMessages > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-black text-white">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                ) : null}
              </Link>
            </>
          ) : null}

          <Link
            href={signedIn ? dashboardHref : '/login'}
            className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white"
          >
            {signedIn ? 'Dash' : 'Login'}
          </Link>
        </div>
      </div>
    </nav>
  )
}