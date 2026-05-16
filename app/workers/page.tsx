'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CrewCard } from '@/app/components/CrewCard'
import { CrewButton } from '@/app/components/CrewButton'

type Worker = {
  id: string
  full_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  years_experience: string | null
  insurance_provider: string | null
  liability_form_signed: boolean | null
  reviews?: {
    rating: number | null
  }[]
}

function avgRating(worker: Worker) {
  const reviews = worker.reviews || []
  if (reviews.length === 0) return 0

  const total = reviews.reduce((sum, review) => {
    return sum + Number(review.rating || 0)
  }, 0)

  return total / reviews.length
}

function reviewCount(worker: Worker) {
  return worker.reviews?.length || 0
}

function stars(value: number) {
  const safe = Math.max(0, Math.min(5, Math.round(value)))
  return '★'.repeat(safe) + '☆'.repeat(5 - safe)
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [search, setSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('all')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'rating' | 'reviews' | 'name'>('rating')

  useEffect(() => {
    loadWorkers()
  }, [])

  async function loadWorkers() {
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase
      .from('profiles')
      .select(
        `
        id,
        full_name,
        trade,
        city,
        state,
        years_experience,
        insurance_provider,
        liability_form_signed,
        reviews:reviews!reviews_reviewee_id_fkey (
          rating
        )
      `
      )
      .eq('role', 'worker')
      .order('full_name', { ascending: true })

    if (error) {
      setMessage(error.message)
      setWorkers([])
    } else {
      setWorkers((data as Worker[]) || [])
    }

    setLoading(false)
  }

  const trades = useMemo(() => {
    const unique = Array.from(
      new Set(workers.map((worker) => worker.trade).filter(Boolean))
    ) as string[]

    return unique.sort()
  }, [workers])

  const filteredWorkers = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase()

    let results = [...workers]

    if (cleanSearch) {
      results = results.filter((worker) => {
        const haystack = [
          worker.full_name,
          worker.trade,
          worker.city,
          worker.state,
          worker.years_experience,
          worker.insurance_provider,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return haystack.includes(cleanSearch)
      })
    }

    if (tradeFilter !== 'all') {
      results = results.filter((worker) => worker.trade === tradeFilter)
    }

    if (verifiedOnly) {
      results = results.filter((worker) => worker.liability_form_signed)
    }

    results.sort((a, b) => {
      if (sortBy === 'rating') {
        return avgRating(b) - avgRating(a)
      }

      if (sortBy === 'reviews') {
        return reviewCount(b) - reviewCount(a)
      }

      return (a.full_name || '').localeCompare(b.full_name || '')
    })

    return results
  }, [workers, search, tradeFilter, verifiedOnly, sortBy])

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-100 px-6 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-xl">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-600">
            CrewCall Marketplace
          </p>

          <h1 className="mt-3 text-4xl font-black text-slate-950 sm:text-5xl">
            Find Workers
          </h1>

          <p className="mt-3 max-w-3xl text-lg text-slate-600">
            Search trusted tradespeople, compare ratings, verify compliance,
            and invite workers to your jobs.
          </p>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-xl">
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, trade, city, insurance..."
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
            />

            <select
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="all">All trades</option>
              {trades.map((trade) => (
                <option key={trade} value={trade}>
                  {trade}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'rating' | 'reviews' | 'name')
              }
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="rating">Sort by rating</option>
              <option value="reviews">Sort by review count</option>
              <option value="name">Sort by name</option>
            </select>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="h-5 w-5"
              />
              Verified only
            </label>
          </div>
        </section>

        {message && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {message}
          </div>
        )}

        {loading ? (
          <CrewCard>
            <p className="text-gray-600">Loading workers...</p>
          </CrewCard>
        ) : filteredWorkers.length === 0 ? (
          <CrewCard>
            <p className="text-gray-600">No workers found.</p>
          </CrewCard>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredWorkers.map((worker) => {
              const average = avgRating(worker)
              const count = reviewCount(worker)

              return (
                <CrewCard key={worker.id} className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-xl font-black text-white">
                        {(worker.full_name || 'W').charAt(0).toUpperCase()}
                      </div>

                      <h2 className="text-2xl font-black text-slate-950">
                        {worker.full_name || 'Unnamed Worker'}
                      </h2>

                      <p className="mt-1 text-sm font-black uppercase tracking-wide text-blue-600">
                        {worker.trade || 'No trade listed'}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {[worker.city, worker.state].filter(Boolean).join(', ') ||
                          'Location not listed'}
                      </p>
                    </div>

                    {worker.liability_form_signed && (
                      <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black uppercase text-orange-700">
                        Verified
                      </span>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                      Reputation
                    </p>

                    <p className="mt-2 text-lg font-black text-yellow-500">
                      {stars(average)}
                    </p>

                    <p className="text-sm font-semibold text-slate-600">
                      {average.toFixed(1)} ({count}{' '}
                      {count === 1 ? 'review' : 'reviews'})
                    </p>
                  </div>

                  <div className="grid gap-3 text-sm">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Experience
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        {worker.years_experience || 'Not listed'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Insurance
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        {worker.insurance_provider || 'Not listed'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <CrewButton href={`/profile?user=${worker.id}`}>
                      View Profile
                    </CrewButton>

                    <CrewButton
                      href={`/workers/${worker.id}/invite`}
                      variant="ghost"
                    >
                      Invite
                    </CrewButton>
                  </div>
                </CrewCard>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}