'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import JobFilters from '@/app/components/JobFilters'

type Job = {
  id: string
  title: string | null
  description: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  start_date: string | null
  status: string | null
  payment_status: string | null
  company_id: string | null
  assigned_worker_id: string | null
  created_at: string
  company_name?: string | null
  company_verified?: boolean | null
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const [trade, setTrade] = useState('')
  const [location, setLocation] = useState('')
  const [openOnly, setOpenOnly] = useState(true)

  useEffect(() => {
    loadJobs()
  }, [])

  async function loadJobs() {
    setLoading(true)
    setMessage(null)

    const { data, error } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        description,
        trade,
        location,
        pay_rate,
        start_date,
        status,
        payment_status,
        company_id,
        assigned_worker_id,
        created_at
      `)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setJobs([])
      setLoading(false)
      return
    }

    const rawJobs = (data || []) as Job[]

    const companyIds = Array.from(
      new Set(
        rawJobs
          .map((job) => job.company_id)
          .filter((id): id is string => Boolean(id))
      )
    )

    let companyMap = new Map<string, any>()

    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from('profiles')
        .select('id, company_name, verified')
        .in('id', companyIds)

      companyMap = new Map(
        (companies || []).map((company: any) => [company.id, company])
      )
    }

    const mergedJobs: Job[] = rawJobs.map((job) => {
      const company = job.company_id ? companyMap.get(job.company_id) : null

      return {
        ...job,
        company_name: company?.company_name || 'Company',
        company_verified: company?.verified || false,
      }
    })

    setJobs(mergedJobs)
    setLoading(false)
  }

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesTrade =
        !trade || job.trade?.toLowerCase().includes(trade.toLowerCase())

      const matchesLocation =
        !location ||
        job.location?.toLowerCase().includes(location.toLowerCase())

      const matchesOpen =
        !openOnly || (job.status === 'open' && !job.assigned_worker_id)

      return matchesTrade && matchesLocation && matchesOpen
    })
  }, [jobs, trade, location, openOnly])

  const openJobsCount = useMemo(() => {
    return jobs.filter((job) => job.status === 'open' && !job.assigned_worker_id)
      .length
  }, [jobs])

  const assignedJobsCount = useMemo(() => {
    return jobs.filter((job) => Boolean(job.assigned_worker_id)).length
  }, [jobs])

  const activeFilterCount =
    Number(Boolean(trade)) + Number(Boolean(location)) + Number(openOnly)

  function clearFilters() {
    setTrade('')
    setLocation('')
    setOpenOnly(true)
  }

  function formatDate(date: string | null) {
    if (!date) return 'Start date not set'

    const parsed = new Date(date)
    if (Number.isNaN(parsed.getTime())) return 'Start date not set'

    return parsed.toLocaleDateString()
  }

  function statusLabel(job: Job) {
    if (job.assigned_worker_id) return 'Assigned'
    return job.status || 'open'
  }

  function statusClass(job: Job) {
    if (job.assigned_worker_id) {
      return 'border-blue-300/30 bg-blue-400/15 text-blue-100'
    }

    if (job.status === 'open') {
      return 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100'
    }

    return 'border-white/10 bg-white/10 text-slate-200'
  }

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
            <p className="text-lg font-black text-white">
              Loading open jobs...
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-400">
              Pulling the latest CrewCall work board.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 text-white md:px-6 md:py-10">
      <div className="pointer-events-none absolute left-[-120px] top-10 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[-100px] top-32 h-80 w-80 rounded-full bg-orange-400/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-orange-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  Browse Work
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Open CrewCall Jobs
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300 md:text-base">
                  Find open trade work posted by companies looking for help.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <MetricPill label="Showing" value={filteredJobs.length} />
                  <MetricPill label="Total Jobs" value={jobs.length} />
                  <MetricPill label="Open" value={openJobsCount} />
                  <MetricPill label="Assigned" value={assignedJobsCount} />
                  <MetricPill label="Filters" value={activeFilterCount} />
                </div>
              </div>

              <Link
                href="/profile"
                className="rounded-2xl bg-cyan-400 px-6 py-4 text-center text-sm font-black !text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-[1.02] hover:bg-cyan-300"
              >
                Complete Profile
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur md:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black text-white">Filter jobs</h2>
              <p className="text-sm font-semibold text-slate-400">
                Search by trade, location, and open availability.
              </p>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-2xl border border-white/10 bg-slate-800/95 px-5 py-3 text-sm font-black text-white shadow-md shadow-black/20 transition hover:scale-[1.02] hover:bg-slate-700"
            >
              Clear Filters
            </button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
            <JobFilters
              trade={trade}
              location={location}
              openOnly={openOnly}
              onTradeChange={setTrade}
              onLocationChange={setLocation}
              onOpenOnlyChange={setOpenOnly}
              onClear={clearFilters}
            />
          </div>
        </section>

        {message && (
          <div className="rounded-3xl border border-red-400/30 bg-red-400/10 p-5 text-sm font-bold text-red-100 shadow-sm">
            {message}
          </div>
        )}

        {filteredJobs.length === 0 && (
          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/10 p-8 shadow-2xl shadow-black/20 backdrop-blur md:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.18),transparent_30%)]" />

            <div className="relative text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-cyan-400 to-blue-500 text-5xl shadow-2xl shadow-cyan-500/20">
                🔎
              </div>

              <h2 className="mt-8 text-4xl font-black tracking-tight text-white">
                No matching jobs found
              </h2>

              <p className="mx-auto mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-300 md:text-lg">
                Try adjusting your filters, changing trade keywords, or
                searching another location to discover more CrewCall work.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-2xl bg-cyan-400 px-7 py-4 text-sm font-black text-slate-950 shadow-2xl shadow-cyan-500/20 transition hover:scale-[1.03] hover:bg-cyan-300"
                >
                  Reset Filters
                </button>

                <Link
                  href="/profile"
                  className="rounded-2xl border border-white/10 bg-slate-800/95 px-7 py-4 text-sm font-black !text-white shadow-md shadow-black/20 transition hover:scale-[1.03] hover:bg-slate-700"
                >
                  Complete Profile
                </Link>
              </div>

              <div className="mt-10 grid gap-4 md:grid-cols-3">
                <EmptyTip
                  title="Try broader trades"
                  body="Search plumbing instead of a specific niche term."
                />

                <EmptyTip
                  title="Expand location"
                  body="Nearby cities may have more active postings."
                />

                <EmptyTip
                  title="Stay active"
                  body="New jobs are added to CrewCall throughout the day."
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6">
          {filteredJobs.map((job) => (
            <article
              key={job.id}
              className="rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur transition hover:-translate-y-1 hover:border-cyan-400/30 hover:bg-white/15 md:p-6"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
                      {job.title || 'Untitled Job'}
                    </h2>

                    <span
                      className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide ${statusClass(
                        job
                      )}`}
                    >
                      {statusLabel(job)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {job.company_id ? (
                      <Link
                        href={`/companies/${job.company_id}`}
                        className="text-base font-black !text-cyan-300 no-underline hover:!text-cyan-200 md:text-lg"
                      >
                        {job.company_name || 'Company'}
                      </Link>
                    ) : (
                      <span className="text-base font-black text-slate-200 md:text-lg">
                        {job.company_name || 'Company'}
                      </span>
                    )}

                    {job.company_verified && (
                      <span className="rounded-full border border-cyan-300/30 bg-cyan-400/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-cyan-100">
                        Verified
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-base font-semibold text-slate-300 md:text-lg">
                    {job.trade || 'Trade not set'} •{' '}
                    {job.location || 'Location not set'}
                  </p>

                  {job.description && (
                    <p className="mt-5 line-clamp-3 max-w-4xl text-base leading-relaxed text-slate-300">
                      {job.description}
                    </p>
                  )}

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <JobDetailBox label="Pay Rate" value={job.pay_rate || 'Not set'} />
                    <JobDetailBox label="Start Date" value={formatDate(job.start_date)} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 lg:w-[260px] lg:flex-col">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex-1 rounded-2xl border border-white/10 bg-slate-800/95 px-5 py-4 text-center text-sm font-black !text-white shadow-md shadow-black/20 transition hover:scale-[1.02] hover:bg-slate-700"
                  >
                    View Details
                  </Link>

                  {!job.assigned_worker_id && job.status === 'open' && (
                    <Link
                      href={`/jobs/${job.id}/apply`}
                      className="flex-1 rounded-2xl bg-orange-500 px-5 py-4 text-center text-sm font-black !text-white shadow-xl shadow-orange-500/20 transition hover:scale-[1.02] hover:bg-orange-400"
                    >
                      Apply Now
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-white/10 bg-slate-950/40 px-4 py-2 text-sm font-black text-slate-100">
      {value} {label}
    </span>
  )
}

function JobDetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function EmptyTip({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 text-left">
      <p className="text-lg font-black text-white">{title}</p>
      <p className="mt-2 text-sm font-semibold text-slate-400">{body}</p>
    </div>
  )
}