'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Lead = {
  id: string
  name: string | null
  email: string | null
  lead_type: string | null
  status: string | null
  referral_source: string | null
  created_at: string | null
}

type LaunchData = {
  readinessPercent: number
  checks: {
    id: string
    name: string
    status: string
    message: string
  }[]
  stats: {
    totalProfiles: number
    companies: number
    workers: number
    admins: number
    totalJobs: number
    openJobs: number
    assignedJobs: number
    completedJobs: number
    paidJobs: number
    releasedPayouts: number
    totalApplications: number
    hiredApplications: number
    totalInvites: number
    pendingInvites: number
    totalNotifications: number
    unreadNotifications: number
  }
}

export default function AdminLaunchPage() {
  const [launch, setLaunch] = useState<LaunchData | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)

    const [launchRes, leadsRes] = await Promise.all([
      fetch('/api/admin/launch'),
      supabase
        .from('leads')
        .select('*')
        .order('created_at', {
          ascending: false,
        }),
    ])

    const launchData = await launchRes.json()

    setLaunch(launchData)
    setLeads(leadsRes.data || [])

    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        Loading Launch Command Center...
      </main>
    )
  }

  const companies = leads.filter(
    (lead) => lead.lead_type === 'Company'
  ).length

  const workers = leads.filter(
    (lead) => lead.lead_type === 'Worker'
  ).length

  const converted = leads.filter(
    (lead) => lead.status === 'converted'
  ).length

  const conversion =
    leads.length > 0
      ? Math.round((converted / leads.length) * 100)
      : 0

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
            CrewCall
          </p>

          <h1 className="mt-3 text-5xl font-black">
            Launch Command Center
          </h1>

          <div className="mt-6 text-6xl font-black text-cyan-300">
            {launch?.readinessPercent || 0}%
          </div>

          <p className="mt-2 text-slate-400">
            Production readiness score
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {launch?.checks?.map((check) => (
            <div
              key={check.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <p className="font-black">
                {check.name}
              </p>

              <p className={
                check.status === 'ready'
                  ? 'mt-2 text-emerald-300'
                  : 'mt-2 text-orange-300'
              }>
                {check.status}
              </p>

              <p className="mt-2 text-sm text-slate-400">
                {check.message}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-4">

          <Metric title="Users" value={String(launch?.stats.totalProfiles || 0)} />
          <Metric title="Companies" value={String(launch?.stats.companies || 0)} />
          <Metric title="Workers" value={String(launch?.stats.workers || 0)} />
          <Metric title="Jobs" value={String(launch?.stats.totalJobs || 0)} />

          <Metric title="Open Jobs" value={String(launch?.stats.openJobs || 0)} />
          <Metric title="Assigned" value={String(launch?.stats.assignedJobs || 0)} />
          <Metric title="Completed" value={String(launch?.stats.completedJobs || 0)} />
          <Metric title="Paid" value={String(launch?.stats.paidJobs || 0)} />

          <Metric title="Applications" value={String(launch?.stats.totalApplications || 0)} />
          <Metric title="Hires" value={String(launch?.stats.hiredApplications || 0)} />
          <Metric title="Payouts" value={String(launch?.stats.releasedPayouts || 0)} />
          <Metric title="Notifications" value={String(launch?.stats.totalNotifications || 0)} />

        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-black">
            Growth
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <Metric title="Leads" value={String(leads.length)} />
            <Metric title="Lead Companies" value={String(companies)} />
            <Metric title="Lead Workers" value={String(workers)} />
            <Metric title="Conversion" value={`${conversion}%`} />
          </div>
        </section>

      </div>
    </main>
  )
}

function Metric({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs font-bold uppercase text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-black">
        {value}
      </p>
    </div>
  )
}
