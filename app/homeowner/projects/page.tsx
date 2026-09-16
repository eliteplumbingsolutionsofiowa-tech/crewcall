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
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
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
            className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-5 py-3 text-sm font-black text-white transition hover:bg-sky-400"
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
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-center sm:p-12">
            <h2 className="text-2xl font-black">
              Ready to hire a contractor?
            </h2>

            <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-6 text-slate-300">
              Post your first project and let CrewCall contractors
              submit bids for the work.
            </p>

            <Link
              href="/homeowner/projects/new"
              className="mt-6 inline-flex rounded-xl bg-sky-500 px-6 py-3 text-sm font-black text-white hover:bg-sky-400"
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
                className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-sky-400/50 hover:bg-white/[0.07] sm:p-6"
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

                  <div className="min-w-[150px] rounded-xl border border-white/10 bg-slate-900/70 p-4 text-center">
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
