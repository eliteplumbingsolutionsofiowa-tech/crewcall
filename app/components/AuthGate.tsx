'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type AuthGateProps = {
  children: React.ReactNode
}

export default function AuthGate({
  children,
}: AuthGateProps) {
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [message, setMessage] = useState<string | null>(
    null
  )

  useEffect(() => {
    let active = true

    async function checkAuth() {
      setChecking(true)
      setAllowed(false)
      setMessage(null)

      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()

        if (error) {
          throw error
        }

        if (!user) {
          window.location.assign(
            `/login?redirect=${encodeURIComponent(pathname)}`
          )
          return
        }

        if (!active) {
          return
        }

        setAllowed(true)
        setChecking(false)
      } catch (error) {
        console.error(
          'CrewCall authentication check failed:',
          error
        )

        if (!active) {
          return
        }

        setMessage(
          error instanceof Error
            ? error.message
            : 'CrewCall could not verify your account.'
        )
        setChecking(false)
      }
    }

    void checkAuth()

    return () => {
      active = false
    }
  }, [pathname])

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-white">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-cyan-400" />
          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            CrewCall
          </p>
          <h1 className="mt-3 text-xl font-black">
            Checking your access
          </h1>
          <p className="mt-2 text-sm font-semibold text-slate-400">
            Verifying your account.
          </p>
        </div>
      </main>
    )
  }

  if (message) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-white">
        <div className="w-full max-w-md rounded-[2rem] border border-red-400/20 bg-red-500/10 p-8 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-red-300">
            Access check failed
          </p>
          <h1 className="mt-3 text-2xl font-black">
            We couldn&apos;t verify your account
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-red-100/80">
            {message}
          </p>
        </div>
      </main>
    )
  }

  if (!allowed) {
    return null
  }

  return <>{children}</>
}
