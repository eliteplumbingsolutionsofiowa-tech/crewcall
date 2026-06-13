'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type EditableJob = {
  id: string
  company_id: string
  title: string | null
  description: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  start_date: string | null
  status: string | null
}

type JobUpdatePayload = {
  title: string
  description: string
  trade: string
  location: string
  pay_rate: string
  start_date: string | null
  status: string
}

export default function EditJobPage() {
  const params = useParams()
  const router = useRouter()

  const jobId = String(params.id || '')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [trade, setTrade] = useState('')
  const [location, setLocation] = useState('')
  const [payRate, setPayRate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [status, setStatus] = useState('open')

  const canSave = useMemo(() => {
    return title.trim().length > 0 && trade.trim().length > 0
  }, [title, trade])

  useEffect(() => {
    async function loadJob() {
      setLoading(true)
      setMessage(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace('/login')
        return
      }

      const { data, error } = await supabase
        .from('jobs')
        .select(
          'id, company_id, title, description, trade, location, pay_rate, start_date, status'
        )
        .eq('id', jobId)
        .maybeSingle<EditableJob>()

      if (error) {
        setMessage(error.message)
        setLoading(false)
        return
      }

      if (!data) {
        setMessage('Job not found.')
        setLoading(false)
        return
      }

      if (data.company_id !== user.id) {
        setMessage('You are not allowed to edit this job.')
        setLoading(false)
        return
      }

      setTitle(data.title || '')
      setDescription(data.description || '')
      setTrade(data.trade || '')
      setLocation(data.location || '')
      setPayRate(data.pay_rate || '')
      setStartDate(data.start_date || '')
      setStatus(data.status || 'open')

      setLoading(false)
    }

    if (jobId) {
      loadJob()
    }
  }, [jobId, router])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSave) {
      setMessage('Job title and trade are required.')
      return
    }

    setSaving(true)
    setMessage(null)

    const payload: JobUpdatePayload = {
      title: title.trim(),
      description: description.trim(),
      trade: trade.trim(),
      location: location.trim(),
      pay_rate: payRate.trim(),
      start_date: startDate ? startDate : null,
      status,
    }

    const { error } = await supabase
      .from('jobs')
      .update(payload as never)
      .eq('id', jobId)

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    router.push(`/jobs/${jobId}`)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl">
          <p className="text-sm text-slate-300">Loading job editor...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-orange-400">
              CrewCall
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Edit Job
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Update the job details workers will see.
            </p>
          </div>

          <Link
            href={`/jobs/${jobId}`}
            className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white/15"
          >
            Back to Job
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl sm:p-6"
        >
          {message ? (
            <div className="mb-5 rounded-2xl border border-orange-400/30 bg-orange-500/10 p-4 text-sm font-bold text-orange-200">
              {message}
            </div>
          ) : null}

          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-black text-slate-200">
                Job Title
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400"
                placeholder="Example: Licensed plumber needed"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black text-slate-200">Trade</span>
              <input
                value={trade}
                onChange={(event) => setTrade(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400"
                placeholder="Example: Plumbing"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black text-slate-200">
                Location
              </span>
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400"
                placeholder="Example: Des Moines, IA"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black text-slate-200">
                Pay Rate
              </span>
              <input
                value={payRate}
                onChange={(event) => setPayRate(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400"
                placeholder="Example: $45/hr or $2,500 flat"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black text-slate-200">
                Start Date
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-orange-400"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black text-slate-200">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-orange-400"
              >
                <option value="open">Open</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black text-slate-200">
                Description
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={7}
                className="resize-none rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400"
                placeholder="Describe the job, scope, tools needed, schedule, and expectations..."
              />
            </label>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving || !canSave}
              className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>

            <Link
              href={`/jobs/${jobId}`}
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white/15"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}