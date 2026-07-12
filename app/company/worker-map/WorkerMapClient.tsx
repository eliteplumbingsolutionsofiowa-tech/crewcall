'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '@/lib/supabase'

const db = supabase as any

type Worker = {
  id: string
  full_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  is_online: boolean | null
  location_visible: boolean | null
  location_updated_at: string | null
  insurance_verified: boolean | null
  liability_form_verified: boolean | null
  avatar_url: string | null
}

type Coordinates = {
  latitude: number
  longitude: number
}

type RadiusOption = 10 | 25 | 50 | 100 | 250

const DEFAULT_CENTER: [number, number] = [41.5868, -93.625]
const DEFAULT_ZOOM = 8

function milesBetween(
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number
) {
  const earthRadiusMiles = 3958.8

  const toRadians = (degrees: number) => {
    return (degrees * Math.PI) / 180
  }

  const latitudeDifference = toRadians(
    secondLatitude - firstLatitude
  )

  const longitudeDifference = toRadians(
    secondLongitude - firstLongitude
  )

  const firstLatitudeRadians = toRadians(firstLatitude)
  const secondLatitudeRadians = toRadians(secondLatitude)

  const calculation =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitudeRadians) *
      Math.cos(secondLatitudeRadians) *
      Math.sin(longitudeDifference / 2) ** 2

  const angularDistance =
    2 * Math.atan2(Math.sqrt(calculation), Math.sqrt(1 - calculation))

  return earthRadiusMiles * angularDistance
}

function formatLastUpdated(value: string | null) {
  if (!value) {
    return 'Location update unavailable'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Location update unavailable'
  }

  return `Updated ${date.toLocaleString()}`
}

function RecenterMap({
  center,
}: {
  center: [number, number]
}) {
  const map = useMap()

  useEffect(() => {
    map.setView(center, map.getZoom())
  }, [center, map])

  return null
}

export default function WorkerMapClient() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [companyLocation, setCompanyLocation] =
    useState<Coordinates | null>(null)

  const [selectedTrade, setSelectedTrade] = useState('all')
  const [radius, setRadius] = useState<RadiusOption>(50)
  const [onlineOnly, setOnlineOnly] = useState(true)

  const [loading, setLoading] = useState(true)
  const [locating, setLocating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void loadWorkers()
  }, [])

  async function loadWorkers() {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('Log in as a company to view the worker map.')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      setMessage(profileError.message)
      setLoading(false)
      return
    }

    if (!profile || profile.role !== 'company') {
      setMessage('This map is available to company accounts.')
      setLoading(false)
      return
    }

    const { data, error } = await db
      .from('profiles')
      .select(
        `
        id,
        full_name,
        trade,
        city,
        state,
        latitude,
        longitude,
        is_online,
        location_visible,
        location_updated_at,
        insurance_verified,
        liability_form_verified,
        avatar_url
      `
      )
      .eq('role', 'worker')
      .eq('location_visible', true)

    if (error) {
      setMessage(error.message)
      setWorkers([])
      setLoading(false)
      return
    }

    const validWorkers = ((data || []) as Worker[]).filter(
      (worker) =>
        typeof worker.latitude === 'number' &&
        typeof worker.longitude === 'number'
    )

    setWorkers(validWorkers)
    setLoading(false)
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setMessage('Location services are not supported by this browser.')
      return
    }

    setLocating(true)
    setMessage(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCompanyLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })

        setLocating(false)
      },
      (error) => {
        console.error('Company location request failed:', error)

        if (error.code === 1) {
          setMessage(
            'Location access was denied. Allow location access in your browser settings.'
          )
        } else if (error.code === 2) {
          setMessage('Your location could not be determined.')
        } else if (error.code === 3) {
          setMessage('The location request timed out.')
        } else {
          setMessage('Your location could not be loaded.')
        }

        setLocating(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 120000,
      }
    )
  }

  const trades = useMemo(() => {
    const tradeNames = workers
      .map((worker) => worker.trade?.trim())
      .filter((trade): trade is string => Boolean(trade))

    return Array.from(new Set(tradeNames)).sort((a, b) =>
      a.localeCompare(b)
    )
  }, [workers])

  const filteredWorkers = useMemo(() => {
    return workers
      .map((worker) => {
        let distance: number | null = null

        if (
          companyLocation &&
          worker.latitude !== null &&
          worker.longitude !== null
        ) {
          distance = milesBetween(
            companyLocation.latitude,
            companyLocation.longitude,
            worker.latitude,
            worker.longitude
          )
        }

        return {
          ...worker,
          distance,
        }
      })
      .filter((worker) => {
        if (onlineOnly && worker.is_online !== true) {
          return false
        }

        if (
          selectedTrade !== 'all' &&
          worker.trade?.toLowerCase() !== selectedTrade.toLowerCase()
        ) {
          return false
        }

        if (
          companyLocation &&
          worker.distance !== null &&
          worker.distance > radius
        ) {
          return false
        }

        return true
      })
      .sort((first, second) => {
        if (first.distance === null && second.distance === null) {
          return 0
        }

        if (first.distance === null) {
          return 1
        }

        if (second.distance === null) {
          return -1
        }

        return first.distance - second.distance
      })
  }, [
    workers,
    companyLocation,
    onlineOnly,
    selectedTrade,
    radius,
  ])

  const mapCenter: [number, number] = companyLocation
    ? [companyLocation.latitude, companyLocation.longitude]
    : DEFAULT_CENTER

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
            Loading worker map...
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
                CrewCall Live
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                Nearby Worker Map
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Find available skilled workers, view their profiles, and
                invite them to your jobs.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
              >
                {locating ? 'Finding location...' : 'Use My Location'}
              </button>

              <button
                type="button"
                onClick={() => void loadWorkers()}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Refresh Workers
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
            {message}
          </div>
        ) : null}

        <section className="mb-6 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 md:grid-cols-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-200">
              Trade
            </span>

            <select
              value={selectedTrade}
              onChange={(event) => setSelectedTrade(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white"
            >
              <option value="all">All trades</option>

              {trades.map((trade) => (
                <option key={trade} value={trade}>
                  {trade}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-200">
              Distance
            </span>

            <select
              value={radius}
              onChange={(event) =>
                setRadius(Number(event.target.value) as RadiusOption)
              }
              disabled={!companyLocation}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white disabled:opacity-50"
            >
              <option value={10}>Within 10 miles</option>
              <option value={25}>Within 25 miles</option>
              <option value={50}>Within 50 miles</option>
              <option value={100}>Within 100 miles</option>
              <option value={250}>Within 250 miles</option>
            </select>
          </label>

          <label className="flex items-end">
            <span className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5">
              <span className="text-sm font-semibold text-slate-200">
                Online only
              </span>

              <input
                type="checkbox"
                checked={onlineOnly}
                onChange={(event) => setOnlineOnly(event.target.checked)}
                className="h-4 w-4 accent-cyan-400"
              />
            </span>
          </label>

          <div className="flex items-end">
            <div className="w-full rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5">
              <p className="text-xs text-cyan-200">Workers shown</p>
              <p className="text-xl font-bold text-white">
                {filteredWorkers.length}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="h-[620px] w-full">
              <MapContainer
                center={mapCenter}
                zoom={DEFAULT_ZOOM}
                scrollWheelZoom
                className="h-full w-full"
              >
                <RecenterMap center={mapCenter} />

                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {companyLocation ? (
                  <CircleMarker
                    center={[
                      companyLocation.latitude,
                      companyLocation.longitude,
                    ]}
                    radius={10}
                    pathOptions={{
                      color: '#0891b2',
                      fillColor: '#22d3ee',
                      fillOpacity: 0.9,
                    }}
                  >
                    <Popup>Your location</Popup>
                  </CircleMarker>
                ) : null}

                {filteredWorkers.map((worker) => (
                  <CircleMarker
                    key={worker.id}
                    center={[
                      worker.latitude as number,
                      worker.longitude as number,
                    ]}
                    radius={9}
                    pathOptions={{
                      color:
                        worker.is_online === true
                          ? '#047857'
                          : '#475569',
                      fillColor:
                        worker.is_online === true
                          ? '#34d399'
                          : '#94a3b8',
                      fillOpacity: 0.9,
                    }}
                  >
                    <Popup>
                      <div className="min-w-52">
                        <p className="font-bold">
                          {worker.full_name || 'CrewCall Worker'}
                        </p>

                        <p>{worker.trade || 'Trade not listed'}</p>

                        <p>
                          {[worker.city, worker.state]
                            .filter(Boolean)
                            .join(', ') || 'Location not listed'}
                        </p>

                        {worker.distance !== null ? (
                          <p>{worker.distance.toFixed(1)} miles away</p>
                        ) : null}

                        <Link
                          href={`/profile/${worker.id}`}
                          className="mt-3 inline-block font-semibold text-cyan-700"
                        >
                          View profile
                        </Link>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </section>

          <aside className="max-h-[620px] space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-4">
            {filteredWorkers.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-slate-900 p-5 text-center text-sm text-slate-400">
                No workers match these filters.
              </div>
            ) : (
              filteredWorkers.map((worker) => (
                <article
                  key={worker.id}
                  className="rounded-xl border border-white/10 bg-slate-900 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-white">
                        {worker.full_name || 'CrewCall Worker'}
                      </h2>

                      <p className="mt-1 text-sm text-cyan-300">
                        {worker.trade || 'Trade not listed'}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        worker.is_online
                          ? 'bg-emerald-400/15 text-emerald-300'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {worker.is_online ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-slate-300">
                    {[worker.city, worker.state]
                      .filter(Boolean)
                      .join(', ') || 'Location not listed'}
                  </p>

                  {worker.distance !== null ? (
                    <p className="mt-1 text-sm font-semibold text-white">
                      {worker.distance.toFixed(1)} miles away
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {worker.insurance_verified ? (
                      <span className="rounded-full bg-blue-400/15 px-2.5 py-1 text-xs font-semibold text-blue-300">
                        Insurance verified
                      </span>
                    ) : null}

                    {worker.liability_form_verified ? (
                      <span className="rounded-full bg-violet-400/15 px-2.5 py-1 text-xs font-semibold text-violet-300">
                        Liability verified
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    {formatLastUpdated(worker.location_updated_at)}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      href={`/profile/${worker.id}`}
                      className="rounded-lg border border-cyan-400/40 px-3 py-2 text-center text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/10"
                    >
                      View Profile
                    </Link>

                    <Link
                      href={`/workers/${worker.id}/invite`}
                      className="rounded-lg bg-cyan-400 px-3 py-2 text-center text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                    >
                      Invite
                    </Link>
                  </div>
                </article>
              ))
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}