'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ApplicationsRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    async function redirectByRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.role === 'company') {
        router.replace('/company/applications')
        return
      }

      if (profile?.role === 'worker') {
        router.replace('/my-applications')
        return
      }

      router.replace('/profile')
    }

    redirectByRole()
  }, [router])

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-slate-700">
          Loading applications...
        </p>
      </div>
    </main>
  )
}