'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CrewButton } from '@/app/components/CrewButton'
import { CrewCard } from '@/app/components/CrewCard'

type Job = {
  id: string
  title: string
  trade: string | null
  location: string | null
  status: string | null
}

type Worker = {
  id: string
  full_name: string | null
  trade: string | null
}

export default function InviteWorkerPage() {
  const params = useParams()
  const router = useRouter()
  const workerId = String(params.id || '')

  const [worker, setWorker] = useState<Worker | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadPage()
  }, [])

  async function loadPage() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('You must be logged in to invite workers.')
      setLoading(false)
      return
    }

    const { data: workerData } = await supabase
      .from('profiles')
      .select('id, full_name, trade')
      .eq('id', workerId)
      .maybeSingle()

    const { data: jobData } = await supabase
      .from('jobs')
      .select('id, title, trade, location, status')
      .eq('company_id', user.id)
      .in('status', ['open', 'assigned'])
      .order('created_at', { ascending: false })

    setWorker((workerData as Worker) || null)
    setJobs((jobData as Job[]) || [])

    if (jobData && jobData.length > 0) {
      setSelectedJobId(jobData[0].id)
    }

    setLoading(false)
  }

  async function sendInvite() {
    setSending(true)
    setMessage(null)
    setSuccess(false)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('You must be logged in.')
      setSending(false)
      return
    }

    if (!selectedJobId) {
      setMessage('Select a job first.')
      setSending(false)
      return
    }

    // 🔥 PREVENT DUPLICATE INVITES
    const { data: existing } = await supabase
      .from('job_invites')
      .select('id')
      .eq('job_id', selectedJobId)
      .eq('worker_id', workerId)
      .maybeSingle()

    if (existing) {
      setMessage('You already invited this worker to that job.')
      setSending(false)
      return
    }

    const { error } = await supabase.from('job_invites').insert({
      job_id: selectedJobId,
      worker_id: workerId,
      company_id: user.id,
      status: 'pending',
    })

    if (error) {
      setMessage(error.message)
      setSending(false)
      return
    }

    setSuccess(true)
    setSending(false)

    // optional redirect delay
    setTimeout(() => {
      router.push('/invites')
    }, 1200)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-8">
        <p className="text-gray-600">Loading invite page...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            CrewCall
          </p>

          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            Invite Worker
          </h1>

          <p className="mt-2 text-gray-600">
            Invite{' '}
            <b>{worker?.full_name || 'this worker'}</b> to one of your jobs.
          </p>
        </div>

        <CrewCard className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {worker?.full_name || 'Worker'}
            </h2>

            <p className="text-sm text-blue-600">
              {worker?.trade || 'Trade not listed'}
            </p>
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              You do not have any open jobs to invite this worker to.
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Select Job
              </label>

              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} ({job.status}) — {job.trade || 'No trade'} —{' '}
                    {job.location || 'No location'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {message && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {message}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              Invite sent successfully
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <CrewButton
              onClick={sendInvite}
              disabled={sending || jobs.length === 0}
            >
              {sending ? 'Sending...' : 'Send Invite'}
            </CrewButton>

            <CrewButton href="/workers" variant="ghost">
              Back to Workers
            </CrewButton>
          </div>
        </CrewCard>
      </div>
    </main>
  )
}