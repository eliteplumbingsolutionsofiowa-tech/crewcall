'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type UserRole = 'worker' | 'company' | null
type ViewMode = 'list' | 'map'

type CurrentProfile = {
  id: string
  role: UserRole
}

type WorkerProfile = {
  id: string
  role: UserRole
  full_name: string | null
  company_name: string | null
  phone: string | null
  city: string | null
  state: string | null
  trade: string | null
  years_experience: string | null
  insurance_provider: string | null
  job_experience: string | null
  liability_form_signed: boolean | null
  available_for_work: boolean | null
  currently_working: boolean | null
  booked_until: string | null
  is_online: boolean | null
  last_seen: string | null
  latitude: number | null
  longitude: number | null
  map_visibility: boolean | null
}

type ProfileFile = {
  id: string
  user_id: string
  category: string | null
  file_url: string | null
  created_at: string
}

type SavedWorker = {
  id: string
  company_id: string
  worker_id: string
  created_at: string
}

type SavedWorkerInsert = {
  company_id: string
  worker_id: string
}

type QueryError = {
  message: string
}

type WorkerSelectQuery = {
  eq: (column: string, value: string) => {
    order: (
      column: string,
      options?: { ascending?: boolean },
    ) => Promise<{
      data: WorkerProfile[] | null
      error: QueryError | null
    }>
  }
}

type WorkerTable = {
  select: (columns: string) => WorkerSelectQuery
}

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
  last_seen,
  latitude,
  longitude,
  map_visibility
`

function workerTable() {
  return supabase.from('profiles') as unknown as WorkerTable
}

export default function WorkersPage() {
  const [currentProfile, setCurrentProfile] =
    useState<CurrentProfile | null>(null)

  const [workers, setWorkers] = useState<WorkerProfile[]>([])
  const [profileFiles, setProfileFiles] = useState<ProfileFile[]>([])
  const [savedWorkers, setSavedWorkers] = useState<SavedWorker[]>([])

  const [loading, setLoading] = useState(true)
  const [savingWorkerId, setSavingWorkerId] = useState<string | null>(null)
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)

  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [savedOnly, setSavedOnly] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  useEffect(() => {
    void loadWorkers()

    const channel = supabase
      .channel('workers-discovery-map-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => void loadWorkers(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_workers',
        },
        () => void loadWorkers(),
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
          .filter((trade): trade is string => Boolean(trade)),
      ),
    ).sort()
  }, [workers])

  const cities = useMemo(() => {
    return Array.from(
      new Set(
        workers
          .map((worker) => worker.city)
          .filter((city): city is string => Boolean(city)),
      ),
    ).sort()
  }, [workers])

  const availableCount = useMemo(() => {
    return workers.filter((worker) => isAvailable(worker)).length
  }, [workers])

  const onlineCount = useMemo(() => {
    return workers.filter((worker) => isActuallyOnline(worker)).length
  }, [workers])

  const verifiedCount = useMemo(() => {
    return workers.filter((worker) => isVerified(worker)).length
  }, [workers])

  const mappedCount = useMemo(() => {
    return workers.filter((worker) => canAppearOnMap(worker)).length
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
      const matchesVerified = !verifiedOnly || isVerified(worker)
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

  const mappedWorkers = useMemo(() => {
    return filteredWorkers.filter((worker) => canAppearOnMap(worker))
  }, [filteredWorkers])

  const selectedWorker = useMemo(() => {
    if (!selectedWorkerId) return null

    return (
      filteredWorkers.find((worker) => worker.id === selectedWorkerId) || null
    )
  }, [filteredWorkers, selectedWorkerId])

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

      setCurrentProfile((profileData as CurrentProfile | null) || null)

      const { data: savedData, error: savedError } = await supabase
        .from('saved_workers')
        .select('id, company_id, worker_id, created_at')
        .eq('company_id', user.id)

      if (savedError) {
        setSavedWorkers([])
      } else {
        setSavedWorkers((savedData as SavedWorker[]) || [])
      }
    } else {
      setCurrentProfile(null)
      setSavedWorkers([])
    }

    const { data, error } = await workerTable()
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
      const { data: files, error: fileError } = await supabase
        .from('profile_files')
        .select('id, user_id, category, file_url, created_at')
        .in('user_id', workerIds)
        .eq('category', 'profile_photo')
        .order('created_at', { ascending: false })

      if (fileError) {
        setProfileFiles([])
      } else {
        setProfileFiles((files as ProfileFile[]) || [])
      }
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

    const existing = savedWorkers.find(
      (saved) => saved.worker_id === workerId,
    )

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

      setSavedWorkers((previous) =>
        previous.filter((saved) => saved.worker_id !== workerId),
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

    setSavedWorkers((previous) => [
      data as SavedWorker,
      ...previous,
    ])

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
    setSelectedWorkerId(null)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black text-white">Loading workers...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="pointer-events-none absolute left-[-120px] top-10 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[-100px] top-32 h-80 w-80 rounded-full bg-orange-400/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  Worker Discovery
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Find Workers
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Search available skilled workers, view approximate locations,
                  save favorites, and build your preferred crew.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <MetricBox
                  label="Found"
                  value={filteredWorkers.length}
                  tone="cyan"
                />

                <MetricBox
                  label="Saved"
                  value={savedWorkers.length}
                  tone="orange"
                />

                <MetricBox
                  label="Available"
                  value={availableCount}
                  tone="emerald"
                />

                <MetricBox
                  label="Online"
                  value={onlineCount}
                  tone="lime"
                />

                <MetricBox
                  label="Verified"
                  value={verifiedCount}
                  tone="blue"
                />

                <MetricBox
                  label="Mapped"
                  value={mappedCount}
                  tone="purple"
                />
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6 md:p-8">
            {message && (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100">
                {message}
              </div>
            )}

            <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                    Privacy-Safe Mapping
                  </p>

                  <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-cyan-100/80">
                    Map pins use approximate worker locations. Exact home
                    addresses are never displayed. Workers only appear when
                    they enable map visibility.
                  </p>
                </div>

                <div className="flex rounded-2xl border border-white/10 bg-slate-950/70 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`rounded-xl px-5 py-3 text-sm font-black transition ${
                      viewMode === 'list'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    List
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode('map')}
                    className={`rounded-xl px-5 py-3 text-sm font-black transition ${
                      viewMode === 'map'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    Map
                  </button>
                </div>
              </div>
            </section>

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
                <FilterButton
                  active={savedOnly}
                  onClick={() => setSavedOnly((previous) => !previous)}
                >
                  {savedOnly ? 'Saved Only: On' : 'Saved Only'}
                </FilterButton>

                <FilterButton
                  active={onlineOnly}
                  onClick={() => setOnlineOnly((previous) => !previous)}
                >
                  {onlineOnly ? 'Online Only: On' : 'Online Only'}
                </FilterButton>

                <FilterButton
                  active={availableOnly}
                  onClick={() => setAvailableOnly((previous) => !previous)}
                >
                  {availableOnly ? 'Available Only: On' : 'Available Only'}
                </FilterButton>

                <FilterButton
                  active={verifiedOnly}
                  onClick={() => setVerifiedOnly((previous) => !previous)}
                >
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
              <EmptyWorkers onReset={resetFilters} />
            ) : viewMode === 'list' ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredWorkers.map((worker) => (
                  <WorkerCard
                    key={worker.id}
                    worker={worker}
                    photo={photoByUserId.get(worker.id) || null}
                    saved={savedWorkerIds.has(worker.id)}
                    canSave={currentProfile?.role === 'company'}
                    saving={savingWorkerId === worker.id}
                    onSave={() => void toggleSavedWorker(worker.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                <WorkerGoogleMap
                  workers={mappedWorkers}
                  selectedWorkerId={selectedWorkerId}
                  onSelectWorker={setSelectedWorkerId}
                />

                <aside className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-2xl">
                  {selectedWorker ? (
                    <WorkerMapDetails
                      worker={selectedWorker}
                      photo={
                        photoByUserId.get(selectedWorker.id) || null
                      }
                      saved={savedWorkerIds.has(selectedWorker.id)}
                      canSave={currentProfile?.role === 'company'}
                      saving={savingWorkerId === selectedWorker.id}
                      onSave={() =>
                        void toggleSavedWorker(selectedWorker.id)
                      }
                    />
                  ) : (
                    <div className="flex min-h-[500px] flex-col items-center justify-center text-center">
                      <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-cyan-400/10 text-5xl">
                        📍
                      </div>

                      <h2 className="mt-6 text-2xl font-black">
                        Select a worker
                      </h2>

                      <p className="mt-3 max-w-xs text-sm font-semibold leading-6 text-slate-400">
                        Click a map pin to see the worker’s profile, trade,
                        availability, and experience.
                      </p>
                    </div>
                  )}
                </aside>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

const GOOGLE_MAPS_SCRIPT_ID = 'crewcall-google-maps-script'

const DEFAULT_MAP_CENTER = {
  lat: 41.5868,
  lng: -93.625,
}

const darkMapStyles: google.maps.MapTypeStyle[] = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#0f172a' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#0f172a' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94a3b8' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#132e2a' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6ee7b7' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#475569' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f8fafc' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#082f49' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#67e8f9' }],
  },
]

function WorkerGoogleMap({
  workers,
  selectedWorkerId,
  onSelectWorker,
}: {
  workers: WorkerProfile[]
  selectedWorkerId: string | null
  onSelectWorker: (workerId: string) => void
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map())

  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function initializeMap() {
      try {
        setMapError('')
        await loadGoogleMapsScript()

        if (cancelled || !mapElementRef.current) return

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapElementRef.current, {
            center: DEFAULT_MAP_CENTER,
            zoom: 8,
            styles: darkMapStyles,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            clickableIcons: false,
            backgroundColor: '#020617',
            gestureHandling: 'greedy',
          })
        }

        setMapReady(true)
      } catch (error) {
        console.error('Google Maps initialization failed:', error)

        setMapError(
          error instanceof Error
            ? error.message
            : 'Google Maps could not be loaded.',
        )
      }
    }

    void initializeMap()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current.clear()

    const visibleWorkers = workers.filter(hasValidCoordinates)

    if (visibleWorkers.length === 0) {
      mapRef.current.setCenter(DEFAULT_MAP_CENTER)
      mapRef.current.setZoom(8)
      return
    }

    const bounds = new google.maps.LatLngBounds()

    visibleWorkers.forEach((worker) => {
      const position = {
        lat: worker.latitude,
        lng: worker.longitude,
      }

      bounds.extend(position)

      const marker = new google.maps.Marker({
        map: mapRef.current,
        position,
        title:
          worker.full_name ||
          worker.company_name ||
          'CrewCall Worker',
        icon: createGoogleMarkerIcon(
          worker,
          worker.id === selectedWorkerId,
        ),
        animation:
          worker.id === selectedWorkerId
            ? google.maps.Animation.BOUNCE
            : undefined,
      })

      marker.addListener('click', () => {
        marker.setAnimation(google.maps.Animation.BOUNCE)

        window.setTimeout(() => {
          marker.setAnimation(null)
        }, 700)

        onSelectWorker(worker.id)
      })

      markersRef.current.set(worker.id, marker)
    })

    if (visibleWorkers.length === 1) {
      mapRef.current.setCenter({
        lat: visibleWorkers[0].latitude,
        lng: visibleWorkers[0].longitude,
      })

      mapRef.current.setZoom(11)
      return
    }

    mapRef.current.fitBounds(bounds, 70)

    const listener = google.maps.event.addListenerOnce(
      mapRef.current,
      'bounds_changed',
      () => {
        const zoom = mapRef.current?.getZoom() || 0

        if (mapRef.current && zoom > 12) {
          mapRef.current.setZoom(12)
        }
      },
    )

    return () => {
      google.maps.event.removeListener(listener)
    }
  }, [mapReady, workers, selectedWorkerId, onSelectWorker])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedWorkerId) return

    const selectedWorker = workers.find(
      (worker) => worker.id === selectedWorkerId,
    )

    if (!selectedWorker || !hasValidCoordinates(selectedWorker)) return

    mapRef.current.panTo({
      lat: selectedWorker.latitude,
      lng: selectedWorker.longitude,
    })

    if ((mapRef.current.getZoom() || 0) < 11) {
      mapRef.current.setZoom(11)
    }
  }, [mapReady, selectedWorkerId, workers])

  return (
    <section className="relative min-h-[620px] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl">
      <div ref={mapElementRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-5 top-5 z-10 rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 shadow-xl backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          Worker Availability
        </p>

        <p className="mt-1 text-sm font-bold text-slate-300">
          {workers.filter(hasValidCoordinates).length} visible on map
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-6 left-5 z-10 flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-slate-950/90 p-3 text-xs font-black shadow-xl backdrop-blur">
        <span className="flex items-center gap-2 text-emerald-200">
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
          Available
        </span>

        <span className="flex items-center gap-2 text-orange-200">
          <span className="h-3 w-3 rounded-full bg-orange-400" />
          Not Available
        </span>

        <span className="flex items-center gap-2 text-lime-200">
          <span className="h-3 w-3 rounded-full bg-lime-400" />
          Online
        </span>
      </div>

      {!mapReady && !mapError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-cyan-400" />
            <p className="mt-5 font-black text-white">
              Loading Google Maps...
            </p>
          </div>
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950 p-6">
          <div className="max-w-lg rounded-[2rem] border border-red-400/30 bg-red-500/10 p-8 text-center">
            <p className="text-4xl">🗺️</p>

            <h2 className="mt-5 text-2xl font-black text-white">
              Map unavailable
            </h2>

            <p className="mt-3 text-sm font-semibold leading-6 text-red-100">
              {mapError}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

function loadGoogleMapsScript() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google Maps can only load in the browser.'))
      return
    }

    if (window.google?.maps) {
      resolve()
      return
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      reject(
        new Error(
          'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing from .env.local.',
        ),
      )
      return
    }

    const existingScript = document.getElementById(
      GOOGLE_MAPS_SCRIPT_ID,
    ) as HTMLScriptElement | null

    if (existingScript) {
      if (window.google?.maps) {
        resolve()
        return
      }

      existingScript.addEventListener('load', () => resolve(), {
        once: true,
      })

      existingScript.addEventListener(
        'error',
        () =>
          reject(new Error('Google Maps script failed to load.')),
        { once: true },
      )

      return
    }

    const script = document.createElement('script')

    script.id = GOOGLE_MAPS_SCRIPT_ID
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&v=weekly`
    script.async = true
    script.defer = true

    script.addEventListener('load', () => resolve(), {
      once: true,
    })

    script.addEventListener(
      'error',
      () =>
        reject(new Error('Google Maps script failed to load.')),
      { once: true },
    )

    document.head.appendChild(script)
  })
}

function createGoogleMarkerIcon(
  worker: WorkerProfile,
  selected: boolean,
): google.maps.Symbol {
  const available = isAvailable(worker)
  const online = isActuallyOnline(worker)

  let fillColor = available ? '#34d399' : '#fb923c'

  if (online) {
    fillColor = '#a3e635'
  }

  if (selected) {
    fillColor = '#22d3ee'
  }

  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor,
    fillOpacity: 1,
    strokeColor: selected ? '#ffffff' : '#020617',
    strokeOpacity: 1,
    strokeWeight: selected ? 5 : 4,
    scale: selected ? 13 : 10,
  }
}

function hasValidCoordinates(
  worker: WorkerProfile,
): worker is WorkerProfile & {
  latitude: number
  longitude: number
} {
  return (
    typeof worker.latitude === 'number' &&
    Number.isFinite(worker.latitude) &&
    typeof worker.longitude === 'number' &&
    Number.isFinite(worker.longitude)
  )
}

function WorkerCard({
  worker,
  photo,
  saved,
  canSave,
  saving,
  onSave,
}: {
  worker: WorkerProfile
  photo: string | null
  saved: boolean
  canSave: boolean
  saving: boolean
  onSave: () => void
}) {
  const workerName =
    worker.full_name || worker.company_name || 'Worker Profile'

  const available = isAvailable(worker)
  const online = isActuallyOnline(worker)

  return (
    <div className="group rounded-[2rem] border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/10 transition hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-slate-950/80">
      <Link
        href={`/profile?user=${worker.id}`}
        className="block no-underline"
      >
        <div className="flex items-start gap-4">
          <div className="relative">
            {photo ? (
              <img
                src={photo}
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

          {worker.map_visibility && (
            <span className="rounded-full border border-purple-300/20 bg-purple-400/15 px-3 py-2 text-xs font-black text-purple-100">
              Map Visible
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
          className="text-sm font-black text-cyan-300 no-underline hover:text-cyan-200"
        >
          View Profile →
        </Link>

        {canSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition disabled:opacity-60 ${
              saved
                ? 'bg-orange-400 text-slate-950 hover:bg-orange-300'
                : 'border border-white/10 bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            {saving ? 'Saving...' : saved ? '★ Saved' : '☆ Save'}
          </button>
        )}
      </div>
    </div>
  )
}

function WorkerMapDetails({
  worker,
  photo,
  saved,
  canSave,
  saving,
  onSave,
}: {
  worker: WorkerProfile
  photo: string | null
  saved: boolean
  canSave: boolean
  saving: boolean
  onSave: () => void
}) {
  const workerName =
    worker.full_name || worker.company_name || 'Worker Profile'

  return (
    <div>
      <div className="flex items-center gap-4">
        {photo ? (
          <img
            src={photo}
            alt={workerName}
            className="h-20 w-20 rounded-3xl border border-white/10 object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 text-3xl font-black">
            {workerName.charAt(0)}
          </div>
        )}

        <div className="min-w-0">
          <h2 className="truncate text-2xl font-black">{workerName}</h2>

          <p className="mt-1 text-sm font-bold text-cyan-300">
            {worker.trade || 'Trade not listed'}
          </p>

          <p className="mt-1 text-sm text-slate-400">
            {[worker.city, worker.state].filter(Boolean).join(', ') ||
              'Location not listed'}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <DetailBox
          label="Availability"
          value={availabilityLabel(worker)}
        />

        <DetailBox
          label="Presence"
          value={presenceLabel(worker)}
        />

        <DetailBox
          label="Experience"
          value={
            worker.years_experience
              ? `${worker.years_experience} years`
              : 'Not listed'
          }
        />

        <DetailBox
          label="Verification"
          value={isVerified(worker) ? 'Verified details' : 'Not verified'}
        />
      </div>

      <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
          Experience
        </p>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          {worker.job_experience || 'No job experience listed yet.'}
        </p>
      </div>

      <div className="mt-5 grid gap-3">
        <Link
          href={`/profile?user=${worker.id}`}
          className="rounded-2xl bg-cyan-400 px-5 py-4 text-center font-black text-slate-950 hover:bg-cyan-300"
        >
          View Full Profile
        </Link>

        {canSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className={`rounded-2xl px-5 py-4 font-black transition disabled:opacity-60 ${
              saved
                ? 'bg-orange-400 text-slate-950 hover:bg-orange-300'
                : 'border border-white/10 bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            {saving
              ? 'Saving...'
              : saved
                ? '★ Remove from Saved'
                : '☆ Save Worker'}
          </button>
        )}
      </div>
    </div>
  )
}

function EmptyWorkers({ onReset }: { onReset: () => void }) {
  return (
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
          availability requirements.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            type="button"
            onClick={onReset}
            className="rounded-2xl bg-cyan-400 px-7 py-4 text-sm font-black text-slate-950 shadow-2xl shadow-cyan-500/20 transition hover:scale-[1.03] hover:bg-cyan-300"
          >
            Reset Filters
          </button>

          <Link
            href="/jobs"
            className="rounded-2xl border border-white/10 bg-slate-800/95 px-7 py-4 text-sm font-black text-white shadow-md shadow-black/20 transition hover:scale-[1.03] hover:bg-slate-700"
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
            body="Build a preferred worker list for future jobs."
          />
        </div>
      </div>
    </div>
  )
}

function MetricBox({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'cyan' | 'orange' | 'emerald' | 'lime' | 'blue' | 'purple'
}) {
  const styles = {
    cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
    orange: 'border-orange-400/20 bg-orange-400/10 text-orange-100',
    emerald:
      'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    lime: 'border-lime-400/20 bg-lime-400/10 text-lime-100',
    blue: 'border-blue-400/20 bg-blue-400/10 text-blue-100',
    purple:
      'border-purple-400/20 bg-purple-400/10 text-purple-100',
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

function DetailBox({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 font-black text-white">{value}</p>
    </div>
  )
}

function EmptyTip({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-left">
      <p className="text-lg font-black text-white">{title}</p>
      <p className="mt-2 text-sm font-semibold text-slate-400">{body}</p>
    </div>
  )
}

function isAvailable(worker: WorkerProfile) {
  return (
    Boolean(worker.available_for_work) &&
    !Boolean(worker.currently_working)
  )
}

function isVerified(worker: WorkerProfile) {
  return Boolean(
    worker.liability_form_signed || worker.insurance_provider,
  )
}

function canAppearOnMap(worker: WorkerProfile) {
  return (
    Boolean(worker.map_visibility) &&
    typeof worker.latitude === 'number' &&
    typeof worker.longitude === 'number'
  )
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

  if (worker.booked_until) {
    return `Booked Until ${formatDate(worker.booked_until)}`
  }

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

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}