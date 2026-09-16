'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type HomeownerProfile = {
  id: string
  role: string | null
  full_name: string | null
}

export default function HomeownerDashboardPage() {
  const router = useRouter()
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
    profile?.full_name?.trim().split(/\s+/)[0] || 'there'

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 via-slate-900 to-blue-500/10 p-6 shadow-2xl sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
            CrewCall for Homeowners
          </p>

          <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
            Welcome, {firstName}.
          </h1>

          <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-300">
            Get your project in front of contractors, receive bids, compare
            your options, and connect directly with the contractor you choose.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/homeowner/projects/new"
              className="rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-4 text-center text-sm font-black text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-[1.01]"
            >
              Post a Project
            </Link>

            <Link
              href="/homeowner/projects"
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center text-sm font-black text-white transition hover:bg-white/10"
            >
              View My Projects
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <DashboardCard
            number="1"
            title="Post Your Project"
            description="Tell contractors what you need done, where the project is located, and when you want to get started."
          />

          <DashboardCard
            number="2"
            title="Receive Contractor Bids"
            description="Contractors can review your project and submit their bid through CrewCall."
          />

          <DashboardCard
            number="3"
            title="Choose Who You Want"
            description="Compare your options, review contractor information, message them directly, and choose the right fit for your project."
          />
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
            Your Projects
          </p>

          <h2 className="mt-3 text-2xl font-black">
            Ready to find a contractor?
          </h2>

          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-400">
            Your active projects and contractor bids will appear here as we
            connect the homeowner project system to CrewCall bidding.
          </p>

          <Link
            href="/homeowner/projects/new"
            className="mt-6 inline-flex rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-400/20"
          >
            Start a Project
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
    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-sm font-black text-cyan-300">
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
