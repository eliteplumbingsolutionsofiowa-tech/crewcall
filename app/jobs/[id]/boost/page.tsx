'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function BoostJobPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const jobId = params.id

  useEffect(() => {
    async function boostJob() {
      const featuredUntil = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString()

      const { error } = await supabase
        .from('jobs')
        .update(
          {
            is_featured: true,
            featured_until: featuredUntil,
          } as never
        )
        .eq('id', jobId)

      if (error) {
        console.error('Boost job error:', error)
        router.push(`/jobs/${jobId}`)
        return
      }

      router.push(`/jobs/${jobId}`)
    }

    if (jobId) {
      boostJob()
    }
  }, [jobId, router])

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/10 p-6 text-center shadow-2xl">
        <h1 className="text-2xl font-black">Boosting job...</h1>
        <p className="mt-3 text-sm text-slate-300">
          Your job is being featured for the next 7 days.
        </p>
      </div>
    </main>
  )
}