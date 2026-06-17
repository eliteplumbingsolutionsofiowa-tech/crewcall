'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  company_id: string | null
  assigned_worker_id: string | null
}

function NewReviewPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const jobId = searchParams.get('jobId') || searchParams.get('job')
  const explicitRevieweeId =
    searchParams.get('revieweeId') ||
    searchParams.get('worker') ||
    searchParams.get('to')

  const [message, setMessage] = useState('Finding review page...')

  useEffect(() => {
    async function redirectToCorrectReviewPage() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setMessage('You must be logged in to leave a review.')
        return
      }

      if (!jobId) {
        setMessage('Missing job information.')
        return
      }

      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('id, title, company_id, assigned_worker_id')
        .eq('id', jobId)
        .returns<Job[]>()
        .maybeSingle()

      if (jobError || !jobData) {
        setMessage(jobError?.message || 'Job not found.')
        return
      }

      const isCompany = user.id === jobData.company_id
      const isWorker = user.id === jobData.assigned_worker_id

      if (!isCompany && !isWorker) {
        setMessage('You can only review jobs you were part of.')
        return
      }

      if (!jobData.company_id || !jobData.assigned_worker_id) {
        setMessage('This job is missing company or worker information.')
        return
      }

      const automaticRevieweeId = isCompany
        ? jobData.assigned_worker_id
        : jobData.company_id

      const revieweeId = explicitRevieweeId || automaticRevieweeId

      router.replace(`/jobs/${jobData.id}/review?to=${revieweeId}`)
    }

    redirectToCorrectReviewPage()
  }, [jobId, explicitRevieweeId, router])

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
          CrewCall Review
        </p>

        <h1 className="mt-4 text-3xl font-black text-white">
          Review Redirect
        </h1>

        <p className="mt-4 text-sm font-bold text-slate-300">{message}</p>

        <div className="mt-6">
          <Link
            href="/completed-jobs"
            className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
          >
            Back to Completed Jobs
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function NewReviewPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-10 text-white">
          <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
            <p className="text-sm font-black text-white">Loading review...</p>
          </div>
        </main>
      }
    >
      <NewReviewPageContent />
    </Suspense>
  )
}