'use client'

import { useMemo, useState } from 'react'

type ScheduleItem = {
  id: string
  worker: string
  trade: string
  job: string
  location: string
  time: string
  status: 'assigned' | 'pending' | 'completed'
}

const scheduleData: ScheduleItem[] = [
  {
    id: '1',
    worker: 'John Smith',
    trade: 'Plumber',
    job: 'Commercial Rough-In',
    location: 'West Des Moines',
    time: '7:00 AM',
    status: 'assigned',
  },
  {
    id: '2',
    worker: 'Mike Johnson',
    trade: 'HVAC',
    job: 'Equipment Install',
    location: 'Ankeny',
    time: '8:30 AM',
    status: 'pending',
  },
  {
    id: '3',
    worker: 'Sarah Miller',
    trade: 'Electrician',
    job: 'Service Upgrade',
    location: 'Des Moines',
    time: '10:00 AM',
    status: 'completed',
  },
]

const days = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
]

export default function WorkforceSchedulePage() {
  const [selectedDay, setSelectedDay] = useState('Monday')

  const stats = useMemo(
    () => [
      {
        label: 'Workers Scheduled',
        value: '24',
      },
      {
        label: 'Active Jobs',
        value: '18',
      },
      {
        label: 'Conflicts',
        value: '2',
      },
      {
        label: 'AI Recommendations',
        value: '5',
      },
    ],
    [],
  )

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            Operations
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Workforce Scheduling
          </h1>

          <p className="mt-3 text-slate-400">
            Manage crews, assignments, availability, and AI scheduling recommendations.
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
            {days.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={
                  selectedDay === day
                    ? 'rounded-xl bg-cyan-400 px-5 py-2 font-black text-slate-950'
                    : 'rounded-xl bg-white/10 px-5 py-2 font-bold'
                }
              >
                {day}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-5">
          {scheduleData.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">

                <div>
                  <h2 className="text-xl font-black">
                    {item.job}
                  </h2>

                  <p className="mt-1 text-slate-400">
                    {item.worker} • {item.trade}
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    {item.location} • {item.time}
                  </p>
                </div>

                <span
                  className={
                    item.status === 'completed'
                      ? 'rounded-full bg-green-400/20 px-4 py-2 text-sm font-bold text-green-300'
                      : item.status === 'pending'
                        ? 'rounded-full bg-yellow-400/20 px-4 py-2 text-sm font-bold text-yellow-300'
                        : 'rounded-full bg-cyan-400/20 px-4 py-2 text-sm font-bold text-cyan-300'
                  }
                >
                  {item.status}
                </span>

              </div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-6">
          <h2 className="text-xl font-black">
            AI Schedule Assistant
          </h2>

          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <p>
              • Move Mike Johnson to Thursday to reduce travel time.
            </p>

            <p>
              • John Smith has availability for two additional jobs.
            </p>

            <p>
              • Crew overlap detected at Ankeny project.
            </p>
          </div>
        </section>

      </div>
    </main>
  )
}
