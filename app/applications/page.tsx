'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ProfileRole = 'company' | 'worker' | null

type ProfileRow = {
  role: ProfileRole
}

export default function ApplicationsRedirectPage() {
  const t = useTranslations('ApplicationsRedirect')
  const router = useRouter()
  const [message, setMessage] = useState(t('loading'))

  useEffect(() => {
    let active = true

    async function redirectByRole() {
      setMessage(t('checkingAccount'))

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (!active) return

      if (userError || !user) {
        router.replace('/login')
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (!active) return

      if (profileError) {
        setMessage(t('profileLoadFailed'))
        return
      }

      const profile = data as ProfileRow | null

      if (profile?.role === 'company') {
        setMessage(t('openingCompany'))
        router.replace('/company/applications')
        return
      }

      if (profile?.role === 'worker') {
        setMessage(t('openingWorker'))
        router.replace('/worker/applications')
        return
      }

      setMessage(t('roleMissing'))
    }

    redirectByRole()

    return () => {
      active = false
    }
  }, [router])

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-10 text-white">
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
        <div className="mb-6 h-14 w-14 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />

        <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
          CrewCall
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
          {t('title')}
        </h1>

        <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
          {message}
        </p>
      </div>
    </main>
  )
}
