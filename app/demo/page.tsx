'use client'

import { useTranslations } from 'next-intl'

export default function DemoPage() {
  const t = useTranslations('Demo')

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            {t('eyebrow')}
          </p>

          <h1 className="mt-3 text-5xl font-black">
            {t('title')}
          </h1>

          <p className="mt-4 max-w-3xl text-slate-400">
            {t('description')}
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-3">

          <Card
            title={t('activeJobs')}
            value="24"
          />

          <Card
            title={t('availableWorkers')}
            value="486"
          />

          <Card
            title={t('aiMatches')}
            value="92%"
          />

        </section>

        <section className="grid gap-5 md:grid-cols-2">

          <Panel title={t('aiRecruiter')}>
            {t('aiRecruiterText')}
          </Panel>

          <Panel title={t('operationsCenter')}>
            {t('operationsText')}
          </Panel>

          <Panel title={t('payments')}>
            {t('paymentsText')}
          </Panel>

          <Panel title={t('workerNetwork')}>
            {t('workerNetworkText')}
          </Panel>

        </section>

        <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-8 text-center">

          <h2 className="text-3xl font-black">
            {t('ready')}
          </h2>

          <button className="mt-5 rounded-xl bg-cyan-400 px-8 py-4 font-black text-slate-950">
            {t('createFreeAccount')}
          </button>

        </section>

      </div>
    </main>
  )
}

function Card({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <p className="text-xs uppercase text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-4xl font-black">
        {value}
      </p>
    </div>
  )
}

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-black">
        {title}
      </h2>

      <p className="mt-3 text-slate-400">
        {children}
      </p>
    </div>
  )
}
