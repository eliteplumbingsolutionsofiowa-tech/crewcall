'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Role = 'company' | 'worker' | null

type Profile = {
  id: string
  role: Role
  company_name: string | null
  full_name: string | null
}

type JobInsert = {
  company_id: string
  title: string
  trade: string
  location: string
  pay_rate: string
  description: string
  status: 'open'
  payment_status: 'unpaid'
}

type JobRow = {
  id: string
}

type QueryError = {
  message: string
}

type MaybeSingleBuilder<T> = {
  maybeSingle: () => Promise<{ data: T | null; error: QueryError | null }>
}

type SingleBuilder<T> = {
  single: () => Promise<{ data: T | null; error: QueryError | null }>
}

type SelectEqBuilder<T> = {
  eq: (column: string, value: string) => MaybeSingleBuilder<T>
}

type InsertSelectBuilder<T> = {
  select: (columns: string) => SingleBuilder<T>
}

type SelectTable<T> = {
  select: (columns: string) => SelectEqBuilder<T>
}

type InsertTable<TInsert, TReturn> = {
  insert: (value: TInsert) => InsertSelectBuilder<TReturn>
}

function profilesTable() {
  return supabase.from('profiles') as unknown as SelectTable<Profile>
}

function jobsTable() {
  return supabase.from('jobs') as unknown as InsertTable<JobInsert, JobRow>
}

export default function PostJobPage() {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [title, setTitle] = useState('')
  const [trade, setTrade] = useState('')
  const [location, setLocation] = useState('')
  const [payRate, setPayRate] = useState('')
  const [description, setDescription] = useState('')

  const canPost = useMemo(() => {
    return (
      profile?.role === 'company' &&
      title.trim().length > 1 &&
      trade.trim().length > 1 &&
      location.trim().length > 1 &&
      payRate.trim().length > 0 &&
      description.trim().length > 5
    )
  }, [description, location, payRate, profile?.role, title, trade])

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      setMessage('')

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace('/login')
        return
      }

      const { data, error } = await profilesTable()
        .select('id, role, company_name, full_name')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        setMessage(error.message)
        setLoading(false)
        return
      }

      setProfile(data)
      setLoading(false)
    }

    loadProfile()
  }, [router])

  async function createJobMatches(jobId: string) {
    try {
      const response = await fetch('/api/jobs/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        console.warn('CrewCall matching failed:', result?.error)
      }
    } catch (error) {
      console.warn('CrewCall matching failed:', error)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving) return

    if (!profile) {
      setMessage('You need to be signed in to post a job.')
      return
    }

    if (profile.role !== 'company') {
      setMessage('Only company accounts can post jobs.')
      return
    }

    if (!canPost) {
      setMessage('Please fill out every required field.')
      return
    }

    setSaving(true)
    setMessage('Posting job...')

    try {
      const payload: JobInsert = {
        company_id: profile.id,
        title: title.trim(),
        trade: trade.trim(),
        location: location.trim(),
        pay_rate: payRate.trim(),
        description: description.trim(),
        status: 'open',
        payment_status: 'unpaid',
      }

      const { data, error } = await jobsTable()
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        setMessage(error.message)
        setSaving(false)
        return
      }

      if (!data?.id) {
        setMessage('Job was posted, but CrewCall could not find the new job ID.')
        setSaving(false)
        return
      }

      setMessage('Job posted. Finding best worker matches...')

      await createJobMatches(data.id)

      window.dispatchEvent(new Event('crewcall-refresh-nav'))
      router.replace(`/my-jobs/${data.id}`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to post job.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
        <section className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <p className="text-sm font-bold text-cyan-200">Loading post job...</p>
        </section>
      </main>
    )
  }

  if (profile?.role !== 'company') {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
        <section className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <h1 className="text-3xl font-black">Company account required</h1>

          <p className="mt-3 text-slate-300">
            You need a company profile to post jobs on CrewCall.
          </p>

          {message ? (
            <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
              {message}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/profile"
              className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950"
            >
              Go to Profile
            </Link>

            <Link
              href="/jobs"
              className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white"
            >
              Browse Jobs
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <section className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/15 via-blue-500/10 to-white/5 p-6 shadow-2xl">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-200">
            CrewCall
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Post a Job
          </h1>

          <p className="mt-3 max-w-2xl text-base font-semibold text-slate-300">
            Add the trade, location, pay, and scope. CrewCall will automatically
            find matching workers after the job is posted.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl sm:p-6"
        >
          {message ? (
            <div className="mb-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm font-bold text-cyan-100">
              {message}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-black text-slate-200">
                Job Title
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Rough-in help needed"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none ring-cyan-300/40 placeholder:text-slate-500 focus:ring-4"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-200">Trade</span>
              <input
                value={trade}
                onChange={(event) => setTrade(event.target.value)}
                placeholder="Plumbing, HVAC, Electrical..."
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none ring-cyan-300/40 placeholder:text-slate-500 focus:ring-4"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-200">
                Location
              </span>
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Ankeny, IA"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none ring-cyan-300/40 placeholder:text-slate-500 focus:ring-4"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-200">
                Pay Rate
              </span>
              <input
                value={payRate}
                onChange={(event) => setPayRate(event.target.value)}
                placeholder="$500/day, $85/hr, $2,500 total..."
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none ring-cyan-300/40 placeholder:text-slate-500 focus:ring-4"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-black text-slate-200">
              Job Scope
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the job, schedule, tools needed, expectations, and any special notes."
              rows={7}
              className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none ring-cyan-300/40 placeholder:text-slate-500 focus:ring-4"
            />
          </label>

          <div className="mt-5 rounded-2xl border border-orange-400/25 bg-orange-400/10 p-4">
            <p className="text-sm font-black text-orange-100">
              After posting, CrewCall will rank matching workers by trade,
              location, availability, credentials, online status, and pay fit.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/company/jobs"
              className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center text-sm font-black text-white"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving || !canPost}
              className="rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/40 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Posting + Matching...' : 'Post Job + Find Matches'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}