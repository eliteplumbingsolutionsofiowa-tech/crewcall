'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: 'company' | 'worker' | null
  full_name: string | null
  company_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  phone: string | null
  years_experience: string | null
  insurance_provider: string | null
  job_experience: string | null
  liability_form_signed: boolean | null
  is_online: boolean | null
  last_seen: string | null
}

type SavedWorker = {
  id: string
  company_id: string
  worker_id: string
  created_at: string
  worker: Profile | Profile[] | null
}

type CleanSavedWorker = {
  id: string
  company_id: string
  worker_id: string
  created_at: string
  worker: Profile | null
}

type ProfileFile = {
  id: string
  user_id: string
  category: string | null
  file_url: string | null
  created_at: string
}

function firstOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value
}

export default function SavedWorkersPage() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [savedWorkers, setSavedWorkers] = useState<CleanSavedWorker[]>([])
  const [profileFiles, setProfileFiles] = useState<ProfileFile[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const [insuredOnly, setInsuredOnly] = useState(false)
  const [onlineOnly, setOnlineOnly] = useState(false)

  const loadSavedWorkers = useCallback(async () => {
    setLoading(true)
    setMessage('')
    setSuccessMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in as a company to view saved workers.')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(
        `
        id,
        role,
        full_name,
        company_name,
        trade,
        city,
        state,
        phone,
        years_experience,
        insurance_provider,
        job_experience,
        liability_form_signed,
        is_online,
        last_seen
      `
      )
      .eq('id', user.id)
      .maybeSingle<Profile>()

    if (profileError) {
      setMessage(profileError.message)
      setLoading(false)
      return
    }

    const profile = profileData || null
    setCurrentUser(profile)

    if (profile?.role !== 'company') {
      setMessage('Only company accounts can view saved workers.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('saved_workers')
      .select(
        `
        id,
        company_id,
        worker_id,
        created_at,
        worker:profiles!saved_workers_worker_id_fkey (
          id,
          role,
          full_name,
          company_name,
          trade,
          city,
          state,
          phone,
          years_experience,
          insurance_provider,
          job_experience,
          liability_form_signed,
          is_online,
          last_seen
        )
      `
      )
      .eq('company_id', user.id)
      .order('created_at', { ascending: false })
      .returns<SavedWorker[]>()

    if (error) {
      setMessage(error.message)
      setSavedWorkers([])
      setLoading(false)
      return
    }

    const safeSavedWorkers: CleanSavedWorker[] = (data ?? []).map((item) => ({
      id: item.id,
      company_id: item.company_id,
      worker_id: item.worker_id,
      created_at: item.created_at,
      worker: firstOrNull(item.worker),
    }))

    setSavedWorkers(safeSavedWorkers)

    const workerIds = safeSavedWorkers
      .map((item) => item.worker_id)
      .filter((workerId): workerId is string => Boolean(workerId))

    if (workerIds.length > 0) {
      const { data: files } = await supabase
        .from('profile_files')
        .select('id, user_id, category, file_url, created_at')
        .in('user_id', workerIds)
        .eq('category', 'profile_photo')
        .order('created_at', { ascending: false })
        .returns<ProfileFile[]>()

      setProfileFiles(files ?? [])
    } else {
      setProfileFiles([])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void loadSavedWorkers()
  }, [loadSavedWorkers])

  const photoByUserId = useMemo(() => {
    const map = new Map<string, string>()

    for (const file of profileFiles) {
      if (
        file.user_id &&
        file.category === 'profile_photo' &&
        file.file_url &&
        !map.has(file.user_id)
      ) {
        map.set(file.user_id, file.file_url)
      }
    }

    return map
  }, [profileFiles])

  const trades = useMemo(() => {
    return Array.from(
      new Set(
        savedWorkers
          .map((item) => item.worker?.trade)
          .filter((trade): trade is string => Boolean(trade))
      )
    ).sort()
  }, [savedWorkers])

  const states = useMemo(() => {
    return Array.from(
      new Set(
        savedWorkers
          .map((item) => item.worker?.state)
          .filter((state): state is string => Boolean(state))
      )
    ).sort()
  }, [savedWorkers])

  const filteredWorkers = useMemo(() => {
    const term = search.trim().toLowerCase()

    return savedWorkers.filter((item) => {
      const worker = item.worker
      if (!worker) return false

      const workerName = getWorkerName(worker)
      const searchable = [
        workerName,
        worker.trade,
        worker.city,
        worker.state,
        worker.phone,
        worker.years_experience,
        worker.insurance_provider,
        worker.job_experience,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !term || searchable.includes(term)
      const matchesTrade = tradeFilter === 'all' || worker.trade === tradeFilter
      const matchesState = stateFilter === 'all' || worker.state === stateFilter
      const matchesInsured = !insuredOnly || Boolean(worker.insurance_provider)
      const matchesOnline = !onlineOnly || isActuallyOnline(worker)

      return (
        matchesSearch &&
        matchesTrade &&
        matchesState &&
        matchesInsured &&
        matchesOnline
      )
    })
  }, [savedWorkers, search, tradeFilter, stateFilter, insuredOnly, onlineOnly])

  async function removeSavedWorker(item: CleanSavedWorker) {
    const workerName = item.worker ? getWorkerName(item.worker) : 'worker'
    const confirmed = window.confirm(`Remove ${workerName} from saved workers?`)

    if (!confirmed) return

    setRemovingId(item.id)
    setMessage('')
    setSuccessMessage('')

    const { error } = await supabase
      .from('saved_workers')
      .delete()
      .match({
        id: item.id,
        company_id: item.company_id,
      })

    if (error) {
      setMessage(error.message)
      setRemovingId(null)
      return
    }

    setSavedWorkers((current) =>
      current.filter((savedWorker) => savedWorker.id !== item.id)
    )

    setSuccessMessage(`${workerName} removed from saved workers.`)
    setRemovingId(null)
  }

  function resetFilters() {
    setSearch('')
    setTradeFilter('all')
    setStateFilter('all')
    setInsuredOnly(false)
    setOnlineOnly(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-300">
              Loading
            </p>

            <h1 className="mt-3 text-3xl font-black">Saved workers...</h1>

            <p className="mt-2 text-sm font-semibold text-slate-300">
              Pulling your saved tradespeople and profile details.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-56 animate-pulse rounded-[2rem] border border-white/10 bg-white/10"
              />
            ))}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-gradient-to-r from-orange-500/15 via-blue-500/10 to-cyan-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-300">
                  CrewCall Favorites
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Saved Workers
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Keep your best workers close, message them fast, and invite
                  them back to future jobs.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/find-workers"
                    className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-100"
                  >
                    Find More Workers
                  </Link>

                  <Link
                    href="/post-job"
                    className="rounded-2xl border border-orange-400/40 bg-orange-500/15 px-5 py-3 text-sm font-black text-orange-100 transition hover:bg-orange-500/25"
                  >
                    Post Job
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Saved" value={savedWorkers.length} />
                <StatCard label="Showing" value={filteredWorkers.length} />
                <StatCard
                  label="Online"
                  value={
                    savedWorkers.filter((item) =>
                      isActuallyOnline(item.worker)
                    ).length
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5 md:p-8">
            {message && (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100">
                {message}
              </div>
            )}

            {successMessage && (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-4 text-sm font-bold text-emerald-100">
                {successMessage}
              </div>
            )}

            {currentUser?.role === 'company' && (
              <div className="sticky top-3 z-10 rounded-3xl border border-white/10 bg-slate-950/90 p-5 shadow-2xl shadow-black/30 backdrop-blur">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="flex-1">
                    <label className="text-xs font-black uppercase tracking-wide text-slate-400">
                      Search saved workers
                    </label>

                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search name, trade, city, phone, insurance, experience..."
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-orange-300/50"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                  >
                    Clear Filters
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <select
                    value={tradeFilter}
                    onChange={(event) => setTradeFilter(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none focus:border-orange-300/50"
                  >
                    <option value="all">All Trades</option>
                    {trades.map((trade) => (
                      <option key={trade} value={trade}>
                        {trade}
                      </option>
                    ))}
                  </select>

                  <select
                    value={stateFilter}
                    onChange={(event) => setStateFilter(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none focus:border-orange-300/50"
                  >
                    <option value="all">All States</option>
                    {states.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>

                  <FilterToggle
                    active={insuredOnly}
                    onClick={() => setInsuredOnly((prev) => !prev)}
                    label={insuredOnly ? 'Insured: On' : 'Insured'}
                    activeClass="bg-emerald-400 text-slate-950"
                  />

                  <FilterToggle
                    active={onlineOnly}
                    onClick={() => setOnlineOnly((prev) => !prev)}
                    label={onlineOnly ? 'Online: On' : 'Online'}
                    activeClass="bg-lime-400 text-slate-950"
                  />
                </div>
              </div>
            )}

            {currentUser?.role !== 'company' ? (
              <div className="rounded-3xl border border-orange-400/30 bg-orange-400/10 p-8 text-center">
                <p className="text-xl font-black text-white">
                  Company account required.
                </p>

                <p className="mt-2 text-sm font-semibold text-orange-100">
                  Saved workers are only available for company accounts.
                </p>
              </div>
            ) : savedWorkers.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-8 text-center">
                <p className="text-xl font-black text-white">
                  No saved workers yet.
                </p>

                <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-slate-400">
                  Go to Find Workers and tap Save on workers you want to keep
                  for future jobs.
                </p>

                <Link
                  href="/find-workers"
                  className="mt-5 inline-flex rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white transition hover:bg-orange-400"
                >
                  Find Workers
                </Link>
              </div>
            ) : filteredWorkers.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-8 text-center">
                <p className="text-xl font-black text-white">
                  No saved workers match your filters.
                </p>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-5 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                {filteredWorkers.map((item) => {
                  const worker = item.worker
                  if (!worker) return null

                  const workerName = getWorkerName(worker)
                  const photo = photoByUserId.get(worker.id)
                  const online = isActuallyOnline(worker)
                  const removing = removingId === item.id

                  return (
                    <article
                      key={item.id}
                      className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/10 transition hover:border-orange-300/30 sm:p-6"
                    >
                      <div className="flex flex-col gap-5 sm:flex-row">
                        <div className="flex items-start justify-between gap-4 sm:block">
                          <div className="relative">
                            {photo ? (
                              <img
                                src={photo}
                                alt={workerName}
                                className="h-20 w-20 shrink-0 rounded-3xl border border-white/10 object-cover shadow-lg sm:h-24 sm:w-24"
                              />
                            ) : (
                              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-cyan-400 text-3xl font-black text-white shadow-lg sm:h-24 sm:w-24">
                                {workerName.charAt(0)}
                              </div>
                            )}

                            <span
                              className={`absolute -right-1 -top-1 h-5 w-5 rounded-full border-4 border-slate-950 ${
                                online ? 'bg-lime-400' : 'bg-slate-500'
                              }`}
                            />
                          </div>

                          <span className="rounded-full border border-orange-400/30 bg-orange-500/15 px-3 py-1 text-xs font-black uppercase text-orange-100 sm:mt-3 sm:inline-flex">
                            Saved
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-2xl font-black text-white">
                              {workerName}
                            </h2>

                            {worker.insurance_provider && (
                              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black uppercase text-emerald-100">
                                Insured
                              </span>
                            )}

                            {worker.liability_form_signed && (
                              <span className="rounded-full bg-blue-400/15 px-3 py-1 text-xs font-black uppercase text-blue-100">
                                Liability Signed
                              </span>
                            )}
                          </div>

                          <p
                            className={`mt-1 text-xs font-black uppercase tracking-wide ${
                              online ? 'text-lime-300' : 'text-slate-500'
                            }`}
                          >
                            {presenceLabel(worker)}
                          </p>

                          <p className="mt-3 text-sm font-semibold text-slate-300">
                            {worker.trade || 'Trade not listed'} •{' '}
                            {[worker.city, worker.state]
                              .filter(Boolean)
                              .join(', ') || 'Location not listed'}
                          </p>

                          <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-300 sm:grid-cols-2">
                            <p>
                              <span className="text-cyan-300">
                                Experience:
                              </span>{' '}
                              {worker.years_experience || 'Not listed'}
                            </p>

                            <p>
                              <span className="text-cyan-300">Phone:</span>{' '}
                              {worker.phone || 'Not listed'}
                            </p>

                            <p className="sm:col-span-2">
                              <span className="text-cyan-300">
                                Insurance:
                              </span>{' '}
                              {worker.insurance_provider || 'Not listed'}
                            </p>
                          </div>

                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
                            {worker.job_experience ||
                              'No job experience summary added yet.'}
                          </p>

                          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <Link
                              href={`/profile?user=${worker.id}`}
                              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-white/15"
                            >
                              Profile
                            </Link>

                            <Link
                              href={`/messages?user=${worker.id}`}
                              className="rounded-2xl bg-blue-500 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-blue-400"
                            >
                              Message
                            </Link>

                            <Link
                              href={`/company/invites?workerId=${worker.id}`}
                              className="rounded-2xl bg-orange-500 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-orange-400"
                            >
                              Invite
                            </Link>

                            <button
                              type="button"
                              onClick={() => void removeSavedWorker(item)}
                              disabled={removing}
                              className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {removing ? 'Removing...' : 'Remove'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-orange-400/20 bg-orange-400/10 px-4 py-4 text-center">
      <p className="text-3xl font-black text-orange-100">{value}</p>

      <p className="text-xs font-black uppercase tracking-wide text-orange-300">
        {label}
      </p>
    </div>
  )
}

function FilterToggle({
  active,
  onClick,
  label,
  activeClass,
}: {
  active: boolean
  onClick: () => void
  label: string
  activeClass: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
        active
          ? activeClass
          : 'border border-white/10 bg-white/10 text-white hover:bg-white/15'
      }`}
    >
      {label}
    </button>
  )
}

function getWorkerName(worker: Profile) {
  return worker.full_name || worker.company_name || 'CrewCall Worker'
}

function isActuallyOnline(profile: Profile | null) {
  if (!profile?.is_online || !profile.last_seen) return false

  const lastSeen = new Date(profile.last_seen).getTime()

  if (Number.isNaN(lastSeen)) return false

  return Date.now() - lastSeen < 90_000
}

function presenceLabel(profile: Profile | null) {
  if (isActuallyOnline(profile)) return 'Online now'
  if (!profile?.last_seen) return 'Offline'

  return `Last seen ${formatRelativeTime(profile.last_seen)}`
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()

  if (Number.isNaN(date.getTime())) return 'recently'

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}