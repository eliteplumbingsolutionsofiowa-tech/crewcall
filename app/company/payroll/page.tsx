'use client'

import { useMemo } from 'react'

type PayrollRow = {
  worker: string
  trade: string
  regularHours: number
  overtimeHours: number
  rate: string
  total: string
  status: string
}

const payroll: PayrollRow[] = [
  {
    worker: 'John Smith',
    trade: 'Plumber',
    regularHours: 40,
    overtimeHours: 3.5,
    rate: '$45/hr',
    total: '$1,867.50',
    status: 'Ready',
  },
  {
    worker: 'Mike Johnson',
    trade: 'HVAC',
    regularHours: 38,
    overtimeHours: 0,
    rate: '$42/hr',
    total: '$1,596',
    status: 'Approved',
  },
  {
    worker: 'Sarah Miller',
    trade: 'Electrician',
    regularHours: 40,
    overtimeHours: 6,
    rate: '$48/hr',
    total: '$2,208',
    status: 'Review',
  },
]

export default function PayrollPage() {
  const stats = useMemo(
    () => [
      {
        label: 'Total Labor This Week',
        value: '$18,420',
      },
      {
        label: 'Workers',
        value: '42',
      },
      {
        label: 'Overtime Hours',
        value: '34.5',
      },
      {
        label: 'Pending Approval',
        value: '8',
      },
    ],
    [],
  )

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            Finance
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Payroll & Labor Reports
          </h1>

          <p className="mt-3 text-slate-400">
            Review labor costs, approve hours, and export payroll data.
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

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">

          <div className="flex flex-wrap justify-between gap-4">
            <h2 className="text-2xl font-black">
              Weekly Payroll
            </h2>

            <div className="flex gap-3">
              <button className="rounded-xl bg-white/10 px-4 py-2 font-bold">
                Export CSV
              </button>

              <button className="rounded-xl bg-cyan-400 px-4 py-2 font-black text-slate-950">
                Approve Payroll
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {payroll.map((row) => (
              <div
                key={row.worker}
                className="rounded-xl border border-white/10 bg-slate-950/60 p-5"
              >
                <div className="flex flex-wrap justify-between gap-4">

                  <div>
                    <h3 className="font-black text-lg">
                      {row.worker}
                    </h3>

                    <p className="text-slate-400">
                      {row.trade}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-black">
                      {row.total}
                    </p>

                    <p className="text-sm text-slate-400">
                      {row.rate}
                    </p>
                  </div>

                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">

                  <Stat
                    label="Regular"
                    value={`${row.regularHours} hrs`}
                  />

                  <Stat
                    label="Overtime"
                    value={`${row.overtimeHours} hrs`}
                  />

                  <Stat
                    label="Status"
                    value={row.status}
                  />

                  <button className="rounded-xl bg-white/10 font-bold">
                    Review
                  </button>

                </div>
              </div>
            ))}
          </div>

        </section>

        <section className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-6">

          <h2 className="text-xl font-black">
            AI Labor Intelligence
          </h2>

          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <p>
              • Overtime is increasing on commercial projects.
            </p>

            <p>
              • Average labor cost is 6% below company target.
            </p>

            <p>
              • Two crews may need additional staffing next week.
            </p>
          </div>

        </section>

      </div>
    </main>
  )
}

function Stat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <p className="text-xs uppercase text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-black">
        {value}
      </p>
    </div>
  )
}
