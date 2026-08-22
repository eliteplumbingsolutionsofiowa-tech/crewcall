'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'

function WorkerMapLoading() {
  const t = useTranslations('WorkerMap')

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
          {t('loadingWorkerMap')}
        </div>
      </div>
    </main>
  )
}

const WorkerMapClient = dynamic(
  () => import('./WorkerMapClient'),
  {
    ssr: false,
    loading: () => <WorkerMapLoading />,
  }
)

export default function CompanyWorkerMapPage() {
  return <WorkerMapClient />
}