'use client'

import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function BoostJobPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string

  async function activateBoost() {
    const { error } = await supabase
      .from('jobs')
      .update({
        is_featured: true,
        featured_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', jobId)

    if (error) {
      alert(error.message)
      return
    }

    router.push(`/jobs/${jobId}`)
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <p className="text-sm font-bold uppercase text-yellow-700">
          Featured Job
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Boost This Job
        </h1>

        <p className="mt-3 text-slate-600">
          Feature this job for 7 days and push it above regular listings.
        </p>

        <div className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
          <h2 className="text-xl font-bold text-slate-900">$25 / 7 Days</h2>
          <p className="mt-2 text-sm text-slate-600">
            This is a placeholder for now. Later we’ll connect Stripe checkout.
          </p>
        </div>

        <button
          onClick={activateBoost}
          className="mt-6 rounded-xl bg-yellow-500 px-6 py-3 font-bold text-yellow-950 hover:bg-yellow-400"
        >
          Activate Boost
        </button>
      </div>
    </main>
  )
}