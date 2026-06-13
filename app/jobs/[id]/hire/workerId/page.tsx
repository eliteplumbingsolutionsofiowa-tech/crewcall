'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type HireJobUpdate = {
  worker_id: string
  assigned_worker_id: string
  status: string
}

export default function HireWorkerPage() {
  const params = useParams()
  const router = useRouter()

  const jobId = String(params.id || '')
  const workerId = String(params.workerId || '')

  const [message, setMessage] = useState('Hiring worker...')

  useEffect(() => {
    async function hireWorker() {
      if (!jobId || !workerId) {
        setMessage('Missing job or worker.')
        return
      }

      const payload: HireJobUpdate = {
        worker_id: workerId,
        assigned_worker_id: workerId,
        status: 'assigned',
      }

      const { error } = await supabase
        .from('jobs')
        .update(payload as never)
        .eq('id', jobId)

      if (error) {
        console.error('Hire worker error:', error)
        setMessage(error.message)
        return
      }

      router.push(`/jobs/${jobId}`)
    }

    hireWorker()
  }, [jobId, workerId, router])

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/10 p-6 text-center shadow-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-orange-400">
          CrewCall
        </p>

        <h1 className="mt-3 text-2xl font-black">{message}</h1>

        <p className="mt-3 text-sm text-slate-300">
          Once complete, you’ll be sent back to the job page.
        </p>

        <Link
          href={`/jobs/${jobId}`}
          className="mt-6 inline-flex rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
        >
          Back to Job
        </Link>
      </div>
    </main>
  )
}