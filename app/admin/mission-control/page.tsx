'use client'

import LaunchProgress from '@/app/components/mission-control/LaunchProgress'
import LaunchChecklist from '@/app/components/mission-control/LaunchChecklist'
import SystemStatus from '@/app/components/mission-control/SystemStatus'
import StatCard from '@/app/components/mission-control/StatCard'
import RecentActivity from '@/app/components/mission-control/RecentActivity'

import { useMissionControl } from '@/hooks/useMissionControl'
import { useRecentActivity } from '@/hooks/useRecentActivity'

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

  const activity = useRecentActivity()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading Mission Control...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-8 py-10 text-white">

      <div className="mx-auto max-w-7xl space-y-8">

        <div>

          <h1 className="text-5xl font-black">
            🚀 CrewCall Mission Control
          </h1>

          <p className="mt-2 text-slate-400">
            Live Operations Dashboard
          </p>

        </div>

        <LaunchProgress
          completed={6}
          total={10}
        />

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">

          <StatCard
            title="Workers"
            value={workers}
            icon="👷"
            color="from-sky-500 to-cyan-400"
          />

          <StatCard
            title="Companies"
            value={companies}
            icon="🏢"
            color="from-violet-500 to-fuchsia-500"
          />

          <StatCard
            title="Open Jobs"
            value={openJobs}
            icon="📋"
            color="from-emerald-500 to-green-400"
          />

          <StatCard
            title="Active Jobs"
            value={activeJobs}
            icon="⚡"
            color="from-orange-500 to-yellow-400"
          />

          <StatCard
            title="Completed"
            value={completedJobs}
            icon="✅"
            color="from-green-500 to-emerald-400"
          />

          <StatCard
            title="Paid Jobs"
            value={paidJobs}
            icon="💰"
            color="from-yellow-500 to-orange-500"
          />

        </div>

        <div className="grid gap-6 xl:grid-cols-2">

          <SystemStatus
            systems={[
              { name: 'Website', healthy: true },
              { name: 'Supabase', healthy: true },
              { name: 'Stripe', healthy: true },
              { name: 'AI Recruiting', healthy: true },
              { name: 'Android', healthy: true },
              { name: 'Apple', healthy: true },
            ]}
          />

          <LaunchChecklist
            items={[
              { label: 'Website', complete: true },
              { label: 'Android', complete: true },
              { label: 'Mission Control', complete: true },
              { label: 'Stripe', complete: true },
              { label: 'AI Recruiting', complete: true },
              { label: 'Push Notifications', complete: true },
              { label: 'Apple Approval', complete: false },
              { label: 'TestFlight', complete: true },
              { label: 'Google Play', complete: false },
              { label: 'Production Launch', complete: false },
            ]}
          />

        </div>

        <div className="grid gap-6 xl:grid-cols-2">

          <RecentActivity
            items={activity}
          />

          <div className="rounded-3xl border border-sky-500/20 bg-slate-900/80 p-8">

            <h2 className="text-2xl font-black">
              Next Priority
            </h2>

            <div className="mt-6 rounded-2xl bg-sky-500/10 p-6">

              <p className="text-3xl font-black text-sky-400">
                Apple Approval
              </p>

              <p className="mt-3 text-slate-300">
                Complete the App Store submission and submit CrewCall for Apple review.
              </p>

            </div>

          </div>

        </div>

      </div>

    </main>
  )
}
