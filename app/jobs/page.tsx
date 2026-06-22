'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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
  created_at: string | null
}

type CompanyProfile = {
  id: string
  full_name: string | null
  company_name: string | null
  company_verified: boolean | null
}

export default function JobsPage() {
  const db = supabase as any

  const [jobs, setJobs] = useState<Job[]>([])
  const [companyMap, setCompanyMap] = useState<Map<string, CompanyProfile>>(
    new Map()
  )
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [trade, setTrade] = useState('')
  const [location, setLocation] = useState('')
  const [openOnly, setOpenOnly] = useState(true)

  useEffect(() => {
    loadJobs()
  }, [])

  async function loadJobs() {
    setLoading(true)
    setMessage('')

    const { data, error } = await db
      .from('jobs')
      .select(
        `
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
      `
      )
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setJobs([])
      setLoading(false)
      return
    }

    const rawJobs = ((data || []) as unknown) as Job[]

    const companyIds = Array.from(
      new Set(
        rawJobs
          .map((job) => job.company_id)
          .filter((id): id is string => Boolean(id))
      )
    )

    let nextCompanyMap = new Map<string, CompanyProfile>()

    if (companyIds.length > 0) {
      const { data: companies } = await db
        .from('profiles')
        .select('id, full_name, company_name, company_verified')
        .in('id', companyIds)

      nextCompanyMap = new Map(
        (((companies || []) as unknown) as CompanyProfile[]).map((company) => [
          company.id,
          company,
        ])
      )
    }

    setJobs(rawJobs)
    setCompanyMap(nextCompanyMap)
    setLoading(false)
  }

  const trades = useMemo(() => {
    return Array.from(
      new Set(
        jobs
          .map((job) => job.trade)
          .filter((value): value is string => Boolean(value))
      )
    ).sort()
  }, [jobs])

  const locations = useMemo(() => {
    return Array.from(
      new Set(
        jobs
          .map((job) => job.location)
          .filter((value): value is string => Boolean(value))
      )
    ).sort()
  }, [jobs])

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesTrade = trade ? job.trade === trade : true
      const matchesLocation = location ? job.location === location : true
      const matchesOpen = openOnly
        ? job.status === 'open' && !job.assigned_worker_id
        : true

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

    if (Number.isNaN(parsed.getTime())) {
      return 'Start date not set'
    }

    return parsed.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-slate-300">Loading jobs...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-300">
                CrewCall Jobs
              </p>
              <h1 className="mt-2 text-3xl font-black md:text-5xl">
                Find trade work fast
              </h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                Browse open jobs, review pay, check the company, and apply when
                the work fits.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/post-job"
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-center text-sm font-black text-slate-950 hover:bg-cyan-300"
              >
                Post Job
              </Link>

              <button
                onClick={loadJobs}
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/20"
              >
                Refresh
              </button>
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard label="Open Jobs" value={openJobsCount} />
          <StatCard label="Assigned Jobs" value={assignedJobsCount} />
          <StatCard label="Showing" value={filteredJobs.length} />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label className="text-sm font-bold text-slate-300">Trade</label>
              <select
                value={trade}
                onChange={(event) => setTrade(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
              >
                <option value="">All trades</option>
                {trades.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-bold text-slate-300">
                Location
              </label>
              <select
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
              >
                <option value="">All locations</option>
                {locations.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white">
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(event) => setOpenOnly(event.target.checked)}
                className="h-5 w-5 accent-cyan-400"
              />
              Open only
            </label>

            <button
              onClick={clearFilters}
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/20"
            >
              Clear Filters ({activeFilterCount})
            </button>
          </div>
        </section>

        <section className="space-y-4">
          {filteredJobs.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
              <h2 className="text-2xl font-black">No jobs found</h2>
              <p className="mt-2 text-slate-300">
                Try clearing filters or checking back after more jobs are posted.
              </p>
            </div>
          ) : (
            filteredJobs.map((job) => {
              const company = job.company_id
                ? companyMap.get(job.company_id)
                : null

              const companyName =
                company?.company_name || company?.full_name || 'Company'

              return (
                <article
                  key={job.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl"
                >
                  <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-cyan-200">
                          {job.trade || 'Trade not listed'}
                        </span>

                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-200">
                          {job.status || 'open'}
                        </span>

                        {company?.company_verified && (
                          <span className="rounded-full bg-green-400/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-green-200">
                            Verified Company
                          </span>
                        )}
                      </div>

                      <h2 className="mt-4 text-2xl font-black">
                        {job.title || 'Untitled Job'}
                      </h2>

                      <p className="mt-2 text-sm font-bold text-cyan-200">
                        {companyName}
                      </p>

                      <p className="mt-3 line-clamp-3 text-slate-300">
                        {job.description || 'No description provided.'}
                      </p>

                      <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                        <Info label="Location" value={job.location || '-'} />
                        <Info label="Pay" value={job.pay_rate || '-'} />
                        <Info label="Start" value={formatDate(job.start_date)} />
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-3 md:w-44">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="rounded-2xl bg-cyan-400 px-5 py-3 text-center text-sm font-black text-slate-950 hover:bg-cyan-300"
                      >
                        View Job
                      </Link>

                      {job.company_id && (
                        <Link
                          href={`/companies/${job.company_id}`}
                          className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-black text-white hover:bg-white/20"
                        >
                          Company
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </section>
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-4xl font-black text-white">{value}</p>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  )
}