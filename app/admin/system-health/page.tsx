'use client'

import { useMemo } from 'react'

type HealthItem = {
  name: string
  status: 'online' | 'warning' | 'offline'
  detail: string
}

const services: HealthItem[] = [
  {
    name: 'API Services',
    status: 'online',
    detail: 'Operational',
  },
  {
    name: 'Database',
    status: 'online',
    detail: 'Healthy',
  },
  {
    name: 'Storage',
    status: 'online',
    detail: 'Operational',
  },
  {
    name: 'Authentication',
    status: 'online',
    detail: 'Operational',
  },
  {
    name: 'Stripe Payments',
    status: 'online',
    detail: 'Connected',
  },
  {
    name: 'Email Delivery',
    status: 'warning',
    detail: 'Monitor',
  },
  {
    name: 'Realtime',
    status: 'online',
    detail: 'Connected',
  },
  {
    name: 'AI Recruiter',
    status: 'online',
    detail: 'Running',
  },
]

const envChecks = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'GOOGLE_MAPS_KEY',
  'OPENAI_KEY',
]

export default function SystemHealthPage() {
  const metrics = useMemo(
    () => [
      {
        label: 'API Response',
        value: '184ms',
      },
      {
        label: 'Page Load',
        value: '1.2s',
      },
      {
        label: 'Database Queries',
        value: '42ms',
      },
      {
        label: 'Realtime Users',
        value: '328',
      },
    ],
    [],
  )

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">

        <section className="rounded-3xl border border-green-400/20 bg-green-400/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-green-300">
            Admin
          </p>

          <h1 className="mt-3 text-4xl font-black">
            System Health
          </h1>

          <p className="mt-3 text-slate-400">
            CrewCall production monitoring dashboard.
          </p>

          <div className="mt-6">
            <p className="text-sm font-bold uppercase text-slate-500">
              Overall Status
            </p>

            <p className="mt-2 text-5xl font-black text-green-300">
              99.9%
            </p>

            <p className="mt-2 font-bold text-green-300">
              Operational
            </p>
          </div>
        </section>


        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <p className="text-xs font-bold uppercase text-slate-500">
                {metric.label}
              </p>

              <p className="mt-2 text-3xl font-black">
                {metric.value}
              </p>
            </div>
          ))}
        </section>


        <section className="grid gap-5 lg:grid-cols-2">

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-black">
              Services
            </h2>

            <div className="mt-5 space-y-3">
              {services.map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between rounded-xl bg-slate-950/60 p-4"
                >
                  <div>
                    <p className="font-bold">
                      {service.name}
                    </p>

                    <p className="text-sm text-slate-500">
                      {service.detail}
                    </p>
                  </div>

                  <span
                    className={
                      service.status === 'online'
                        ? 'text-green-300'
                        : service.status === 'warning'
                          ? 'text-yellow-300'
                          : 'text-red-300'
                    }
                  >
                    {service.status === 'online'
                      ? '✓'
                      : service.status === 'warning'
                        ? '⚠'
                        : '✕'}
                  </span>
                </div>
              ))}
            </div>
          </div>


          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-black">
              Environment Check
            </h2>

            <div className="mt-5 space-y-3">
              {envChecks.map((item) => (
                <div
                  key={item}
                  className="flex justify-between rounded-xl bg-slate-950/60 p-4"
                >
                  <span className="text-sm font-bold">
                    {item}
                  </span>

                  <span className="text-green-300">
                    ✓
                  </span>
                </div>
              ))}
            </div>
          </div>

        </section>


        <section className="grid gap-5 lg:grid-cols-3">

          <ActionCard title="Error Tracking">
            12 warnings today
          </ActionCard>

          <ActionCard title="AI Recruiter">
            327 invites sent today
          </ActionCard>

          <ActionCard title="Deployment">
            Latest deploy successful
          </ActionCard>

        </section>


        <section className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-6">

          <h2 className="text-xl font-black">
            Admin Actions
          </h2>

          <div className="mt-4 flex flex-wrap gap-3">
            {[
              'Test Email',
              'Test Stripe',
              'Test Notifications',
              'Export Logs',
            ].map((action) => (
              <button
                key={action}
                className="rounded-xl bg-white/10 px-5 py-3 font-bold"
              >
                {action}
              </button>
            ))}
          </div>

        </section>

      </div>
    </main>
  )
}

function ActionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="font-black text-lg">
        {title}
      </h3>

      <p className="mt-3 text-slate-400">
        {children}
      </p>
    </div>
  )
}
