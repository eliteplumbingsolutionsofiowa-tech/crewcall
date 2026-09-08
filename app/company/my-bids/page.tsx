'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { resolveCompanyContext } from '@/lib/company-context'

type BidStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn'

type BidRecord = {
  id: string
  job_id: string
  amount_cents: number
  availability: string | null
  estimated_duration: string | null
  note: string | null
  status: BidStatus
  created_at: string
  updated_at: string
}

type BidJob = {
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

type MyBidItem = {
  job: BidJob
  bid: BidRecord
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100)
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

function statusClass(status: BidStatus) {
  switch (status) {
    case 'accepted':
      return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
    case 'declined':
      return 'border-red-400/30 bg-red-500/10 text-red-300'
    case 'withdrawn':
      return 'border-slate-500/30 bg-slate-500/10 text-slate-300'
    default:
      return 'border-amber-400/30 bg-amber-500/10 text-amber-300'
  }
}

export default function MyBidsPage() {
  const router = useRouter()
  const t = useTranslations('BidMarketplace')

  const [items, setItems] = useState<MyBidItem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'all' | BidStatus>('all')

  const loadMyBids = useCallback(async () => {
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
        .neq('company_id', context.companyId)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      const jobs = (data ?? []) as BidJob[]

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
          body?.error || t('loadMyBidsError')
        )
      }

      const bidsBody = await bidsResponse.json()

      const myBids = Array.isArray(bidsBody?.bids)
        ? (bidsBody.bids as BidRecord[])
        : []

      const bidByJobId = new Map(
        myBids.map((bid) => [bid.job_id, bid])
      )

      setItems(
        jobs.flatMap((job) => {
          const bid = bidByJobId.get(job.id)

          if (!bid) return []

          return [
            {
              job,
              bid,
            } satisfies MyBidItem,
          ]
        })
      )
    } catch (error) {
      setItems([])
      setMessage(
        error instanceof Error
          ? error.message
          : t('loadMyBidsError')
      )
    } finally {
      setLoading(false)
    }
  }, [router, t])

  useEffect(() => {
    void loadMyBids()
  }, [loadMyBids])

  const filtered = useMemo(() => {
    if (status === 'all') return items

    return items.filter((item) => item.bid.status === status)
  }, [items, status])

  const counts = useMemo(() => {
    return {
      all: items.length,
      pending: items.filter((item) => item.bid.status === 'pending').length,
      accepted: items.filter((item) => item.bid.status === 'accepted').length,
      declined: items.filter((item) => item.bid.status === 'declined').length,
      withdrawn: items.filter((item) => item.bid.status === 'withdrawn').length,
    }
  }, [items])

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-2">
          <Link
            href="/company/bid-opportunities"
            className="rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black text-slate-200 transition hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-white"
          >
            {t('bidOpportunities')}
          </Link>

          <Link
            href="/company/my-bids"
            className="rounded-xl bg-blue-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
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
              {t('myBids')}
            </h1>

            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-300 sm:text-base">
              {t('myBidsDescription')}
            </p>
          </div>

          <Link
            href="/company/bid-opportunities"
            className="inline-flex rounded-xl bg-blue-500 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-400"
          >
            {t('findBidOpportunities')}
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {(
            [
              ['all', t('all')],
              ['pending', t('pending')],
              ['accepted', t('accepted')],
              ['declined', t('declined')],
              ['withdrawn', t('withdrawn')],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={
                status === value
                  ? 'rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-black text-white'
                  : 'rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-black text-slate-300 transition hover:border-blue-400/40 hover:text-white'
              }
            >
              {label} ({counts[value]})
            </button>
          ))}
        </div>

        {message ? (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm font-bold text-slate-400">
            {t('loadingMyBids')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <h2 className="text-xl font-black">
              {status === 'all'
                ? t('noBidsYet')
                : t('noStatusBids', {
                    status:
                      status === 'pending'
                        ? t('pending').toLowerCase()
                        : status === 'accepted'
                          ? t('accepted').toLowerCase()
                          : status === 'declined'
                            ? t('declined').toLowerCase()
                            : t('withdrawn').toLowerCase(),
                  })}
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-6 text-slate-400">
              {t('noBidsHelp')}
            </p>

            <Link
              href="/company/bid-opportunities"
              className="mt-5 inline-flex rounded-xl bg-blue-500 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-400"
            >
              {t('browseBidOpportunities')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {filtered.map(({ job, bid }) => (
              <article
                key={bid.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${statusClass(
                        bid.status
                      )}`}
                    >
                      {bid.status}
                    </span>

                    <h2 className="mt-3 text-xl font-black text-white">
                      {job.title || t('untitledProject')}
                    </h2>

                    <p className="mt-1 text-sm font-bold text-slate-400">
                      {[job.trade, job.location]
                        .filter(Boolean)
                        .join(' • ') || t('projectDetails')}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Your Bid
                    </p>

                    <p className="mt-1 text-2xl font-black text-white">
                      {formatMoney(bid.amount_cents)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Availability
                    </p>

                    <p className="mt-1 text-sm font-black text-white">
                      {bid.availability || t('notProvided')}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Estimated Duration
                    </p>

                    <p className="mt-1 text-sm font-black text-white">
                      {bid.estimated_duration || t('notProvided')}
                    </p>
                  </div>
                </div>

                {bid.note ? (
                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Bid Note
                    </p>

                    <p className="mt-1 text-sm font-medium leading-6 text-slate-300">
                      {bid.note}
                    </p>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-bold text-slate-500">
                    <div>
                      {t('bidsClose')} {formatDate(job.bid_deadline, true)}
                    </div>
                    <div>
                      {t('workDue')} {formatDate(job.work_deadline)}
                    </div>
                  </div>

                  <Link
                    href={`/jobs/${job.id}#bids`}
                    className="rounded-xl bg-blue-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
                  >
                    {bid.status === 'accepted'
                      ? t('viewProject')
                      : t('viewBid')}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
