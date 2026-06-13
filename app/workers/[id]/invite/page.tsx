'use client'

import { useCallback, useEffect, useState } from 'react'
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

type ExistingInvite = {
  id: string
}

export default function InviteWorkerPage() {
  const params = useParams()
  const router = useRouter()

  const workerId = String(params?.id || '')

  const [worker, setWorker] = useState<Worker | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const loadPage = useCallback(async () => {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('You must be logged in to invite workers.')
      setLoading(false)
      return
    }

    const { data: workerData, error: workerError } = await supabase
      .from('profiles')
      .select('id, full_name, trade')
      .eq('id', workerId)
      .maybeSingle<Worker>()

    if (workerError) {
      setMessage(workerError.message)
      setLoading(false)
      return
    }

    const { data: jobData, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title, trade, location, status')
      .eq('company_id', user.id)
      .in('status', ['open', 'assigned', 'in_progress'])
      .order('created_at', { ascending: false })
      .returns<Job[]>()

    if (jobsError) {
      setMessage(jobsError.message)
      setLoading(false)
      return
    }

    const safeJobs = jobData || []

    setWorker(workerData || null)
    setJobs(safeJobs)
    setSelectedJobId(safeJobs[0]?.id || '')
    setLoading(false)
  }, [workerId])

  useEffect(() => {
    loadPage()
  }, [loadPage])

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

    const { data: existing, error: existingError } = await supabase
      .from('job_invites')
      .select('id')
      .eq('job_id', selectedJobId)
      .eq('worker_id', workerId)
      .maybeSingle<ExistingInvite>()

    if (existingError) {
      setMessage(existingError.message)
      setSending(false)
      return
    }

    if (existing) {
      setMessage('You already invited this worker to that job.')
      setSending(false)
      return
    }

    const { error: inviteError } = await supabase.from('job_invites').insert({
      job_id: selectedJobId,
      worker_id: workerId,
      company_id: user.id,
      status: 'pending',
      company_seen: true,
      worker_seen: false,
    })

    if (inviteError) {
      setMessage(inviteError.message)
      setSending(false)
      return
    }

    await supabase.from('notifications').insert({
      user_id: workerId,
      type: 'invite',
      title: 'New job invite',
      body: 'A company invited you to a job.',
      link_url: '/worker/invites',
      is_read: false,
      read: false,
    })

    setSuccess(true)
    setSending(false)

    router.push('/company/invites')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
        <p className="text-slate-300">Loading invite page...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
            CrewCall
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Invite Worker
          </h1>

          <p className="mt-2 text-slate-300">
            Invite <b>{worker?.full_name || 'this worker'}</b> to one of your
            jobs.
          </p>
        </div>

        <CrewCard className="space-y-5">
          <div>
            <h2 className="text-xl font-black text-white">
              {worker?.full_name || 'Worker'}
            </h2>

            <p className="text-sm font-bold text-cyan-300">
              {worker?.trade || 'Trade not listed'}
            </p>
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm font-bold text-yellow-100">
              You do not have any open jobs to invite this worker to.
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-black text-slate-200">
                Select Job
              </label>

              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
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
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
              {message}
            </div>
          )}

          {success && (
            <div className="rounded-2xl border border-green-400/30 bg-green-500/10 p-4 text-sm font-bold text-green-100">
              Invite sent successfully.
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