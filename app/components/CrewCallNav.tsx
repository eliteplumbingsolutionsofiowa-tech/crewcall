'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Profile = {
  id: string
  role: 'worker' | 'company' | null
}

export default function CrewCallNav() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loaded, setLoaded] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setProfile(null)
      setLoaded(true)
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    setProfile((data as Profile) || null)
    setLoaded(true)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isWorker = profile?.role === 'worker'
  const isCompany = profile?.role === 'company'

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-slate-900 text-sm font-bold text-white shadow-sm">
            CC
          </div>

          <div>
            <div className="text-lg font-bold tracking-tight text-slate-900">
              CrewCall
            </div>
            <div className="text-xs text-slate-500">
              Find work. Build crews. Move fast.
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          <NavLink href="/">Home</NavLink>
          <NavLink href="/jobs">Jobs</NavLink>

          {loaded && !profile && (
            <>
              <NavLink href="/login">Login</NavLink>
              <NavLink href="/signup">Signup</NavLink>
            </>
          )}

          {isWorker && (
            <>
              <NavLink href="/saved-jobs">Saved Jobs</NavLink>
              <NavLink href="/my-applications">Applications</NavLink>
              <NavLink href="/messages">Messages</NavLink>
              <NavLink href="/profile">Profile</NavLink>

              <button
                onClick={handleSignOut}
                className="ml-2 rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
              >
                Sign Out
              </button>
            </>
          )}

          {isCompany && (
            <>
              <NavLink href="/jobs/new">Post Job</NavLink>
              <NavLink href="/my-jobs">My Jobs</NavLink>
              <NavLink href="/messages">Messages</NavLink>
              <NavLink href="/profile">Profile</NavLink>
              <NavLink href="/compliance">Compliance</NavLink>

              <button
                onClick={handleSignOut}
                className="ml-2 rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
              >
                Sign Out
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

function NavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </Link>
  )
}