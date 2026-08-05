'use client'

import LaunchProgress from '@/app/components/mission-control/LaunchProgress'
import LaunchChecklist from '@/app/components/mission-control/LaunchChecklist'
import SystemStatus from '@/app/components/mission-control/SystemStatus'
import StatCard from '@/app/components/mission-control/StatCard'

export default function MissionControlPage() {
  const completed = 10
  const total = 14

  const stats = [
    {
      title: 'Workers',
      value: 127,
      icon: '👷',
      color: 'from-sky-500 to-cyan-400',
      subtitle: '+12 today',
    },
    {
      title: 'Companies',
      value: 43,
      icon: '🏢',
      color: 'from-violet-500 to-fuchsia-500',
      subtitle: '+2 today',
    },
    {
      title: 'Open Jobs',
      value: 31,
      icon: '📋',
      color: 'from-emerald-500 to-green-400',
      subtitle: 'Hiring now',
    },
    {
      title: 'Paid Jobs',
      value: 86,
      icon: '💰',
      color: 'from-amber-500 to-orange-400',
      subtitle: 'Stripe synced',
    },
  ]

  const systems = [
    { name: 'Website', healthy: true },
    { name: 'Android', healthy: true },
    { name: 'Apple', healthy: false },
    { name: 'Stripe', healthy: true },
    { name: 'Supabase', healthy: true },
    { name: 'AI Recruiting', healthy: true },
  ]

  const checklist = [
    { label: 'Website', complete: true },
    { label: 'Android Build', complete: true },
    { label: 'Database', complete: true },
    { label: 'Stripe', complete: true },
    { label: 'AI Recruiting', complete: true },
    { label: 'Messaging', complete: true },
    { label: 'TestFlight', complete: false },
    { label: 'Google Play', complete: false },
    { label: 'Push Notifications', complete: false },
    { label: 'Production Launch', complete: false },
  ]

  return (
    <main className="min-h-screen bg-slate-950 px-8 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">

        <div>
          <h1 className="text-5xl font-black">
            🚀 CrewCall Mission Control
          </h1>

          <p className="mt-2 text-slate-400">
            Production launch dashboard
          </p>
        </div>

        <LaunchProgress
          completed={completed}
          total={total}
        />

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard
              key={stat.title}
              {...stat}
            />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">

          <SystemStatus
            systems={systems}
          />

          <LaunchChecklist
            items={checklist}
          />

        </div>

      </div>
    </main>
  )
}
