'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type ProfileFileRow = Database['public']['Tables']['profile_files']['Row']
type SavedWorkerRow = Database['public']['Tables']['saved_workers']['Row']
type SavedWorkerInsert =
  Database['public']['Tables']['saved_workers']['Insert']

type CurrentProfile = Pick<ProfileRow, 'id' | 'role'>

type WorkerProfile = Pick<
  ProfileRow,
  | 'id'
  | 'role'
  | 'full_name'
  | 'company_name'
  | 'phone'
  | 'city'
  | 'state'
  | 'trade'
  | 'years_experience'
  | 'insurance_provider'
  | 'job_experience'
  | 'liability_form_signed'
  | 'available_for_work'
  | 'currently_working'
  | 'booked_until'
  | 'is_online'
  | 'last_seen'
>

type ProfileFile = Pick<
  ProfileFileRow,
  'id' | 'user_id' | 'category' | 'file_url' | 'created_at'
>

type SavedWorker = Pick<
  SavedWorkerRow,
  'id' | 'company_id' | 'worker_id' | 'created_at'
>

const workerSelect = `
  id,
  role,
  full_name,
  company_name,
  phone,
  city,
  state,
  trade,
  years_experience,
  insurance_provider,
  job_experience,
  liability_form_signed,
  available_for_work,
  currently_working,
  booked_until,
  is_online,
  last_seen
`

export default function WorkersPage() {
  const [currentProfile, setCurrentProfile] =
    useState<CurrentProfile | null>(null)
  const [workers, setWorkers] = useState<WorkerProfile[]>([])
  const [profileFiles, setProfileFiles] = useState<ProfileFile[]>([])
  const [savedWorkers, setSavedWorkers] = useState<SavedWorker[]>([])
  const [loading, setLoading] = useState(true)
  const [savingWorkerId, setSavingWorkerId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [savedOnly, setSavedOnly] = useState(false)

  useEffect(() => {
    void loadWorkers()

    const channel = supabase
      .channel('workers-presence-live-full-polish')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => void loadWorkers()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'saved_workers' },
        () => void loadWorkers()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  const savedWorkerIds = useMemo(() => {
    return new Set(savedWorkers.map((saved) => saved.worker_id))
  }, [savedWorkers])

  const photoByUserId = useMemo(() => {
    const map = new Map<string, string>()

    profileFiles.forEach((file) => {
      if (
        file.user_id &&
        file.category === 'profile_photo' &&
        file.file_url &&
        !map.has(file.user_id)
      ) {
        map.set(file.user_id, file.file_url)
      }
    })

    return map
  }, [profileFiles])

  const trades = useMemo(() => {
    return Array.from(
      new Set(
        workers
          .map((worker) => worker.trade)
          .filter((trade): trade is string => Boolean(trade))
      )
    ).sort()
  }, [workers])

  const cities = useMemo(() => {
    return Array.from(
      new Set(
        workers
          .map((worker) => worker.city)
          .filter((city): city is string => Boolean(city))
      )
    ).sort()
  }, [workers])

  const availableCount = useMemo(() => {
    return workers.filter((worker) => isAvailable(worker)).length
  }, [workers])

  const onlineCount = useMemo(() => {
    return workers.filter((worker) => isActuallyOnline(worker)).length
  }, [workers])

  const verifiedCount = useMemo(() => {
    return workers.filter((worker) =>
      Boolean(worker.liability_form_signed || worker.insurance_provider)
    ).length
  }, [workers])

  const filteredWorkers = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()

    return workers.filter((worker) => {
      const searchable = [
        worker.full_name,
        worker.company_name,
        worker.trade,
        worker.city,
        worker.state,
        worker.years_experience,
        worker.insurance_provider,
        worker.job_experience,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !searchTerm || searchable.includes(searchTerm)
      const matchesTrade = !tradeFilter || worker.trade === tradeFilter
      const matchesCity = !cityFilter || worker.city === cityFilter
      const matchesVerified =
        !verifiedOnly ||
        Boolean(worker.liability_form_signed || worker.insurance_provider)
      const matchesAvailable = !availableOnly || isAvailable(worker)
      const matchesOnline = !onlineOnly || isActuallyOnline(worker)
      const matchesSaved = !savedOnly || savedWorkerIds.has(worker.id)

      return (
        matchesSearch &&
        matchesTrade &&
        matchesCity &&
        matchesVerified &&
        matchesAvailable &&
        matchesOnline &&
        matchesSaved
      )
    })
  }, [
    workers,
    search,
    tradeFilter,
    cityFilter,
    verifiedOnly,
    availableOnly,
    onlineOnly,
    savedOnly,
    savedWorkerIds,
  ])

  async function loadWorkers() {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .maybeSingle()

      setCurrentProfile(profileData)

      const { data: savedData } = await supabase
        .from('saved_workers')
        .select('id, company_id, worker_id, created_at')
        .eq('company_id', user.id)

      setSavedWorkers(savedData || [])
    } else {
      setCurrentProfile(null)
      setSavedWorkers([])
    }

    const { data, error } = await supabase
      .from('profiles')
      .select(workerSelect)
      .eq('role', 'worker')
      .order('full_name', { ascending: true })

    if (error) {
      setMessage(error.message)
      setWorkers([])
      setLoading(false)
      return
    }

    const safeWorkers = data || []
    setWorkers(safeWorkers)

    const workerIds = safeWorkers.map((worker) => worker.id)

    if (workerIds.length > 0) {
      const { data: files } = await supabase
        .from('profile_files')
        .select('id, user_id, category, file_url, created_at')
        .in('user_id', workerIds)
        .eq('category', 'profile_photo')
        .order('created_at', { ascending: false })

      setProfileFiles(files || [])
    } else {
      setProfileFiles([])
    }

    setLoading(false)
  }

  async function toggleSavedWorker(workerId: string) {
    if (!currentProfile?.id || currentProfile.role !== 'company') {
      setMessage('Only company accounts can save workers.')
      return
    }

    setSavingWorkerId(workerId)
    setMessage('')

    const existing = savedWorkers.find((saved) => saved.worker_id === workerId)

    if (existing) {
      const { error } = await supabase
        .from('saved_workers')
        .delete()
        .eq('id', existing.id)

      if (error) {
        setMessage(error.message)
        setSavingWorkerId(null)
        return
      }

      setSavedWorkers((prev) =>
        prev.filter((saved) => saved.worker_id !== workerId)
      )

      setSavingWorkerId(null)
      return
    }

    const payload: SavedWorkerInsert = {
      company_id: currentProfile.id,
      worker_id: workerId,
    }

    const { data, error } = await supabase
      .from('saved_workers')
      .insert(payload)
      .select('id, company_id, worker_id, created_at')
      .single()

    if (error) {
      setMessage(error.message)
      setSavingWorkerId(null)
      return
    }

    setSavedWorkers((prev) => [data, ...prev])
    setSavingWorkerId(null)
  }

  function resetFilters() {
    setSearch('')
    setTradeFilter('')
    setCityFilter('')
    setVerifiedOnly(false)
    setAvailableOnly(false)
    setOnlineOnly(false)
    setSavedOnly(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black text-white">Loading workers...</p>
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
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  Worker Discovery
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Find Workers
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Search workers, save favorites, and build a preferred crew
                  list.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-5">
                <MetricBox label="Found" value={filteredWorkers.length} tone="cyan" />
                <MetricBox label="Saved" value={savedWorkers.length} tone="orange" />
                <MetricBox label="Available" value={availableCount} tone="emerald" />
                <MetricBox label="Online" value={onlineCount} tone="lime" />
                <MetricBox label="Verified" value={verifiedCount} tone="blue" />
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6 md:p-8">
            {message && (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100">
                {message}
              </div>
            )}

            <div className="grid gap-4 rounded-3xl border border-white/10 bg-slate-950/50 p-5 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Search
                </label>

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, trade, city, insurance, experience..."
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Trade
                </label>

                <select
                  value={tradeFilter}
                  onChange={(event) => setTradeFilter(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
                >
                  <option value="">All trades</option>
                  {trades.map((trade) => (
                    <option key={trade} value={trade}>
                      {trade}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wide text-slate-400">
                  City
                </label>

                <select
                  value={cityFilter}
                  onChange={(event) => setCityFilter(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
                >
                  <option value="">All cities</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3 md:col-span-4">
                <FilterButton active={savedOnly} onClick={() => setSavedOnly((prev) => !prev)}>
                  {savedOnly ? 'Saved Only: On' : 'Saved Only'}
                </FilterButton>

                <FilterButton active={onlineOnly} onClick={() => setOnlineOnly((prev) => !prev)}>
                  {onlineOnly ? 'Online Only: On' : 'Online Only'}
                </FilterButton>

                <FilterButton active={availableOnly} onClick={() => setAvailableOnly((prev) => !prev)}>
                  {availableOnly ? 'Available Only: On' : 'Available Only'}
                </FilterButton>

                <FilterButton active={verifiedOnly} onClick={() => setVerifiedOnly((prev) => !prev)}>
                  {verifiedOnly ? 'Verified Only: On' : 'Verified Only'}
                </FilterButton>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm font-black text-white shadow-md shadow-black/20 transition hover:bg-slate-700"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {filteredWorkers.length === 0 ? (
              <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-950/60 p-8 text-center shadow-2xl shadow-black/20 md:p-12">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.16),transparent_30%)]" />

                <div className="relative">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-cyan-400 to-blue-500 text-5xl shadow-2xl shadow-cyan-500/20">
                    👷
                  </div>

                  <h2 className="mt-8 text-4xl font-black tracking-tight text-white">
                    No workers found
                  </h2>

                  <p className="mx-auto mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-300 md:text-lg">
                    Try adjusting filters, expanding your city search, or removing
                    availability requirements to discover more workers.
                  </p>

                  <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="rounded-2xl bg-cyan-400 px-7 py-4 text-sm font-black text-slate-950 shadow-2xl shadow-cyan-500/20 transition hover:scale-[1.03] hover:bg-cyan-300"
                    >
                      Reset Filters
                    </button>

                    <Link
                      href="/jobs"
                      className="rounded-2xl border border-white/10 bg-slate-800/95 px-7 py-4 text-sm font-black !text-white shadow-md shadow-black/20 transition hover:scale-[1.03] hover:bg-slate-700"
                    >
                      Browse Jobs
                    </Link>
                  </div>

                  <div className="mt-10 grid gap-4 md:grid-cols-3">
                    <EmptyTip
                      title="Expand your search"
                      body="Nearby cities may have active workers available immediately."
                    />

                    <EmptyTip
                      title="Remove filters"
                      body="Trade and availability filters can narrow results heavily."
                    />

                    <EmptyTip
                      title="Save top workers"
                      body="Build a preferred worker list for future CrewCall jobs."
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredWorkers.map((worker) => {
                  const workerPhoto = photoByUserId.get(worker.id)
                  const workerName =
                    worker.full_name || worker.company_name || 'Worker Profile'
                  const available = isAvailable(worker)
                  const online = isActuallyOnline(worker)
                  const saved = savedWorkerIds.has(worker.id)

                  return (
                    <div
                      key={worker.id}
                      className="group rounded-[2rem] border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/10 transition hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-slate-950/80"
                    >
                      <Link href={`/profile?user=${worker.id}`} className="block no-underline">
                        <div className="flex items-start gap-4">
                          <div className="relative">
                            {workerPhoto ? (
                              <img
                                src={workerPhoto}
                                alt={workerName}
                                className="h-20 w-20 shrink-0 rounded-3xl border border-white/10 object-cover shadow-lg"
                              />
                            ) : (
                              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 text-3xl font-black text-white shadow-lg">
                                {workerName.charAt(0)}
                              </div>
                            )}

                            <span
                              className={`absolute -right-1 -top-1 h-5 w-5 rounded-full border-4 border-slate-950 ${
                                online ? 'bg-lime-400' : 'bg-slate-500'
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <h2 className="truncate text-2xl font-black text-white group-hover:text-cyan-200">
                              {workerName}
                            </h2>

                            <p
                              className={`mt-1 text-xs font-black uppercase tracking-wide ${
                                online ? 'text-lime-300' : 'text-slate-500'
                              }`}
                            >
                              {presenceLabel(worker)}
                            </p>

                            <p className="mt-2 text-sm font-semibold text-slate-400">
                              {[worker.trade, worker.city, worker.state]
                                .filter(Boolean)
                                .join(' • ') || 'No details listed'}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-black ${
                            available
                              ? 'border-emerald-300/20 bg-emerald-400/15 text-emerald-100'
                              : 'border-orange-300/20 bg-orange-400/15 text-orange-100'
                          }`}
                        >
                          {availabilityLabel(worker)}
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          {worker.years_experience && (
                            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-slate-100">
                              {worker.years_experience} years
                            </span>
                          )}

                          {worker.insurance_provider && (
                            <span className="rounded-full border border-blue-300/20 bg-blue-400/15 px-3 py-2 text-xs font-black text-blue-100">
                              Insured
                            </span>
                          )}

                          {worker.liability_form_signed && (
                            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/15 px-3 py-2 text-xs font-black text-emerald-100">
                              Liability Signed
                            </span>
                          )}
                        </div>

                        <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
                          <p className="line-clamp-4 text-sm leading-6 text-slate-300">
                            {worker.job_experience || 'No job experience listed yet.'}
                          </p>
                        </div>
                      </Link>

                      <div className="mt-5 flex items-center justify-between gap-3">
                        <Link
                          href={`/profile?user=${worker.id}`}
                          className="text-sm font-black !text-cyan-300 no-underline hover:!text-cyan-200"
                        >
                          View Profile →
                        </Link>

                        {currentProfile?.role === 'company' && (
                          <button
                            type="button"
                            onClick={() => void toggleSavedWorker(worker.id)}
                            disabled={savingWorkerId === worker.id}
                            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition disabled:opacity-60 ${
                              saved
                                ? 'bg-orange-400 text-slate-950 hover:bg-orange-300'
                                : 'border border-white/10 bg-white/10 text-white hover:bg-white/15'
                            }`}
                          >
                            {savingWorkerId === worker.id
                              ? 'Saving...'
                              : saved
                                ? '★ Saved'
                                : '☆ Save'}
                          </button>
                        )}
                      </div>
                    </div>
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

function MetricBox({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'cyan' | 'orange' | 'emerald' | 'lime' | 'blue'
}) {
  const styles = {
    cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
    orange: 'border-orange-400/20 bg-orange-400/10 text-orange-100',
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    lime: 'border-lime-400/20 bg-lime-400/10 text-lime-100',
    blue: 'border-blue-400/20 bg-blue-400/10 text-blue-100',
  }

  return (
    <div className={`rounded-3xl border px-5 py-4 text-center ${styles[tone]}`}>
      <p className="text-3xl font-black">{value}</p>
      <p className="text-xs font-black uppercase tracking-wide">{label}</p>
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
        active
          ? 'bg-cyan-400 text-slate-950'
          : 'border border-white/10 bg-white/10 text-white hover:bg-white/15'
      }`}
    >
      {children}
    </button>
  )
}

function EmptyTip({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-left">
      <p className="text-lg font-black text-white">{title}</p>
      <p className="mt-2 text-sm font-semibold text-slate-400">{body}</p>
    </div>
  )
}

function isAvailable(worker: WorkerProfile) {
  return Boolean(worker.available_for_work) && !Boolean(worker.currently_working)
}

function isActuallyOnline(worker: WorkerProfile) {
  if (!worker.is_online || !worker.last_seen) return false

  const lastSeen = new Date(worker.last_seen).getTime()

  if (Number.isNaN(lastSeen)) return false

  return Date.now() - lastSeen < 90_000
}

function availabilityLabel(worker: WorkerProfile) {
  if (isAvailable(worker)) return 'Available Now'
  if (worker.currently_working) return 'Currently Working'
  if (worker.booked_until) return `Booked Until ${worker.booked_until}`
  return 'Not Available'
}

function presenceLabel(worker: WorkerProfile) {
  if (isActuallyOnline(worker)) return 'Online now'
  if (!worker.last_seen) return 'Offline'

  return `Last seen ${formatRelativeTime(worker.last_seen)}`
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