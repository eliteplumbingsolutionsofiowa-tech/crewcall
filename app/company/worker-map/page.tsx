'use client'

import dynamic from 'next/dynamic'

const WorkerMapClient = dynamic(
  () => import('./WorkerMapClient'),
  {
    ssr: false,
    loading: () => (
      <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
            Loading worker map...
          </div>
        </div>
      </main>
    ),
  }
)

export default function CompanyWorkerMapPage() {
  return <WorkerMapClient />
}