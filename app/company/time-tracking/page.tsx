'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

type TimeEntry = {
  id: string
  worker: string
  trade: string
  job: string
  clockIn: string
  clockOut: string
  hours: number
  status: 'approved' | 'pending' | 'review'
}

const entries: TimeEntry[] = [
  {
    id: '1',
    worker: 'John Smith',
    trade: 'Plumber',
    job: 'Commercial Rough-In',
    clockIn: '7:02 AM',
    clockOut: '3:45 PM',
    hours: 8.7,
    status: 'approved',
  },
  {
    id: '2',
    worker: 'Mike Johnson',
    trade: 'HVAC',
    job: 'Equipment Install',
    clockIn: '8:15 AM',
    clockOut: '5:10 PM',
    hours: 8.9,
    status: 'pending',
  },
  {
    id: '3',
    worker: 'Sarah Miller',
    trade: 'Electrician',
    job: 'Service Upgrade',
    clockIn: '6:55 AM',
    clockOut: '4:30 PM',
    hours: 9.6,
    status: 'review',
  },
]

export default function TimeTrackingPage() {

  const t = useTranslations('CompanyTimeTracking')
  const [activeTab, setActiveTab] = useState('today')

  const stats = useMemo(
    () => [
      {
        label: t('workersClockedIn'),
        value: '18',
      },
      {
        label: t('hoursToday'),
        value: '142.5',
      },
      {
        label: t('overtimeHours'),
        value: '12.4',
      },
      {
        label: t('pendingApproval'),
        value: '7',
      },
    ],
    [],
  )

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            {t('workforce')}
          </p>

          <h1 className="mt-3 text-4xl font-black">
            {t('title')}
          </h1>

          <p className="mt-3 text-slate-400">
            {t('description')}
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <p className="text-xs font-bold uppercase text-slate-500">
                {item.label}
              </p>

              <p className="mt-2 text-3xl font-black">
                {item.value}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap gap-3">
            {[
              ['today', t('today')],
              ['week', t('week')],
              ['payroll', t('payroll')],
              ['reports', t('reports')],
            ].map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={
                  activeTab === tab
                    ? 'rounded-xl bg-cyan-400 px-5 py-2 font-black text-slate-950'
                    : 'rounded-xl bg-white/10 px-5 py-2 font-bold'
                }
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <div className="flex flex-wrap justify-between gap-5">

                <div>
                  <h2 className="text-xl font-black">
                    {entry.worker}
                  </h2>

                  <p className="text-slate-400">
                    {entry.trade} • {entry.job}
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    {entry.clockIn} - {entry.clockOut}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-3xl font-black">
                    {entry.hours} {t('hrs')}
                  </p>

                  <span
                    className={
                      entry.status === 'approved'
                        ? 'rounded-full bg-green-400/20 px-3 py-1 text-xs font-bold text-green-300'
                        : entry.status === 'pending'
                          ? 'rounded-full bg-yellow-400/20 px-3 py-1 text-xs font-bold text-yellow-300'
                          : 'rounded-full bg-cyan-400/20 px-3 py-1 text-xs font-bold text-cyan-300'
                    }
                  >
                    {entry.status === 'approved'
                      ? t('approved')
                      : entry.status === 'pending'
                        ? t('pending')
                        : t('review')}
                  </span>
                </div>

              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button className="rounded-xl bg-white/10 px-4 py-2 font-bold">
                  {t('viewDetails')}
                </button>

                <button className="rounded-xl bg-cyan-400 px-4 py-2 font-black text-slate-950">
                  {t('approve')}
                </button>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-6">
          <h2 className="text-xl font-black">
            {t('aiLaborInsights')}
          </h2>

          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <p>
              • {t('insightOvertime')}
            </p>

            <p>
              • {t('insightProductivity')}
            </p>

            <p>
              • {t('insightTravel')}
            </p>
          </div>
        </section>

      </div>
    </main>
  )
}
