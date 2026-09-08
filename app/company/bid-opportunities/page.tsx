'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { resolveCompanyContext } from '@/lib/company-context'

type BidOpportunity = {
  id: string
  title: string | null
  description: string | null
  trade: string | null
  location: string | null
  company_id: string | null
  status: string | null
  bid_deadline: string | null
  work_deadline: string | null
  created_at: string | null
}

function formatDate(value: string | null, includeTime = false) {
  if (!value) return 'Not set'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Not set'

  if (includeTime) {
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function BidOpportunitiesPage() {
  const router = useRouter()
  const t = useTranslations('BidMarketplace')

  const [opportunities, setOpportunities] = useState<BidOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [trade, setTrade] = useState('')
  const [location, setLocation] = useState('')

  const loadOpportunities = useCallback(async () => {
    setLoading(true)
    setMessage('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace('/login')
        return
      }

      const context = await resolveCompanyContext(supabase, user.id)

      if (!context.companyId) {
        router.replace('/worker/dashboard')
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const accessToken = session?.access_token

      if (!accessToken) {
        router.replace('/login')
        return
      }

      const { data, error } = await supabase
        .from('jobs')
        .select(
          `
          id,
          title,
          description,
          trade,
          location,
          company_id,
          status,
          bid_deadline,
          work_deadline,
          created_at
        `
        )
        .eq('job_type', 'bid_request')
        .eq('status', 'open')
        .neq('company_id', context.companyId)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      const now = Date.now()

      const active = ((data ?? []) as BidOpportunity[]).filter((job) => {
        if (!job.bid_deadline) return true

        const deadline = new Date(job.bid_deadline).getTime()

        return Number.isNaN(deadline) || deadline > now
      })

      const bidsResponse = await fetch(
        '/api/job-bids?mine=1',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: 'no-store',
        }
      )

      if (!bidsResponse.ok) {
        const body = await bidsResponse.json().catch(() => null)
        throw new Error(
          body?.error || t('loadOpportunitiesError')
        )
      }

      const bidsBody = await bidsResponse.json()

      const bidJobIds = new Set<string>(
        Array.isArray(bidsBody?.bids)
          ? bidsBody.bids
              .map((bid: { job_id?: unknown }) =>
                typeof bid.job_id === 'string'
                  ? bid.job_id
                  : null
              )
              .filter(
                (jobId: string | null): jobId is string =>
                  Boolean(jobId)
              )
          : []
      )

      setOpportunities(
        active.filter((job) => !bidJobIds.has(job.id))
      )
    } catch (error) {
      setOpportunities([])
      setMessage(
        error instanceof Error
          ? error.message
          : t('loadOpportunitiesError')
      )
    } finally {
      setLoading(false)
    }
  }, [router, t])

  useEffect(() => {
    void loadOpportunities()
  }, [loadOpportunities])

  const trades = useMemo(() => {
    return Array.from(
      new Set(
        opportunities
          .map((job) => job.trade?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [opportunities])

  const filtered = useMemo(() => {
    const searchValue = search.trim().toLowerCase()
    const locationValue = location.trim().toLowerCase()

    return opportunities.filter((job) => {
      if (trade && job.trade !== trade) return false

      if (
        locationValue &&
        !String(job.location || '')
          .toLowerCase()
          .includes(locationValue)
      ) {
        return false
      }

      if (!searchValue) return true

      const haystack = [
        job.title,
        job.description,
        job.trade,
        job.location,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(searchValue)
    })
  }, [location, opportunities, search, trade])

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-2">
          <Link
            href="/company/bid-opportunities"
            className="rounded-xl bg-blue-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
          >
            {t('bidOpportunities')}
          </Link>

          <Link
            href="/company/my-bids"
            className="rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black text-slate-200 transition hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-white"
          >
            {t('myBids')}
          </Link>
        </div>

        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-400">
              {t('companyMarketplace')}
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              {t('bidOpportunities')}
            </h1>

            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-300 sm:text-base">
              {t('bidOpportunitiesDescription')}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/company/jobs"
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:border-blue-400/50"
            >
              My Jobs
            </Link>

            <Link
              href="/post-job"
              className="rounded-xl bg-blue-500 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-400"
            >
              Post Request
            </Link>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('searchProjects')}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
            />

            <select
              value={trade}
              onChange={(event) => setTrade(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-blue-500"
            >
              <option value="">{t('allTrades')}</option>

              {trades.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder={t('filterLocation')}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>
        </section>

        {message ? (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm font-bold text-slate-400">
            {t('loadingOpportunities')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <h2 className="text-xl font-black">
              {t('noOpenOpportunities')}
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-6 text-slate-400">
              {t('noOpenOpportunitiesHelp')}
            </p>

            <Link
              href="/company/my-bids"
              className="mt-5 inline-flex rounded-xl bg-blue-500 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-400"
            >
              {t('viewMyBids')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {filtered.map((job) => (
              <article
                key={job.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-300">
                      {t('requestBids')}
                    </span>

                    <h2 className="mt-3 text-xl font-black">
                      {job.title || t('untitledProject')}
                    </h2>

                    <p className="mt-1 text-sm font-bold text-slate-400">
                      {[job.trade, job.location]
                        .filter(Boolean)
                        .join(' • ') || t('projectDetails')}
                    </p>
                  </div>
                </div>

                <p className="mt-4 line-clamp-3 text-sm font-medium leading-6 text-slate-300">
                  {job.description || t('noDescription')}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Bids Close
                    </p>

                    <p className="mt-1 text-sm font-black text-white">
                      {formatDate(job.bid_deadline, true)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Work Due
                    </p>

                    <p className="mt-1 text-sm font-black text-white">
                      {formatDate(job.work_deadline)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-slate-500">
                    {t('posted')} {formatDate(job.created_at)}
                  </p>

                  <Link
                    href={`/jobs/${job.id}#bids`}
                    className="rounded-xl bg-blue-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
                  >
                    View &amp; Bid
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && opportunities.length > 0 ? (
          <div className="mt-6 flex items-center justify-between text-xs font-bold text-slate-500">
            <span>
              {t('opportunitiesCount', {
                filtered: filtered.length,
                total: opportunities.length,
              })}
            </span>

            <button
              type="button"
              onClick={() => void loadOpportunities()}
              className="rounded-lg border border-slate-800 px-3 py-2 text-slate-300 transition hover:border-blue-500 hover:text-white"
            >
              Refresh
            </button>
          </div>
        ) : null}
      </div>
    </main>
  )
}
