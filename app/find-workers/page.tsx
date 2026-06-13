'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import InviteWorkerModal from '@/app/components/InviteWorkerModal'

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type ProfileFileRow = Database['public']['Tables']['profile_files']['Row']
type SavedWorkerRow = Database['public']['Tables']['saved_workers']['Row']
type SavedWorkerInsert =
  Database['public']['Tables']['saved_workers']['Insert']

type Profile = Pick<
  ProfileRow,
  | 'id'
  | 'role'
  | 'full_name'
  | 'company_name'
  | 'trade'
  | 'city'
  | 'state'
  | 'phone'
  | 'years_experience'
  | 'insurance_provider'
  | 'job_experience'
  | 'liability_form_signed'
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

const profileSelect = `
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

export default function FindWorkersPage() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [workers, setWorkers] = useState<Profile[]>([])
  const [profileFiles, setProfileFiles] = useState<ProfileFile[]>([])
  const [savedWorkers, setSavedWorkers] = useState<SavedWorker[]>([])
  const [savingWorkerId, setSavingWorkerId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [search, setSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const [insuredOnly, setInsuredOnly] = useState(false)
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [savedOnly, setSavedOnly] = useState(false)

  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState<Profile | null>(null)

  useEffect(() => {
    void loadWorkers()
  }, [])

  const savedWorkerIdSet = useMemo(() => {
    return new Set(savedWorkers.map((item) => item.worker_id))
  }, [savedWorkers])

  const savedWorkerByWorkerId = useMemo(() => {
    const map = new Map<string, SavedWorker>()

    savedWorkers.forEach((item) => {
      map.set(item.worker_id, item)
    })

    return map
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

  const states = useMemo(() => {
    return Array.from(
      new Set(
        workers
          .map((worker) => worker.state)
          .filter((state): state is string => Boolean(state))
      )
    ).sort()
  }, [workers])

  const filteredWorkers = useMemo(() => {
    const term = search.trim().toLowerCase()

    return workers.filter((worker) => {
      const workerName = worker.full_name || worker.company_name || ''

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
      const matchesSaved = !savedOnly || savedWorkerIdSet.has(worker.id)

      return (
        matchesSearch &&
        matchesTrade &&
        matchesState &&
        matchesInsured &&
        matchesOnline &&
        matchesSaved
      )
    })
  }, [
    workers,
    search,
    tradeFilter,
    stateFilter,
    insuredOnly,
    onlineOnly,
    savedOnly,
    savedWorkerIdSet,
  ])

  async function loadWorkers() {
    setLoading(true)
    setMessage('')
    setSuccessMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in to find workers.')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(profileSelect)
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      setMessage(profileError.message)
      setLoading(false)
      return
    }

    setCurrentUser(profileData)

    const { data: workerData, error: workerError } = await supabase
      .from('profiles')
      .select(profileSelect)
      .eq('role', 'worker')
      .order('full_name', { ascending: true })

    if (workerError) {
      setMessage(workerError.message)
      setWorkers([])
      setLoading(false)
      return
    }

    const safeWorkers = workerData || []
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

    if (profileData?.role === 'company') {
      const { data: savedData, error: savedError } = await supabase
        .from('saved_workers')
        .select('id, company_id, worker_id, created_at')
        .eq('company_id', user.id)
        .order('created_at', { ascending: false })

      if (savedError) {
        setMessage(savedError.message)
        setSavedWorkers([])
      } else {
        setSavedWorkers(savedData || [])
      }
    } else {
      setSavedWorkers([])
    }

    setLoading(false)
  }

  async function toggleSavedWorker(worker: Profile) {
    if (!currentUser || currentUser.role !== 'company') {
      setMessage('Only company accounts can save workers.')
      return
    }

    setSavingWorkerId(worker.id)
    setMessage('')
    setSuccessMessage('')

    const existingSavedWorker = savedWorkerByWorkerId.get(worker.id)
    const workerName = getWorkerName(worker)

    if (existingSavedWorker) {
      const { error } = await supabase
        .from('saved_workers')
        .delete()
        .eq('id', existingSavedWorker.id)
        .eq('company_id', currentUser.id)

      if (error) {
        setMessage(error.message)
        setSavingWorkerId(null)
        return
      }

      setSavedWorkers((current) =>
        current.filter((item) => item.id !== existingSavedWorker.id)
      )

      setSuccessMessage(`${workerName} removed from saved workers.`)
      setSavingWorkerId(null)
      return
    }

    const payload: SavedWorkerInsert = {
      company_id: currentUser.id,
      worker_id: worker.id,
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

    setSavedWorkers((current) => [data, ...current])
    setSuccessMessage(`${workerName} saved to your worker list.`)
    setSavingWorkerId(null)
  }

  function openInviteModal(worker: Profile) {
    setSelectedWorker(worker)
    setSuccessMessage('')
    setInviteModalOpen(true)
  }

  function closeInviteModal() {
    setInviteModalOpen(false)
    setSelectedWorker(null)
  }

  function resetFilters() {
    setSearch('')
    setTradeFilter('all')
    setStateFilter('all')
    setInsuredOnly(false)
    setOnlineOnly(false)
    setSavedOnly(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
              Loading
            </p>

            <h1 className="mt-3 text-3xl font-black">Finding workers...</h1>

            <p className="mt-2 text-sm font-semibold text-slate-300">
              Pulling worker profiles, photos, saved status, and availability.
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
    <>
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-orange-500/15 p-6 md:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                    CrewCall Worker Network
                  </p>

                  <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                    Find Workers
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                    Search skilled tradespeople by trade, location, insurance,
                    experience, online availability, and save your best workers
                    for future jobs.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/saved-workers"
                      className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-100"
                    >
                      Saved Workers
                    </Link>

                    <Link
                      href="/post-job"
                      className="rounded-2xl border border-orange-400/40 bg-orange-500/15 px-5 py-3 text-sm font-black text-orange-100 transition hover:bg-orange-500/25"
                    >
                      Post Job
                    </Link>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <StatCard label="Workers" value={workers.length} />
                  <StatCard label="Showing" value={filteredWorkers.length} />
                  <StatCard
                    label="Online"
                    value={
                      workers.filter((worker) => isActuallyOnline(worker))
                        .length
                    }
                  />
                  <StatCard label="Saved" value={savedWorkers.length} />
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

              {currentUser?.role !== 'company' && (
                <div className="rounded-2xl border border-orange-400/30 bg-orange-400/10 px-5 py-4 text-sm font-bold text-orange-100">
                  Worker search is mainly for company accounts. You can still
                  view workers, but saving and inviting work best from a company
                  login.
                </div>
              )}

              <div className="sticky top-3 z-10 rounded-3xl border border-white/10 bg-slate-950/90 p-5 shadow-2xl shadow-black/30 backdrop-blur">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="flex-1">
                    <label className="text-xs font-black uppercase tracking-wide text-slate-400">
                      Search workers
                    </label>

                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search name, trade, city, phone, insurance, experience..."
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
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

                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  <select
                    value={tradeFilter}
                    onChange={(event) => setTradeFilter(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none focus:border-cyan-300/50"
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
                    className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none focus:border-cyan-300/50"
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

                  <FilterToggle
                    active={savedOnly}
                    onClick={() => setSavedOnly((prev) => !prev)}
                    label={savedOnly ? 'Saved: On' : 'Saved'}
                    activeClass="bg-orange-400 text-slate-950"
                  />
                </div>
              </div>

              {filteredWorkers.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-8 text-center">
                  <p className="text-xl font-black text-white">
                    No workers found.
                  </p>

                  <p className="mt-2 text-sm font-semibold text-slate-400">
                    Try clearing filters or searching a different trade,
                    location, or saved status.
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
                  {filteredWorkers.map((worker) => {
                    const workerName = getWorkerName(worker)
                    const photo = photoByUserId.get(worker.id)
                    const online = isActuallyOnline(worker)
                    const isSaved = savedWorkerIdSet.has(worker.id)
                    const saving = savingWorkerId === worker.id

                    return (
                      <article
                        key={worker.id}
                        className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/10 transition hover:border-cyan-300/30 sm:p-6"
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
                                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 text-3xl font-black text-white shadow-lg sm:h-24 sm:w-24">
                                  {workerName.charAt(0)}
                                </div>
                              )}

                              <span
                                className={`absolute -right-1 -top-1 h-5 w-5 rounded-full border-4 border-slate-950 ${
                                  online ? 'bg-lime-400' : 'bg-slate-500'
                                }`}
                              />
                            </div>

                            {isSaved && (
                              <span className="rounded-full border border-orange-400/30 bg-orange-500/15 px-3 py-1 text-xs font-black uppercase text-orange-100 sm:mt-3 sm:inline-flex">
                                Saved
                              </span>
                            )}
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

                              <button
                                type="button"
                                onClick={() => void toggleSavedWorker(worker)}
                                disabled={
                                  currentUser?.role !== 'company' || saving
                                }
                                className={`rounded-2xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                  isSaved
                                    ? 'border border-orange-400/40 bg-orange-500/15 text-orange-100 hover:bg-orange-500/25'
                                    : 'border border-white/10 bg-white/10 text-white hover:bg-white/15'
                                }`}
                              >
                                {saving
                                  ? 'Saving...'
                                  : isSaved
                                    ? 'Unsave'
                                    : 'Save'}
                              </button>

                              <button
                                type="button"
                                onClick={() => openInviteModal(worker)}
                                disabled={currentUser?.role !== 'company'}
                                className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Invite
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

      {selectedWorker && (
        <InviteWorkerModal
          open={inviteModalOpen}
          worker={selectedWorker}
          onClose={closeInviteModal}
        />
      )}
    </>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-4 text-center">
      <p className="text-3xl font-black text-cyan-100">{value}</p>

      <p className="text-xs font-black uppercase tracking-wide text-cyan-300">
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