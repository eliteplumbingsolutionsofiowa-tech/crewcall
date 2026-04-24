'use client'

import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ApplyPage() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const jobId = String(params.id || '')

  async function handleApply() {
    setLoading(true)
    setMessage(null)

    if (!jobId) {
      setMessage('Job ID is missing.')
      setLoading(false)
      return
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      setMessage(userError.message)
      setLoading(false)
      return
    }

    if (!user) {
      setMessage('You must be logged in to apply.')
      setLoading(false)
      return
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, company_id')
      .eq('id', jobId)
      .maybeSingle()

    if (jobError || !job) {
      setMessage('Job not found.')
      setLoading(false)
      return
    }

    if (job.company_id === user.id) {
      setMessage('You cannot apply to your own job.')
      setLoading(false)
      return
    }

    const { data: existingApplication } = await supabase
      .from('job_applications')
      .select('id')
      .eq('job_id', jobId)
      .eq('worker_id', user.id)
      .maybeSingle()

    if (existingApplication) {
      setMessage('You already applied to this job.')
      setLoading(false)
      return
    }

    const { error: applicationError } = await supabase
      .from('job_applications')
      .insert({
        job_id: jobId,
        worker_id: user.id,
        status: 'pending',
      })

    if (applicationError) {
      setMessage(applicationError.message)
      setLoading(false)
      return
    }

    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('job_id', jobId)
      .eq('worker_id', user.id)
      .eq('company_id', job.company_id)
      .maybeSingle()

    if (!existingConversation) {
      await supabase.from('conversations').insert({
        job_id: jobId,
        worker_id: user.id,
        company_id: job.company_id,
      })
    }

    await supabase.from('notifications').insert({
      user_id: job.company_id,
      title: 'New Applicant',
      body: `Someone applied to your job: ${job.title || 'Job'}`,
      read: false,
    })

    setMessage('Application submitted!')
    setLoading(false)

    setTimeout(() => {
      router.push(`/jobs/${jobId}`)
      router.refresh()
    }, 1000)
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6">
        <Link
          href={`/jobs/${jobId}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Job
        </Link>
      </div>

      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Apply for Job</h1>

        <p className="mt-3 text-gray-600">
          Click below to submit your application.
        </p>

        <div className="mt-6">
          <button
            onClick={handleApply}
            disabled={loading}
            className="rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>

        {message && (
          <div className="mt-4 text-sm text-blue-600">{message}</div>
        )}
      </div>
    </main>
  )
}