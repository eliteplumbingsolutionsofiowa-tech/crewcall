'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type UserRole = 'worker' | 'company' | null

type CurrentProfile = {
  id: string
  role: UserRole
}

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

type NoticeTone = 'error' | 'success' | 'info'

type QueryError = {
  message: string
}

type ProfileResult = {
  data: CurrentProfile | null
  error: QueryError | null
}

type JobResult = {
  data: Job[] | null
  error: QueryError | null
}

type CompanyResult = {
  data: CompanyProfile[] | null
  error: QueryError | null
}

function normalize(value: string | null | undefined) {
  return String(value || '').toLowerCase().trim()
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Start date not set'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'Start date not set'
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatPostedDate(value: string | null) {
  if (!value) {
    return 'Recently posted'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'Recently posted'
  }

  const now = new Date()
  const difference = now.getTime() - parsed.getTime()
  const minutes = Math.floor(difference / 60000)
  const hours = Math.floor(difference / 3600000)
  const days = Math.floor(difference / 86400000)

  if (minutes < 1) {
    return 'Posted just now'
  }

  if (minutes < 60) {
    return `Posted ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  }

  if (hours < 24) {
    return `Posted ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  }

  if (days < 7) {
    return `Posted ${days} ${days === 1 ? 'day' : 'days'} ago`
  }

  return `Posted ${parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`
}

function cleanStatus(value: string | null) {
  const cleaned = normalize(value || 'open')

  return cleaned
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default function JobsPage() {
  const [currentProfile, setCurrentProfile] =
    useState<CurrentProfile | null>(null)

  const [jobs, setJobs] = useState<Job[]>([])
  const [companyMap, setCompanyMap] = useState<Map<string, CompanyProfile>>(
    new Map()
  )

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] =
    useState<NoticeTone>('info')

  const [search, setSearch] = useState('')
  const [trade, setTrade] = useState('')
  const [location, setLocation] = useState('')
  const [openOnly, setOpenOnly] = useState(true)
  const [verifiedOnly, setVerifiedOnly] = useState(false)

  useEffect(() => {
    void loadPage()
  }, [])

  async function loadPage(showRefreshState = false) {
    if (showRefreshState) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setMessage('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (user) {
        const profileResponse = (await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', user.id)
          .maybeSingle()) as unknown as ProfileResult

        if (profileResponse.error) {
          throw profileResponse.error
        }

        setCurrentProfile(
          profileResponse.data || {
            id: user.id,
            role: null,
          }
        )
      } else {
        setCurrentProfile(null)
      }

      const jobsResponse = (await supabase
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
        .eq('status','open')
        .is('assigned_worker_id', null)
        .order('created_at', {
          ascending: false,
        })) as unknown as JobResult

      if (jobsResponse.error) {
        throw jobsResponse.error
      }

      const rawJobs = jobsResponse.data || []

      const companyIds = Array.from(
        new Set(
          rawJobs
            .map((job) => job.company_id)
            .filter((id): id is string => Boolean(id))
        )
      )

      let nextCompanyMap = new Map<string, CompanyProfile>()

      if (companyIds.length > 0) {
        const companiesResponse = (await supabase
          .from('profiles')
          .select(
            'id, full_name, company_name, company_verified'
          )
          .in('id', companyIds)) as unknown as CompanyResult

        if (companiesResponse.error) {
          throw companiesResponse.error
        }

        nextCompanyMap = new Map(
          (companiesResponse.data || []).map((company) => [
            company.id,
            company,
          ])
        )
      }

      setJobs(rawJobs)
      setCompanyMap(nextCompanyMap)

      if (showRefreshState) {
        setMessage('Job listings refreshed.')
        setMessageTone('success')
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to load jobs.'

      setMessage(errorMessage)
      setMessageTone('error')
      setJobs([])
      setCompanyMap(new Map())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

const trades = useMemo(
  () => [
    'Plumbing',
    'Electrical',
    'HVAC',
    'Framing',
    'Concrete',
    'Drywall',
    'Roofing',
    'Painting',
    'Flooring',
    'General Labor',
  ],
  []
)

  const locations = useMemo(() => {
    return Array.from(
      new Set(
        jobs
          .map((job) => job.location?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [jobs])

  const filteredJobs = useMemo(() => {
    const searchValue = normalize(search)

    return jobs.filter((job) => {
      const company = job.company_id
        ? companyMap.get(job.company_id)
        : null

      const companyName =
        company?.company_name ||
        company?.full_name ||
        ''

      const searchableText = [
        job.title,
        job.description,
        job.trade,
        job.location,
        job.pay_rate,
        companyName,
      ]
        .map((value) => normalize(value))
        .join(' ')

      const matchesSearch = searchValue
        ? searchableText.includes(searchValue)
        : true

      const matchesTrade = trade
        ? normalize(job.trade) === normalize(trade)
        : true

      const matchesLocation = location
        ? normalize(job.location) === normalize(location)
        : true

      const matchesOpen = openOnly
        ? normalize(job.status) === 'open' &&
          !job.assigned_worker_id
        : true

      const matchesVerified = verifiedOnly
        ? Boolean(company?.company_verified)
        : true

      return (
        matchesSearch &&
        matchesTrade &&
        matchesLocation &&
        matchesOpen &&
        matchesVerified
      )
    })
  }, [
    jobs,
    companyMap,
    search,
    trade,
    location,
    openOnly,
    verifiedOnly,
  ])

  const openJobsCount = useMemo(() => {
    return jobs.filter(
      (job) =>
        normalize(job.status) === 'open' &&
        !job.assigned_worker_id
    ).length
  }, [jobs])

  const assignedJobsCount = useMemo(() => {
    return jobs.filter((job) =>
      Boolean(job.assigned_worker_id)
    ).length
  }, [jobs])

  const verifiedJobsCount = useMemo(() => {
    return jobs.filter((job) => {
      if (!job.company_id) {
        return false
      }

      return Boolean(
        companyMap.get(job.company_id)?.company_verified
      )
    }).length
  }, [jobs, companyMap])

  const activeFilterCount =
    Number(Boolean(search.trim())) +
    Number(Boolean(trade)) +
    Number(Boolean(location)) +
    Number(openOnly) +
    Number(verifiedOnly)

  const canPostJob = currentProfile?.role === 'company'
  const isWorker = currentProfile?.role === 'worker'

  function clearFilters() {
    setSearch('')
    setTrade('')
    setLocation('')
    setOpenOnly(true)
    setVerifiedOnly(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-4">
                <div className="relative flex h-12 w-12 items-center justify-center">
                  <span className="absolute h-full w-full animate-ping rounded-2xl bg-cyan-400/20" />
                  <span className="relative h-12 w-12 animate-pulse rounded-2xl bg-cyan-400/15" />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                    CrewCall Marketplace
                  </p>

                  <p className="mt-1 text-lg font-bold text-white">
                    Loading available jobs...
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-32 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]"
                  />
                ))}
              </div>

              <div className="mt-6 h-44 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />

              <div className="mt-6 space-y-4">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-56 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8 lg:px-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-48 top-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute -right-48 top-56 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-violet-500/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

          <div className="p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col justify-between gap-7 xl:flex-row xl:items-center">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    CrewCall Marketplace
                  </span>

                  {isWorker ? (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
                      Worker View
                    </span>
                  ) : null}
                </div>

                <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Find trade work fast
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Search open jobs, compare pay, review hiring companies,
                  and apply when the opportunity fits your trade and
                  schedule.
                </p>
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:min-w-[340px]">
                {canPostJob ? (
                  <Link
                    href="/post-job"
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-center text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-300"
                  >
                    Post a Job
                  </Link>
                ) : (
                  <Link
                    href="/worker/dashboard"
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-center text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-300"
                  >
                    Worker Dashboard
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => void loadPage(true)}
                  disabled={refreshing}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.065] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/[0.11] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshing ? 'Refreshing...' : 'Refresh Jobs'}
                </button>
              </div>
            </div>

            {message ? (
              <Notice tone={messageTone}>{message}</Notice>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MarketplaceStat
            label="Open Jobs"
            value={openJobsCount}
            description="Available now"
            tone="cyan"
            icon="O"
          />

          <MarketplaceStat
            label="Verified Listings"
            value={verifiedJobsCount}
            description="Verified companies"
            tone="green"
            icon="V"
          />

          <MarketplaceStat
            label="Assigned Jobs"
            value={assignedJobsCount}
            description="Already matched"
            tone="blue"
            icon="A"
          />

          <MarketplaceStat
            label="Showing"
            value={filteredJobs.length}
            description="Current results"
            tone="violet"
            icon="S"
          />
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-xl shadow-black/20 backdrop-blur-xl">
          <div className="border-b border-white/10 p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                  Search and Filters
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  Find the right opportunity
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Search by job title, trade, company, location, or pay.
                </p>
              </div>

              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.065] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.11]"
              >
                Clear Filters ({activeFilterCount})
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <label
                  htmlFor="job-search"
                  className="text-xs font-black uppercase tracking-[0.16em] text-slate-400"
                >
                  Search Jobs
                </label>

                <div className="relative mt-2">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg text-slate-500">
                    ⌕
                  </span>

                  <input
                    id="job-search"
                    type="search"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Plumber, HVAC, Des Moines, $40/hr..."
                    className="min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/80 py-3 pl-11 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/5"
                  />
                </div>
              </div>

              <div className="lg:col-span-3">
                <label
                  htmlFor="trade-filter"
                  className="text-xs font-black uppercase tracking-[0.16em] text-slate-400"
                >
                  Trade
                </label>

                <select
                  id="trade-filter"
                  value={trade}
                  onChange={(event) =>
                    setTrade(event.target.value)
                  }
                  className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/5"
                >
                  <option value="">All trades</option>

                  {trades.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-4">
                <label
                  htmlFor="location-filter"
                  className="text-xs font-black uppercase tracking-[0.16em] text-slate-400"
                >
                  Location
                </label>

                <select
                  id="location-filter"
                  value={location}
                  onChange={(event) =>
                    setLocation(event.target.value)
                  }
                  className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/5"
                >
                  <option value="">All locations</option>

                  {locations.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <FilterToggle
                checked={openOnly}
                onChange={setOpenOnly}
                label="Open jobs only"
                description="Hide assigned and closed work"
              />

              <FilterToggle
                checked={verifiedOnly}
                onChange={setVerifiedOnly}
                label="Verified companies only"
                description="Show verified hiring companies"
              />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                Available Work
              </p>

              <h2 className="mt-2 text-2xl font-black text-white">
                {filteredJobs.length}{' '}
                {filteredJobs.length === 1
                  ? 'job found'
                  : 'jobs found'}
              </h2>
            </div>

            {search || trade || location || verifiedOnly ? (
              <p className="text-sm text-slate-400">
                Results are filtered based on your selections.
              </p>
            ) : (
              <p className="text-sm text-slate-400">
                Newest listings appear first.
              </p>
            )}
          </div>

          {filteredJobs.length === 0 ? (
            <EmptyJobs onClear={clearFilters} />
          ) : (
            <div className="space-y-4">
              {filteredJobs.map((job) => {
                const company = job.company_id
                  ? companyMap.get(job.company_id)
                  : null

                const companyName =
                  company?.company_name ||
                  company?.full_name ||
                  'CrewCall Company'

                const isOpen =
                  normalize(job.status) === 'open' &&
                  !job.assigned_worker_id

                return (
                  <JobCard
                    key={job.id}
                    job={job}
                    company={company}
                    companyName={companyName}
                    isOpen={isOpen}
                    isWorker={isWorker}
                  />
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function JobCard({
  job,
  company,
  companyName,
  isOpen,
  isWorker,
}: {
  job: Job
  company: CompanyProfile | null | undefined
  companyName: string
  isOpen: boolean
  isWorker: boolean
}) {
  const initial = companyName.charAt(0).toUpperCase() || 'C'

  return (
    <article className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] shadow-xl shadow-black/15 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-400/20 hover:bg-white/[0.06]">
      <div
        className={
          isOpen
            ? 'h-1 bg-cyan-400'
            : 'h-1 bg-slate-600'
        }
      />

      <div className="p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={cleanStatus(job.status)}
                tone={isOpen ? 'cyan' : 'slate'}
              />

              <StatusBadge
                label={job.trade || 'Trade not listed'}
                tone="violet"
              />

              {company?.company_verified ? (
                <StatusBadge
                  label="Verified Company"
                  tone="green"
                />
              ) : null}
            </div>

            <div className="mt-5 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/20 to-blue-500/10 text-xl font-black text-cyan-300">
                {initial}
              </div>

              <div className="min-w-0">
                <h3 className="text-2xl font-black leading-tight text-white transition group-hover:text-cyan-200 sm:text-3xl">
                  {job.title || 'Untitled Job'}
                </h3>

                <p className="mt-1 text-sm font-black text-cyan-300">
                  {companyName}
                </p>

                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {formatPostedDate(job.created_at)}
                </p>
              </div>
            </div>

            <p className="mt-5 line-clamp-3 max-w-4xl text-sm leading-7 text-slate-300 sm:text-base">
              {job.description || 'No description provided.'}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <JobInfo
                label="Location"
                value={job.location || 'Not provided'}
                icon="L"
              />

              <JobInfo
                label="Start Date"
                value={formatDate(job.start_date)}
                icon="D"
              />

              <JobInfo
                label="Payment Status"
                value={cleanStatus(
                  job.payment_status || 'unpaid'
                )}
                icon="$"
              />
            </div>
          </div>

          <div className="shrink-0 xl:w-64">
            <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-5 text-center xl:text-left">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                Posted Pay
              </p>

              <p className="mt-2 break-words text-3xl font-black tracking-tight text-white">
                {job.pay_rate || 'Not listed'}
              </p>

              <p className="mt-2 text-xs font-semibold text-cyan-200/60">
                Confirm final terms with the company.
              </p>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Link
                href={`/jobs/${job.id}`}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-center text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-300"
              >
                {isWorker && isOpen
                  ? 'View and Apply'
                  : 'View Job'}
              </Link>

              {job.company_id ? (
                <Link
                  href={`/companies/${job.company_id}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.065] px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white/[0.11]"
                >
                  View Company
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function MarketplaceStat({
  label,
  value,
  description,
  tone,
  icon,
}: {
  label: string
  value: number
  description: string
  tone: 'cyan' | 'green' | 'blue' | 'violet'
  icon: string
}) {
  const styles = {
    cyan: {
      border: 'border-cyan-400/20',
      background: 'bg-cyan-500/10',
      text: 'text-cyan-300',
    },
    green: {
      border: 'border-emerald-400/20',
      background: 'bg-emerald-500/10',
      text: 'text-emerald-300',
    },
    blue: {
      border: 'border-blue-400/20',
      background: 'bg-blue-500/10',
      text: 'text-blue-300',
    },
    violet: {
      border: 'border-violet-400/20',
      background: 'bg-violet-500/10',
      text: 'text-violet-300',
    },
  }

  const selected = styles[tone]

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/15 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>

          <p className="mt-3 text-4xl font-black tracking-tight text-white">
            {value}
          </p>

          <p className="mt-2 text-sm text-slate-500">
            {description}
          </p>
        </div>

        <span
          className={[
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-lg font-black',
            selected.border,
            selected.background,
            selected.text,
          ].join(' ')}
        >
          {icon}
        </span>
      </div>
    </div>
  )
}

function FilterToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description: string
}) {
  return (
    <label
      className={[
        'flex cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4 transition',
        checked
          ? 'border-cyan-400/25 bg-cyan-500/10'
          : 'border-white/10 bg-slate-950/50 hover:bg-slate-950/70',
      ].join(' ')}
    >
      <div>
        <p className="text-sm font-black text-white">{label}</p>
        <p className="mt-1 text-xs text-slate-500">
          {description}
        </p>
      </div>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(event.target.checked)
        }
        className="h-5 w-5 shrink-0 accent-cyan-400"
      />
    </label>
  )
}

function JobInfo({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.055] text-xs font-black text-cyan-300">
        {icon}
      </span>

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>

        <p className="mt-1 break-words text-sm font-bold leading-5 text-white">
          {value}
        </p>
      </div>
    </div>
  )
}

function StatusBadge({
  label,
  tone,
}: {
  label: string
  tone: 'cyan' | 'green' | 'violet' | 'slate'
}) {
  const classes = {
    cyan:
      'border-cyan-400/20 bg-cyan-500/10 text-cyan-300',
    green:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
    violet:
      'border-violet-400/20 bg-violet-500/10 text-violet-300',
    slate:
      'border-white/10 bg-white/[0.055] text-slate-300',
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wider',
        classes[tone],
      ].join(' ')}
    >
      <span
        className={[
          'h-2 w-2 rounded-full',
          tone === 'cyan'
            ? 'bg-cyan-400'
            : tone === 'green'
              ? 'bg-emerald-400'
              : tone === 'violet'
                ? 'bg-violet-400'
                : 'bg-slate-400',
        ].join(' ')}
      />

      {label}
    </span>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: NoticeTone
  children: React.ReactNode
}) {
  const classes = {
    error:
      'border-red-400/20 bg-red-500/10 text-red-200',
    success:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    info:
      'border-blue-400/20 bg-blue-500/10 text-blue-200',
  }

  return (
    <div
      className={[
        'mt-6 rounded-2xl border p-4 text-sm font-bold',
        classes[tone],
      ].join(' ')}
    >
      {children}
    </div>
  )
}

function EmptyJobs({
  onClear,
}: {
  onClear: () => void
}) {
  return (
    <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.035] px-6 py-14 text-center shadow-xl shadow-black/10">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/20 bg-cyan-500/10 text-2xl font-black text-cyan-300">
        J
      </div>

      <h3 className="mt-6 text-2xl font-black text-white">
        No jobs match these filters
      </h3>

      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
        Clear the current filters or refresh the marketplace to
        check for newly posted opportunities.
      </p>

      <button
        type="button"
        onClick={onClear}
        className="mt-7 inline-flex min-h-12 items-center justify-center rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-300"
      >
        Clear All Filters
      </button>
    </div>
  )
}
