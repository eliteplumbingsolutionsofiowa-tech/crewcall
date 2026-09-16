'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const TRADES = [
  'Plumbing',
  'Electrical',
  'HVAC / Refrigeration',
  'Carpentry',
  'Roofing',
  'Concrete / Masonry',
  'Painting / Drywall',
  'Landscaping / Excavation',
  'General Contracting',
  'Other',
]

export default function NewHomeownerProjectPage() {
  const router = useRouter()

  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [trade, setTrade] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [bidDeadline, setBidDeadline] = useState('')
  const [workDeadline, setWorkDeadline] = useState('')

  useEffect(() => {
    let active = true

    async function checkAccess() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!active) return

      if (!user) {
        router.replace('/login?redirect=/homeowner/projects/new')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (!active) return

      if (profile?.role !== 'homeowner') {
        router.replace('/profile')
        return
      }

      setChecking(false)
    }

    void checkAccess()

    return () => {
      active = false
    }
  }, [router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submitting) return

    setError(null)
    setSubmitting(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        router.replace('/login?redirect=/homeowner/projects/new')
        return
      }

      const response = await fetch('/api/homeowner/projects', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          trade,
          location,
          description,
          bid_deadline: bidDeadline,
          work_deadline: workDeadline || null,
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { id?: string; error?: string }
        | null

      if (!response.ok || !payload?.id) {
        throw new Error(
          payload?.error || 'Unable to post your project.'
        )
      }

      router.push(`/jobs/${payload.id}`)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to post your project.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.12),_transparent_30%),linear-gradient(to_bottom,_#020617,_#07111f_55%,_#020617)] px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-bold text-slate-400">
            Loading CrewCall...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.12),_transparent_30%),linear-gradient(to_bottom,_#020617,_#07111f_55%,_#020617)] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <Link
            href="/homeowner/projects"
            className="text-sm font-black text-cyan-300 transition hover:text-cyan-200"
          >
            ← My Projects
          </Link>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            CrewCall Homeowner
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Post a Project
          </h1>

          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-300 sm:text-base">
            Tell local contractors what you need done. Your project
            will be listed as a CrewCall bid opportunity so qualified
            companies can submit bids.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-[2rem] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.12),_transparent_35%),linear-gradient(135deg,_rgba(15,23,42,0.97),_rgba(8,25,42,0.94))] p-5 shadow-[0_25px_80px_-35px_rgba(6,182,212,0.55)] ring-1 ring-white/5 sm:p-8"
        >
          <div>
            <label
              htmlFor="project-title"
              className="mb-2 block text-sm font-black text-white"
            >
              Project title
            </label>

            <input
              id="project-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Replace water heater"
              required
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white shadow-inner outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/10"
            />
          </div>

          <div>
            <label
              htmlFor="project-trade"
              className="mb-2 block text-sm font-black text-white"
            >
              Trade
            </label>

            <select
              id="project-trade"
              value={trade}
              onChange={(event) => setTrade(event.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white shadow-inner outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/10"
            >
              <option value="">Select a trade</option>

              {TRADES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="project-location"
              className="mb-2 block text-sm font-black text-white"
            >
              Project location
            </label>

            <input
              id="project-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="City, State"
              required
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white shadow-inner outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/10"
            />
          </div>

          <div>
            <label
              htmlFor="project-description"
              className="mb-2 block text-sm font-black text-white"
            >
              Describe the project
            </label>

            <textarea
              id="project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the work you need completed, important details, existing conditions, and anything contractors should know before bidding."
              rows={7}
              required
              className="w-full resize-y rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white shadow-inner outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/10"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="bid-deadline"
                className="mb-2 block text-sm font-black text-white"
              >
                Bids due
              </label>

              <input
                id="bid-deadline"
                type="datetime-local"
                value={bidDeadline}
                onChange={(event) =>
                  setBidDeadline(event.target.value)
                }
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white shadow-inner outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/10"
              />
            </div>

            <div>
              <label
                htmlFor="work-deadline"
                className="mb-2 block text-sm font-black text-white"
              >
                Desired completion
              </label>

              <input
                id="work-deadline"
                type="date"
                value={workDeadline}
                onChange={(event) =>
                  setWorkDeadline(event.target.value)
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white shadow-inner outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/10"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm font-bold text-red-200 shadow-[0_12px_30px_-20px_rgba(248,113,113,0.6)]">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl border border-cyan-300/20 bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-4 text-base font-black text-slate-950 shadow-[0_12px_35px_-12px_rgba(34,211,238,0.75)] transition hover:scale-[1.01] hover:shadow-[0_16px_45px_-12px_rgba(34,211,238,0.9)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? 'Posting Project...'
              : 'Post Project for Contractor Bids'}
          </button>

          <p className="text-center text-xs font-semibold leading-5 text-slate-300">
            Contractors will be able to review the project and submit
            their bid through CrewCall.
          </p>
        </form>
      </div>
    </main>
  )
}
