'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Worker = {
  id: string
  full_name: string | null
  company_name?: string | null
  trade?: string | null
}

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  status: string | null
}

type ExistingInvite = {
  id: string
  status: string | null
}

type JobInviteInsert = {
  job_id: string
  worker_id: string
  company_id: string
  status: 'pending'
  worker_seen: boolean
  company_seen: boolean
}

type Props = {
  worker: Worker
  open: boolean
  onClose: () => void
}

type QueryError = {
  message: string
}

type LimitlessOrderQuery<T> = {
  order: (
    column: string,
    options?: { ascending?: boolean }
  ) => Promise<{ data: T[] | null; error: QueryError | null }>
}

type InOrderQuery<T> = {
  in: (column: string, values: string[]) => LimitlessOrderQuery<T>
}

type EqInQuery<T> = {
  eq: (column: string, value: string) => InOrderQuery<T>
}

type SelectEqInTable<T> = {
  select: (columns: string) => EqInQuery<T>
}

type MaybeSingleQuery<T> = {
  maybeSingle: () => Promise<{ data: T | null; error: QueryError | null }>
}

type ExistingInviteQuery<T> = {
  eq: (column: string, value: string) => ExistingInviteQuery<T>
  maybeSingle: () => Promise<{ data: T | null; error: QueryError | null }>
}

type ExistingInviteTable<T> = {
  select: (columns: string) => ExistingInviteQuery<T>
}

type InsertTable<TInsert> = {
  insert: (
    value: TInsert
  ) => Promise<{ data: null; error: QueryError | null }>
}

function companyJobsTable() {
  return supabase.from('jobs') as unknown as SelectEqInTable<Job>
}

function existingInvitesTable() {
  return supabase
    .from('job_invites') as unknown as ExistingInviteTable<ExistingInvite>
}

function inviteInsertTable() {
  return supabase.from('job_invites') as unknown as InsertTable<JobInviteInsert>
}

export default function InviteWorkerModal({ worker, open, onClose }: Props) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      loadCompanyJobs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function loadCompanyJobs() {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('Please log in before inviting workers.')
      setJobs([])
      setLoading(false)
      return
    }

    const { data, error } = await companyJobsTable()
      .select('id, title, trade, location, status')
      .eq('company_id', user.id)
      .in('status', ['open', 'active'])
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setJobs([])
      setLoading(false)
      return
    }

    const nextJobs = data ?? []
    setJobs(nextJobs)

    if (nextJobs[0]?.id) {
      setSelectedJobId(nextJobs[0].id)
    }

    setLoading(false)
  }

  async function sendInvite() {
    if (!selectedJobId) {
      setMessage('Choose a job first.')
      return
    }

    setSending(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('Please log in before sending an invite.')
      setSending(false)
      return
    }

    const { data: existingInvite, error: existingError } =
      await existingInvitesTable()
        .select('id, status')
        .eq('job_id', selectedJobId)
        .eq('worker_id', worker.id)
        .maybeSingle()

    if (existingError) {
      setMessage(existingError.message)
      setSending(false)
      return
    }

    if (existingInvite?.id) {
      setMessage('This worker already has an invite for that job.')
      setSending(false)
      return
    }

    const { error: inviteError } = await inviteInsertTable().insert({
      job_id: selectedJobId,
      worker_id: worker.id,
      company_id: user.id,
      status: 'pending',
      worker_seen: false,
      company_seen: true,
    })

    if (inviteError) {
      setMessage(inviteError.message)
      setSending(false)
      return
    }

    setMessage('Invite sent successfully.')
    setSending(false)

    setTimeout(() => {
      onClose()
    }, 700)
  }

  if (!open) return null

  const workerName =
    worker.full_name || worker.company_name || worker.trade || 'this worker'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">
              Invite Worker
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Invite {workerName}
            </h2>

            <p className="mt-2 text-sm font-bold text-slate-500">
              Pick one of your open jobs and send this worker an invite.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-1 text-lg font-black text-slate-700 hover:bg-slate-200"
          >
            ×
          </button>
        </div>

        {message && (
          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
            {message}
          </div>
        )}

        <div className="mt-5 space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-500">
              Loading your jobs...
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">
              You do not have any open jobs to invite this worker to.
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">
                Choose Job
              </label>

              <select
                value={selectedJobId}
                onChange={(event) => setSelectedJobId(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500"
              >
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title || 'Untitled job'} — {job.trade || 'Trade'} —{' '}
                    {job.location || 'Location'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-900 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={sendInvite}
            disabled={sending || loading || jobs.length === 0}
            className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-orange-400 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  )
}