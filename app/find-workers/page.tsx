'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import InviteWorkerModal from '@/app/components/InviteWorkerModal'

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type ProfileFileRow = Database['public']['Tables']['profile_files']['Row']
type SavedWorkerRow = Database['public']['Tables']['saved_workers']['Row']
type SavedWorkerInsert =
  Database['public']['Tables']['saved_workers']['Insert']

type ViewMode = 'list' | 'map'

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
  | 'latitude'
  | 'longitude'
  | 'location_visible'
  | 'location_updated_at'
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
  last_seen,
  latitude,
  longitude,
  location_visible,
  location_updated_at
`

export default function FindWorkersPage() {
  const router = useRouter()

  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [workers, setWorkers] = useState<Profile[]>([])
  const [profileFiles, setProfileFiles] = useState<ProfileFile[]>([])
  const [savedWorkers, setSavedWorkers] = useState<SavedWorker[]>([])
  const [savingWorkerId, setSavingWorkerId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [viewMode, setViewMode] = useState<ViewMode>('list')
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

  const mappableWorkers = useMemo(() => {
    return filteredWorkers.filter(
      (worker) =>
        worker.location_visible === true &&
        typeof worker.latitude === 'number' &&
        typeof worker.longitude === 'number'
    )
  }, [filteredWorkers])

  async function loadWorkers() {
    setLoading(true)
    setMessage('')
    setSuccessMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.replace('/login')
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

    if (!profileData) {
      router.replace('/profile')
      return
    }

    if (profileData.role !== 'company') {
      router.replace('/worker/dashboard')
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

    setLoading(false)
  }

  async function toggleSavedWorker(worker: Profile) {
    if (!currentUser || currentUser.role !== 'company') {
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
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
              CrewCall
            </p>
            <h1 className="mt-3 text-3xl font-black">Finding workers...</h1>
            <p className="mt-2 text-sm font-semibold text-slate-300">
              Loading worker profiles, saved status, and live availability.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  CrewCall Worker Network
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                  Find Workers
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Search skilled tradespeople, view live worker locations, save
                  strong candidates, and invite workers directly to your jobs.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/saved-workers"
                    className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                  >
                    Saved Workers
                  </Link>

                  <Link
                    href="/post-job"
                    className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
                  >
                    Post Job
                  </Link>

                  <button
                    type="button"
                    onClick={() => void loadWorkers()}
                    className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Workers" value={workers.length} />
                <StatCard label="Showing" value={filteredWorkers.length} />
                <StatCard
                  label="Online"
                  value={
                    workers.filter((worker) => isActuallyOnline(worker)).length
                  }
                />
                <StatCard label="On Map" value={mappableWorkers.length} />
              </div>
            </div>
          </section>

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

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
              <div className="flex-1">
                <label className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Search workers
                </label>

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, trade, city, insurance, experience..."
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                />
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
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
                onClick={() => setInsuredOnly((previous) => !previous)}
                label={insuredOnly ? 'Insured: On' : 'Insured'}
              />

              <FilterToggle
                active={onlineOnly}
                onClick={() => setOnlineOnly((previous) => !previous)}
                label={onlineOnly ? 'Online: On' : 'Online'}
              />

              <FilterToggle
                active={savedOnly}
                onClick={() => setSavedOnly((previous) => !previous)}
                label={savedOnly ? 'Saved: On' : 'Saved'}
              />
            </div>

            <div className="mt-4 flex w-fit rounded-2xl border border-white/10 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`rounded-xl px-5 py-2 text-sm font-black transition ${
                  viewMode === 'list'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                List View
              </button>

              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`rounded-xl px-5 py-2 text-sm font-black transition ${
                  viewMode === 'map'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                Map View
              </button>
            </div>
          </section>

          {filteredWorkers.length === 0 ? (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
              <h2 className="text-2xl font-black">No workers found</h2>
              <p className="mt-2 text-slate-300">
                Try clearing filters or searching another trade or location.
              </p>
            </section>
          ) : viewMode === 'map' ? (
            <WorkerMap
              workers={mappableWorkers}
              photoByUserId={photoByUserId}
              onInvite={openInviteModal}
            />
          ) : (
            <section className="grid gap-5 lg:grid-cols-2">
              {filteredWorkers.map((worker) => (
                <WorkerCard
                  key={worker.id}
                  worker={worker}
                  photo={photoByUserId.get(worker.id)}
                  isSaved={savedWorkerIdSet.has(worker.id)}
                  saving={savingWorkerId === worker.id}
                  onSave={() => void toggleSavedWorker(worker)}
                  onInvite={() => openInviteModal(worker)}
                />
              ))}
            </section>
          )}
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

function WorkerMap({
  workers,
  photoByUserId,
  onInvite,
}: {
  workers: Profile[]
  photoByUserId: Map<string, string>
  onInvite: (worker: Profile) => void
}) {
  const bounds = useMemo(() => {
    if (workers.length === 0) {
      return null
    }

    const latitudes = workers.map((worker) => Number(worker.latitude))
    const longitudes = workers.map((worker) => Number(worker.longitude))

    return {
      minLat: Math.min(...latitudes),
      maxLat: Math.max(...latitudes),
      minLng: Math.min(...longitudes),
      maxLng: Math.max(...longitudes),
    }
  }, [workers])

  if (!bounds || workers.length === 0) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-xl">
        <h2 className="text-2xl font-black">No live workers on the map</h2>
        <p className="mt-2 text-slate-300">
          Workers appear here after they turn location sharing on.
        </p>
      </section>
    )
  }

  const latRange = Math.max(bounds.maxLat - bounds.minLat, 0.01)
  const lngRange = Math.max(bounds.maxLng - bounds.minLng, 0.01)

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="relative min-h-[560px] overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,.12),transparent_60%)]" />

        <div className="absolute left-5 top-5 rounded-2xl border border-white/10 bg-slate-950/85 px-4 py-3 backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            Live Worker Map
          </p>
          <p className="mt-1 text-sm font-bold text-slate-300">
            {workers.length} visible worker{workers.length === 1 ? '' : 's'}
          </p>
        </div>

        {workers.map((worker) => {
          const latitude = Number(worker.latitude)
          const longitude = Number(worker.longitude)
          const left = ((longitude - bounds.minLng) / lngRange) * 78 + 11
          const top = (1 - (latitude - bounds.minLat) / latRange) * 72 + 14
          const workerName = getWorkerName(worker)
          const photo = photoByUserId.get(worker.id)

          return (
            <Link
              key={worker.id}
              href={`/profile?user=${worker.id}`}
              title={workerName}
              style={{ left: `${left}%`, top: `${top}%` }}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
            >
              <div className="relative">
                {photo ? (
                  <img
                    src={photo}
                    alt={workerName}
                    className="h-12 w-12 rounded-full border-4 border-cyan-300 object-cover shadow-[0_0_22px_rgba(34,211,238,.45)]"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-cyan-300 bg-slate-950 text-lg font-black text-white shadow-[0_0_22px_rgba(34,211,238,.45)]">
                    {workerName.charAt(0)}
                  </div>
                )}

                <span
                  className={`absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-slate-950 ${
                    isActuallyOnline(worker) ? 'bg-lime-400' : 'bg-slate-500'
                  }`}
                />

                <div className="pointer-events-none absolute left-1/2 top-14 z-20 hidden w-48 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/95 p-3 text-center shadow-2xl group-hover:block">
                  <p className="font-black text-white">{workerName}</p>
                  <p className="mt-1 text-xs text-slate-300">
                    {worker.trade || 'Trade not listed'}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
        {workers.map((worker) => (
          <div
            key={worker.id}
            className="rounded-3xl border border-white/10 bg-white/5 p-4"
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${
                  isActuallyOnline(worker) ? 'bg-lime-400' : 'bg-slate-500'
                }`}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-white">
                  {getWorkerName(worker)}
                </p>
                <p className="text-xs text-slate-400">
                  {worker.trade || 'Trade not listed'} ·{' '}
                  {[worker.city, worker.state].filter(Boolean).join(', ') ||
                    'Location not listed'}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href={`/profile?user=${worker.id}`}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-center text-xs font-black text-white hover:bg-white/20"
              >
                Profile
              </Link>

              <button
                type="button"
                onClick={() => onInvite(worker)}
                className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-cyan-300"
              >
                Invite
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function WorkerCard({
  worker,
  photo,
  isSaved,
  saving,
  onSave,
  onInvite,
}: {
  worker: Profile
  photo?: string
  isSaved: boolean
  saving: boolean
  onSave: () => void
  onInvite: () => void
}) {
  const workerName = getWorkerName(worker)
  const online = isActuallyOnline(worker)

  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl transition hover:border-cyan-300/30">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="relative shrink-0">
          {photo ? (
            <img
              src={photo}
              alt={workerName}
              className="h-24 w-24 rounded-3xl border border-white/10 object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 text-3xl font-black">
              {workerName.charAt(0)}
            </div>
          )}

          <span
            className={`absolute -right-1 -top-1 h-5 w-5 rounded-full border-4 border-slate-950 ${
              online ? 'bg-lime-400' : 'bg-slate-500'
            }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-black">{workerName}</h2>

            {worker.insurance_provider && (
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black uppercase text-emerald-100">
                Insured
              </span>
            )}

            {worker.location_visible && (
              <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-black uppercase text-cyan-100">
                On Map
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
            {worker.trade || 'Trade not listed'} ·{' '}
            {[worker.city, worker.state].filter(Boolean).join(', ') ||
              'Location not listed'}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Info
              label="Experience"
              value={
  worker.years_experience != null
    ? String(worker.years_experience)
    : 'Not listed'
}
            />
            <Info label="Phone" value={worker.phone || 'Not listed'} />
            <Info
              label="Insurance"
              value={worker.insurance_provider || 'Not listed'}
            />
          </div>

          <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-400">
            {worker.job_experience || 'No job experience summary added yet.'}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Link
              href={`/profile?user=${worker.id}`}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/20"
            >
              Profile
            </Link>

            <Link
              href={`/messages?user=${worker.id}`}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/20"
            >
              Message
            </Link>

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className={`rounded-2xl px-4 py-3 text-sm font-black transition disabled:opacity-50 ${
                isSaved
                  ? 'border border-orange-400/40 bg-orange-500/15 text-orange-100'
                  : 'border border-white/10 bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {saving ? 'Saving...' : isSaved ? 'Unsave' : 'Save'}
            </button>

            <button
              type="button"
              onClick={onInvite}
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
            >
              Invite
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/60 px-4 py-4 text-center">
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
    </div>
  )
}

function FilterToggle({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
        active
          ? 'bg-cyan-400 text-slate-950'
          : 'border border-white/10 bg-white/10 text-white hover:bg-white/20'
      }`}
    >
      {label}
    </button>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-bold text-white">{value}</p>
    </div>
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