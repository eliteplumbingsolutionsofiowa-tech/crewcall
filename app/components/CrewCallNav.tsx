'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [pendingInvites, setPendingInvites] = useState(0)
  const [acceptedInvites, setAcceptedInvites] = useState(0)

  useEffect(() => {
    loadNav()

    const channel = supabase
      .channel('crewcall-nav-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadNav)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invites' }, loadNav)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, loadNav)
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
      const { count: pendingCount } = await supabase
        .from('invites')
        .select('*', { count: 'exact', head: true })
        .eq('worker_id', user.id)
        .eq('status', 'pending')

      setPendingInvites(pendingCount || 0)
      setAcceptedInvites(0)
    }

    if (currentProfile?.role === 'company') {
      const { count: acceptedCount } = await supabase
        .from('invites')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', user.id)
        .eq('status', 'accepted')

      setAcceptedInvites(acceptedCount || 0)
      setPendingInvites(0)
    }

    setLoaded(true)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName =
    profile?.company_name ||
    profile?.full_name ||
    (profile?.role === 'company' ? 'Company' : 'Worker')

  return (
    <nav className="sticky top-0 z-50 border-b border-blue-100 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-md">
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

        {loaded && (
          <div className="flex items-center gap-2">
            {!profile && (
              <>
                <Link
                  className="rounded-xl px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
                  href="/login"
                >
                  Login
                </Link>

                <Link
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                  href="/signup"
                >
                  Sign Up
                </Link>
              </>
            )}

            {profile && (
              <>
                <Link
                  className="rounded-xl px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
                  href="/jobs"
                >
                  Jobs
                </Link>

                {profile.role === 'company' && (
                  <>
                    <Link
                      className="rounded-xl px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
                      href="/workers"
                    >
                      Find Workers
                    </Link>

                    <Link
                      className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600"
                      href="/post-job"
                    >
                      Post Job
                    </Link>

                    <Link
                      className="rounded-xl px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
                      href="/my-jobs"
                    >
                      My Jobs
                    </Link>

                    <Link
                      className="relative rounded-xl px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
                      href="/invites"
                    >
                      Invites
                      {acceptedInvites > 0 && (
                        <span className="absolute -right-1 -top-1 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-black text-white">
                          {acceptedInvites}
                        </span>
                      )}
                    </Link>

                    <Link
                      className="rounded-xl px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
                      href="/dashboard"
                    >
                      Dashboard
                    </Link>
                  </>
                )}

                {profile.role === 'worker' && (
                  <>
                    <Link
                      className="rounded-xl px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
                      href="/my-applications"
                    >
                      Applications
                    </Link>

                    <Link
                      className="relative rounded-xl px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
                      href="/invites"
                    >
                      Invites
                      {pendingInvites > 0 && (
                        <span className="absolute -right-1 -top-1 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-black text-white">
                          {pendingInvites}
                        </span>
                      )}
                    </Link>

                    <Link
                      className="rounded-xl px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
                      href="/worker/dashboard"
                    >
                      Worker Dashboard
                    </Link>
                  </>
                )}

                <Link
                  className="relative rounded-xl px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
                  href="/messages"
                >
                  Messages
                  {unreadMessages > 0 && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-black text-white">
                      {unreadMessages}
                    </span>
                  )}
                </Link>

                <Link
                  className="rounded-xl px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
                  href="/profile"
                >
                  {displayName}
                </Link>

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
    </nav>
  )
}