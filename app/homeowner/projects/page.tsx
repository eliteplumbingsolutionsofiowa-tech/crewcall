'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Project = {
  id: string
  title: string
  trade: string
  location: string
  description: string | null
  status: string
  job_type: string
  bid_deadline: string | null
  work_deadline: string | null
  created_at: string | null
  bid_count: number
}

function formatDate(value: string | null) {
  if (!value) return 'Not set'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function statusLabel(status: string) {
  if (status === 'open') return 'Open for Bids'
  if (status === 'filled') return 'Contractor Selected'
  if (status === 'completed') return 'Completed'
  if (status === 'closed') return 'Closed'

  return status.replaceAll('_', ' ')
}

export default function HomeownerProjectsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        router.replace('/login?redirect=/homeowner/projects')
        return
      }

      const response = await fetch('/api/homeowner/projects', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const payload = (await response.json().catch(() => null)) as
        | { projects?: Project[]; error?: string }
        | null

      if (!response.ok) {
        if (response.status === 403) {
          router.replace('/profile')
          return
        }

        throw new Error(
          payload?.error || 'Unable to load your projects.'
        )
      }

      setProjects(payload?.projects || [])
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load your projects.'
      )
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.12),_transparent_30%),linear-gradient(to_bottom,_#020617,_#07111f_55%,_#020617)] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-400">
              CrewCall Homeowner
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              My Projects
            </h1>

            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-300">
              Manage the projects you've posted and review contractor
              activity.
            </p>
          </div>

          <Link
            href="/homeowner/projects/new"
            className="inline-flex items-center justify-center rounded-2xl border border-cyan-300/20 bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-4 text-sm font-black text-slate-950 shadow-[0_12px_35px_-12px_rgba(34,211,238,0.75)] transition hover:scale-[1.02] hover:shadow-[0_16px_45px_-12px_rgba(34,211,238,0.9)]"
          >
            + Post a Project
          </Link>
        </div>

        {error ? (
          <div className="mt-8 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm font-bold text-slate-400">
            Loading your projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-10 rounded-[2rem] border border-cyan-400/20 bg-[radial-gradient(circle_at_top,_rgba(6,182,212,0.12),_transparent_42%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(8,25,42,0.92))] p-8 text-center shadow-[0_20px_60px_-35px_rgba(6,182,212,0.55)] ring-1 ring-white/5 sm:p-12">
            <h2 className="text-2xl font-black">
              Ready to hire a contractor?
            </h2>

            <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-6 text-slate-300">
              Post your first project and let CrewCall contractors
              submit bids for the work.
            </p>

            <Link
              href="/homeowner/projects/new"
              className="mt-6 inline-flex rounded-2xl border border-cyan-300/20 bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-4 text-sm font-black text-slate-950 shadow-[0_12px_35px_-12px_rgba(34,211,238,0.75)] transition hover:scale-[1.02]"
            >
              Post Your First Project
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/jobs/${project.id}`}
                className="group block rounded-[2rem] border border-cyan-400/15 bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-cyan-950/20 p-5 shadow-[0_18px_50px_-28px_rgba(6,182,212,0.45)] ring-1 ring-white/5 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-[0_24px_65px_-28px_rgba(6,182,212,0.65)] sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-black text-sky-300">
                        {project.trade}
                      </span>

                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black capitalize text-slate-300">
                        {statusLabel(project.status)}
                      </span>
                    </div>

                    <h2 className="mt-4 text-xl font-black">
                      {project.title}
                    </h2>

                    <p className="mt-2 text-sm font-semibold text-slate-400">
                      {project.location}
                    </p>

                    {project.description ? (
                      <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-slate-300">
                        {project.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="min-w-[160px] rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 via-slate-900/90 to-blue-500/10 p-5 text-center shadow-[0_0_35px_-15px_rgba(34,211,238,0.65)] ring-1 ring-white/5">
                    <div className="text-3xl font-black text-sky-400">
                      {project.bid_count}
                    </div>

                    <div className="mt-1 text-xs font-black uppercase tracking-wider text-slate-400">
                      {project.bid_count === 1
                        ? 'Contractor Bid'
                        : 'Contractor Bids'}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-4 text-xs font-bold text-slate-400">
                  <span>
                    Posted {formatDate(project.created_at)}
                  </span>

                  <span>
                    Bids due {formatDate(project.bid_deadline)}
                  </span>

                  {project.work_deadline ? (
                    <span>
                      Desired completion{' '}
                      {formatDate(project.work_deadline)}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
