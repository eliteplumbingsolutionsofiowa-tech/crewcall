'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'

type Report = {
  id: string
  worker: string
  job: string
  location: string
  summary: string
  photos: number
  hours: number
  status: string
}

const reports: Report[] = [
  {
    id: '1',
    worker: 'John Smith',
    job: 'Commercial Plumbing Rough-In',
    location: 'West Des Moines',
    summary: 'Completed underground inspection and pressure test.',
    photos: 12,
    hours: 8,
    status: 'Submitted',
  },
  {
    id: '2',
    worker: 'Mike Johnson',
    job: 'HVAC Equipment Install',
    location: 'Ankeny',
    summary: 'Installed rooftop unit and verified startup.',
    photos: 8,
    hours: 7.5,
    status: 'Approved',
  },
]

export default function FieldReportsPage() {

  const t = useTranslations('CompanyFieldReports')
  const stats = useMemo(
    () => [
      {
        label: t('reportsToday'),
        value: '24',
      },
      {
        label: t('photosUploaded'),
        value: '186',
      },
      {
        label: t('hoursLogged'),
        value: '192',
      },
      {
        label: t('pendingReview'),
        value: '6',
      },
    ],
    [],
  )

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            {t('fieldOperations')}
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

        <section className="flex flex-wrap gap-3">
          <button className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">
            {t('newReport')}
          </button>

          <button className="rounded-xl bg-white/10 px-5 py-3 font-bold">
            {t('exportReports')}
          </button>
        </section>

        <section className="space-y-5">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <div className="flex flex-wrap justify-between gap-5">

                <div>
                  <h2 className="text-xl font-black">
                    {report.job}
                  </h2>

                  <p className="text-slate-400">
                    {report.worker} • {report.location}
                  </p>

                  <p className="mt-3 text-sm text-slate-300">
                    {report.summary}
                  </p>
                </div>

                <span className="rounded-full bg-cyan-400/20 px-4 py-2 text-sm font-bold text-cyan-300">
                  {report.status === 'Submitted'
                  ? t('submitted')
                  : report.status === 'Approved'
                    ? t('approved')
                    : report.status}
                </span>

              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-4">

                <Stat
                  label={t('photos')}
                  value={String(report.photos)}
                />

                <Stat
                  label={t('hours')}
                  value={String(report.hours)}
                />

                <Stat
                  label={t('location')}
                  value={report.location}
                />

                <button className="rounded-xl bg-white/10 font-bold">
                  {t('viewReport')}
                </button>

              </div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-6">

          <h2 className="text-xl font-black">
            {t('aiFieldSummary')}
          </h2>

          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <p>
              • {t('insightProduction')}
            </p>

            <p>
              • {t('insightManpower')}
            </p>

            <p>
              • {t('insightMaterials')}
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
    <div className="rounded-xl bg-slate-950/60 p-3">
      <p className="text-xs uppercase text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-black">
        {value}
      </p>
    </div>
  )
}
