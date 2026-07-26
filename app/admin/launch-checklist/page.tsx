'use client'

import { useMemo, useState } from 'react'

type CheckItem = {
  label: string
  status: 'complete' | 'warning' | 'pending'
}

const checks: CheckItem[] = [
  { label: 'Authentication', status: 'complete' },
  { label: 'Database', status: 'complete' },
  { label: 'Stripe Payments', status: 'complete' },
  { label: 'Worker Payouts', status: 'complete' },
  { label: 'AI Recruiter', status: 'complete' },
  { label: 'Messaging', status: 'complete' },
  { label: 'Notifications', status: 'complete' },
  { label: 'File Uploads', status: 'complete' },
  { label: 'Mobile Layout', status: 'complete' },
  { label: 'Email Delivery', status: 'warning' },
]

const workflows = [
  'Company Signup',
  'Worker Signup',
  'Post Job',
  'Apply Job',
  'Hire Worker',
  'Payment',
  'Complete Job',
  'Review',
]

const tasks = [
  {
    priority: 'HIGH',
    task: 'Test Stripe live mode',
  },
  {
    priority: 'HIGH',
    task: 'Verify email delivery',
  },
  {
    priority: 'HIGH',
    task: 'Complete mobile QA',
  },
  {
    priority: 'MEDIUM',
    task: 'Add final screenshots',
  },
  {
    priority: 'LOW',
    task: 'Update FAQ',
  },
]

export default function LaunchChecklistPage() {
  const [completedFlows, setCompletedFlows] = useState<string[]>([])

  const score = useMemo(() => {
    const complete = checks.filter(
      (item) => item.status === 'complete',
    ).length

    return Math.round((complete / checks.length) * 100)
  }, [])

  function toggleFlow(flow: string) {
    setCompletedFlows((current) =>
      current.includes(flow)
        ? current.filter((item) => item !== flow)
        : [...current, flow],
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            Admin
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Launch Checklist
          </h1>

          <p className="mt-3 text-slate-400">
            CrewCall production readiness dashboard.
          </p>

          <div className="mt-8">
            <p className="text-sm font-bold uppercase text-slate-500">
              Launch Readiness
            </p>

            <p className="mt-2 text-6xl font-black text-cyan-300">
              {score}%
            </p>

            <div className="mt-4 h-3 rounded-full bg-white/10">
              <div
                className="h-3 rounded-full bg-cyan-400"
                style={{
                  width: `${score}%`,
                }}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-black">
              System Checks
            </h2>

            <div className="mt-5 space-y-3">
              {checks.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl bg-slate-950/60 p-4"
                >
                  <span className="font-bold">
                    {item.label}
                  </span>

                  <span
                    className={
                      item.status === 'complete'
                        ? 'text-green-300'
                        : item.status === 'warning'
                          ? 'text-yellow-300'
                          : 'text-slate-400'
                    }
                  >
                    {item.status === 'complete'
                      ? '✓'
                      : item.status === 'warning'
                        ? '⚠'
                        : '○'}
                  </span>
                </div>
              ))}
            </div>
          </div>


          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-black">
              User Flow Tests
            </h2>

            <div className="mt-5 space-y-3">
              {workflows.map((flow) => (
                <button
                  key={flow}
                  onClick={() => toggleFlow(flow)}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-950/60 p-4 text-left"
                >
                  <span className="font-bold">
                    {flow}
                  </span>

                  <span>
                    {completedFlows.includes(flow)
                      ? '✓'
                      : '○'}
                  </span>
                </button>
              ))}
            </div>
          </div>

        </section>


        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">

          <h2 className="text-2xl font-black">
            Launch Tasks
          </h2>

          <div className="mt-5 space-y-3">
            {tasks.map((task) => (
              <div
                key={task.task}
                className="flex flex-wrap justify-between gap-3 rounded-xl bg-slate-950/60 p-4"
              >
                <span className="font-bold">
                  {task.task}
                </span>

                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">
                  {task.priority}
                </span>
              </div>
            ))}
          </div>

        </section>


        <section className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-6">

          <h2 className="text-xl font-black">
            Founder Notes
          </h2>

          <textarea
            placeholder="Add private launch notes..."
            className="mt-4 min-h-32 w-full rounded-xl bg-slate-950 p-4 text-white outline-none"
          />

        </section>

      </div>
    </main>
  )
}
