'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NotificationBell from '@/app/components/NotificationBell'

type Profile = {
  id: string
  role: 'worker' | 'company' | null
  full_name: string | null
  company_name: string | null
}

export default function CrewCallNav() {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const [unreadMessages, setUnreadMessages] = useState(0)
  const [pendingInvites, setPendingInvites] = useState(0)
  const [acceptedInvites, setAcceptedInvites] = useState(0)

  useEffect(() => {
    loadNav()

    const channel = supabase
      .channel('crewcall-nav-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        loadNav
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invites' },
        loadNav
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        loadNav
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function loadNav() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setProfile(null)
      setUnreadMessages(0)
      setPendingInvites(0)
      setAcceptedInvites(0)
      setLoaded(true)
      return
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, role, full_name, company_name')
      .eq('id', user.id)
      .maybeSingle()

    const currentProfile = profileData as Profile | null

    setProfile(currentProfile)

    const { count: unreadCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .neq('sender_id', user.id)
      .eq('read', false)

    setUnreadMessages(unreadCount || 0)

    if (currentProfile?.role === 'worker') {
      const { count } = await supabase
        .from('invites')
        .select('*', { count: 'exact', head: true })
        .eq('worker_id', user.id)
        .eq('status', 'pending')

      setPendingInvites(count || 0)
      setAcceptedInvites(0)
    }

    if (currentProfile?.role === 'company') {
      const { count } = await supabase
        .from('invites')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', user.id)
        .eq('status', 'accepted')

      setAcceptedInvites(count || 0)
      setPendingInvites(0)
    }

    setLoaded(true)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function closeMobile() {
    setMobileOpen(false)
  }

  const displayName =
    profile?.company_name ||
    profile?.full_name ||
    (profile?.role === 'company' ? 'Company' : 'Worker')

  function NavLink({
    href,
    label,
    badge,
    mobile = false,
  }: {
    href: string
    label: string
    badge?: number
    mobile?: boolean
  }) {
    return (
      <Link
        href={href}
        onClick={closeMobile}
        className={`relative rounded-xl px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-100 ${
          mobile ? 'w-full text-left' : ''
        }`}
      >
        {label}

        {!!badge && badge > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-black text-white">
            {badge}
          </span>
        )}
      </Link>
    )
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-blue-100 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-md">
              C
            </div>

            <div>
              <div className="text-xl font-black tracking-tight text-gray-950">
                Crew<span className="text-blue-600">Call</span>
              </div>

              <div className="text-xs font-semibold text-gray-500">
                Find help. Find work. Fast.
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2 lg:hidden">
            {loaded && profile && <NotificationBell />}

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-3 text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <span className="text-lg font-black">
                {mobileOpen ? '✕' : '☰'}
              </span>
            </button>
          </div>

          {loaded && (
            <div className="hidden items-center gap-2 lg:flex">
              {!profile && (
                <>
                  <NavLink href="/login" label="Login" />

                  <Link
                    href="/signup"
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    Sign Up
                  </Link>
                </>
              )}

              {profile?.role === 'company' && (
                <>
                  <NavLink href="/jobs" label="Jobs" />
                  <NavLink href="/workers" label="Find Workers" />

                  <Link
                    href="/post-job"
                    className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600"
                  >
                    Post Job
                  </Link>

                  <NavLink href="/my-jobs" label="My Jobs" />
                  <NavLink
                    href="/completed-jobs"
                    label="Completed Jobs"
                  />
                  <NavLink
                    href="/invites"
                    label="Invites"
                    badge={acceptedInvites}
                  />
                  <NavLink href="/dashboard" label="Dashboard" />
                </>
              )}

              {profile?.role === 'worker' && (
                <>
                  <NavLink href="/jobs" label="Jobs" />
                  <NavLink
                    href="/my-applications"
                    label="Applications"
                  />
                  <NavLink
                    href="/completed-jobs"
                    label="Completed Jobs"
                  />
                  <NavLink
                    href="/invites"
                    label="Invites"
                    badge={pendingInvites}
                  />
                  <NavLink
                    href="/worker/dashboard"
                    label="Dashboard"
                  />
                </>
              )}

              {profile && (
                <>
                  <NotificationBell />

                  <NavLink
                    href="/messages"
                    label="Messages"
                    badge={unreadMessages}
                  />

                  <NavLink href="/profile" label={displayName} />

                  <button
                    onClick={handleLogout}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {mobileOpen && loaded && (
          <div className="mt-5 flex flex-col gap-2 rounded-3xl border border-gray-200 bg-white p-4 shadow-xl lg:hidden">
            {!profile && (
              <>
                <NavLink href="/login" label="Login" mobile />

                <Link
                  href="/signup"
                  onClick={closeMobile}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
                >
                  Sign Up
                </Link>
              </>
            )}

            {profile?.role === 'company' && (
              <>
                <NavLink href="/jobs" label="Jobs" mobile />
                <NavLink href="/workers" label="Find Workers" mobile />

                <Link
                  href="/post-job"
                  onClick={closeMobile}
                  className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white hover:bg-orange-600"
                >
                  Post Job
                </Link>

                <NavLink href="/my-jobs" label="My Jobs" mobile />
                <NavLink
                  href="/completed-jobs"
                  label="Completed Jobs"
                  mobile
                />
                <NavLink
                  href="/invites"
                  label="Invites"
                  badge={acceptedInvites}
                  mobile
                />
                <NavLink href="/dashboard" label="Dashboard" mobile />
              </>
            )}

            {profile?.role === 'worker' && (
              <>
                <NavLink href="/jobs" label="Jobs" mobile />
                <NavLink
                  href="/my-applications"
                  label="Applications"
                  mobile
                />
                <NavLink
                  href="/completed-jobs"
                  label="Completed Jobs"
                  mobile
                />
                <NavLink
                  href="/invites"
                  label="Invites"
                  badge={pendingInvites}
                  mobile
                />
                <NavLink
                  href="/worker/dashboard"
                  label="Dashboard"
                  mobile
                />
              </>
            )}

            {profile && (
              <>
                <NavLink
                  href="/messages"
                  label="Messages"
                  badge={unreadMessages}
                  mobile
                />

                <NavLink href="/profile" label={displayName} mobile />

                <button
                  onClick={handleLogout}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-gray-100"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}