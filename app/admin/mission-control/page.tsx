'use client'

import LaunchProgress from '@/app/components/mission-control/LaunchProgress'
import LaunchChecklist from '@/app/components/mission-control/LaunchChecklist'
import SystemStatus from '@/app/components/mission-control/SystemStatus'
import StatCard from '@/app/components/mission-control/StatCard'
import { useMissionControl } from '@/hooks/useMissionControl'

export default function MissionControlPage() {
  const {
    workers,
    companies,
    openJobs,
    activeJobs,
    completedJobs,
    paidJobs,
    loading,
  } = useMissionControl()

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        Loading Mission Control...
      </main>
    )
  }

  const stats = [
    {
      title: 'Workers',
      value: workers,
      icon: '👷',
      color: 'from-sky-500 to-cyan-400',
    },
    {
      title: 'Companies',
      value: companies,
      icon: '🏢',
      color: 'from-violet-500 to-fuchsia-500',
    },
    {
      title: 'Open Jobs',
      value: openJobs,
      icon: '📋',
      color: 'from-emerald-500 to-green-400',
    },
    {
      title: 'Completed',
      value: completedJobs,
      icon: '✅',
      color: 'from-green-500 to-emerald-400',
    },
    {
      title: 'Active',
      value: activeJobs,
      icon: '⚡',
      color: 'from-orange-500 to-amber-400',
    },
    {
      title: 'Paid',
      value: paidJobs,
      icon: '💰',
      color: 'from-yellow-500 to-orange-500',
    },
  ]

  const systems = [
    { name: 'Website', healthy: true },
    { name: 'Supabase', healthy: true },
    { name: 'Stripe', healthy: true },
    { name: 'AI Recruiting', healthy: true },
    { name: 'Android', healthy: true },
    { name: 'Apple', healthy: false },
  ]

  const checklist = [
    { label: 'Website', complete: true },
    { label: 'Android Build', complete: true },
    { label: 'Mission Control', complete: true },
    { label: 'Stripe', complete: true },
    { label: 'AI Recruiting', complete: true },
    { label: 'Push Notifications', complete: false },
    { label: 'Apple Approval', complete: false },
    { label: 'TestFlight', complete: false },
    { label: 'Google Play', complete: false },
    { label: 'Launch', complete: false },
  ]

  return (
    <main className="min-h-screen bg-slate-950 px-8 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">

        <div>
          <h1 className="text-5xl font-black">
            🚀 CrewCall Mission Control
          </h1>
          <p className="mt-2 text-slate-400">
            Live production dashboard
          </p>
        </div>

        <LaunchProgress completed={6} total={10} />

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <SystemStatus systems={systems} />
          <LaunchChecklist items={checklist} />
        </div>

      </div>
    </main>
  )
}
