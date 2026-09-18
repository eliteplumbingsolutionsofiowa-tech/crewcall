'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'

type HomeownerProfile = {
  id: string
  role: string | null
  full_name: string | null
}

export default function HomeownerDashboardPage() {
  const router = useRouter()
  const t = useTranslations('HomeownerDashboard')
  const [profile, setProfile] = useState<HomeownerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!active) return

      if (!user) {
        router.replace('/login?redirect=/homeowner/dashboard')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', user.id)
        .maybeSingle<HomeownerProfile>()

      if (!active) return

      if (error || !data) {
        console.error('Unable to load homeowner profile:', error)
        router.replace('/profile')
        return
      }

      if (data.role !== 'homeowner') {
        router.replace('/dashboard')
        return
      }

      setProfile(data)
      setLoading(false)
    }

    void loadDashboard()

    return () => {
      active = false
    }
  }, [router])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="h-48 animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
        </div>
      </main>
    )
  }

  const firstName =
    profile?.full_name?.trim().split(/\s+/)[0] || t('fallbackName')

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.12),_transparent_30%),linear-gradient(to_bottom,_#020617,_#07111f_55%,_#020617)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/30 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.24),_transparent_38%),radial-gradient(circle_at_bottom_left,_rgba(6,182,212,0.18),_transparent_35%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(7,18,35,0.98))] p-6 shadow-[0_25px_80px_-30px_rgba(6,182,212,0.55)] ring-1 ring-white/5 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
            {t('eyebrow')}
          </p>

          <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
            {t('welcome', { name: firstName })}
          </h1>

          <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-300">
            {t('description')}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/homeowner/projects/new"
              className="rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-4 text-center text-sm font-black text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-[1.01]"
            >
              {t('postProject')}
            </Link>

            <Link
              href="/homeowner/projects"
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center text-sm font-black text-white transition hover:bg-white/10"
            >
              {t('viewProjects')}
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <DashboardCard
            number="1"
            title={t('step1Title')}
            description={t('step1Description')}
          />

          <DashboardCard
            number="2"
            title={t('step2Title')}
            description={t('step2Description')}
          />

          <DashboardCard
            number="3"
            title={t('step3Title')}
            description={t('step3Description')}
          />
        </section>

        <section className="mt-6 group rounded-[2rem] border border-cyan-400/15 bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-cyan-950/20 p-6 shadow-[0_18px_50px_-28px_rgba(6,182,212,0.45)] ring-1 ring-white/5 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-[0_24px_65px_-28px_rgba(6,182,212,0.65)] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
            {t('yourProjects')}
          </p>

          <h2 className="mt-3 text-2xl font-black">
            {t('readyTitle')}
          </h2>

          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-400">
            {t('readyDescription')}
          </p>

          <Link
            href="/homeowner/projects/new"
            className="mt-6 inline-flex rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-400/20"
          >
            {t('startProject')}
          </Link>
        </section>
      </div>
    </main>
  )
}

function DashboardCard({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="group rounded-[2rem] border border-cyan-400/15 bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-cyan-950/20 p-6 shadow-[0_18px_50px_-28px_rgba(6,182,212,0.45)] ring-1 ring-white/5 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-[0_24px_65px_-28px_rgba(6,182,212,0.65)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-cyan-400/25 to-blue-500/15 text-base font-black text-cyan-200 shadow-[0_0_30px_-8px_rgba(34,211,238,0.75)] ring-1 ring-white/10 transition group-hover:scale-110">
        {number}
      </div>

      <h2 className="mt-5 text-xl font-black">
        {title}
      </h2>

      <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
        {description}
      </p>
    </div>
  )
}
