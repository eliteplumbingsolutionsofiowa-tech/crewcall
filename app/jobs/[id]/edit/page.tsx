'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string
  trade: string
  location: string
  pay_rate: string | null
  start_date: string | null
  description: string | null
  status: string
  company_id: string
  is_featured: boolean | null
}

export default function EditJobPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    loadJob()
  }, [])

  async function loadJob() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error || !data) {
      setErrorMessage('Could not load job.')
      setLoading(false)
      return
    }

    if (!user || data.company_id !== user.id) {
      setErrorMessage('You can only edit jobs you posted.')
      setLoading(false)
      return
    }

    setJob(data)
    setLoading(false)
  }

  async function saveJob(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!job) return

    setSaving(true)
    setErrorMessage(null)

    const { error } = await supabase
      .from('jobs')
      .update({
        title: job.title,
        trade: job.trade,
        location: job.location,
        pay_rate: job.pay_rate || null,
        start_date: job.start_date || null,
        description: job.description || null,
        status: job.status,
      })
      .eq('id', job.id)

    if (error) {
      setErrorMessage(error.message)
      setSaving(false)
      return
    }

    router.push(`/jobs/${job.id}`)
  }

  async function closeJob() {
    if (!job) return

    setSaving(true)

    await supabase
      .from('jobs')
      .update({ status: 'cancelled' })
      .eq('id', job.id)

    router.push(`/jobs/${job.id}`)
  }

  async function deleteJob() {
    if (!job) return

    const confirmed = window.confirm(
      'Are you sure you want to delete this job?'
    )

    if (!confirmed) return

    setDeleting(true)

    await supabase.from('jobs').delete().eq('id', job.id)

    router.push('/jobs')
  }

  if (loading) return <div className="p-6">Loading job...</div>

  if (!job) return <div className="p-6 text-red-600">Job not found</div>

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Edit Job</h1>

      <form onSubmit={saveJob} className="space-y-4">
        <input
          value={job.title}
          onChange={(e) => setJob({ ...job, title: e.target.value })}
          className="w-full border p-2"
        />

        <textarea
          value={job.description || ''}
          onChange={(e) => setJob({ ...job, description: e.target.value })}
          className="w-full border p-2"
        />

        <div className="flex gap-3">
          <button className="bg-blue-600 px-4 py-2 text-white">
            Save
          </button>

          <button
            type="button"
            onClick={() => router.push(`/jobs/${job.id}`)}
            className="border px-4 py-2"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => router.push(`/jobs/${job.id}/boost`)}
            className="bg-yellow-500 px-4 py-2"
          >
            Boost Job
          </button>

          <button
            type="button"
            onClick={closeJob}
            className="bg-gray-800 px-4 py-2 text-white"
          >
            Close
          </button>

          <button
            type="button"
            onClick={deleteJob}
            className="bg-red-600 px-4 py-2 text-white"
          >
            Delete
          </button>
        </div>
      </form>
    </main>
  )
}