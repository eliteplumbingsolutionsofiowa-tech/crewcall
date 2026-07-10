'use client'

import { useEffect, useRef, useState } from 'react'

const GOOGLE_MAPS_SCRIPT_ID = 'crewcall-google-maps-script'

export type MapWorker = {
  id: string
  full_name: string | null
  company_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  available_for_work: boolean | null
  currently_working: boolean | null
  is_online: boolean | null
  last_seen: string | null
}

type WorkerGoogleMapProps = {
  workers: MapWorker[]
  selectedWorkerId: string | null
  onSelectWorker: (workerId: string) => void
}

const defaultCenter = {
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

export default function WorkerGoogleMap({
  workers,
  selectedWorkerId,
  onSelectWorker,
}: WorkerGoogleMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map())

  const [mapReady, setMapReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function initializeGoogleMaps() {
      try {
        setError('')

        await loadGoogleMapsScript()

        if (cancelled || !mapElementRef.current) return

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapElementRef.current, {
            center: defaultCenter,
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
      } catch (caughtError) {
        console.error('Google Maps initialization failed:', caughtError)
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Google Maps could not be loaded.',
        )
      }
    }

    void initializeGoogleMaps()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current.clear()

    const validWorkers = workers.filter(hasCoordinates)

    if (validWorkers.length === 0) {
      mapRef.current.setCenter(defaultCenter)
      mapRef.current.setZoom(8)
      return
    }

    const bounds = new google.maps.LatLngBounds()

    validWorkers.forEach((worker) => {
      const position = {
        lat: worker.latitude as number,
        lng: worker.longitude as number,
      }

      bounds.extend(position)

      const marker = new google.maps.Marker({
        map: mapRef.current,
        position,
        title: getWorkerName(worker),
        icon: createMarkerIcon(worker, worker.id === selectedWorkerId),
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

    if (validWorkers.length === 1) {
      mapRef.current.setCenter({
        lat: validWorkers[0].latitude as number,
        lng: validWorkers[0].longitude as number,
      })
      mapRef.current.setZoom(11)
    } else {
      mapRef.current.fitBounds(bounds, 70)

      google.maps.event.addListenerOnce(
        mapRef.current,
        'bounds_changed',
        () => {
          if (mapRef.current && (mapRef.current.getZoom() || 0) > 12) {
            mapRef.current.setZoom(12)
          }
        },
      )
    }
  }, [mapReady, workers, selectedWorkerId, onSelectWorker])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedWorkerId) return

    const worker = workers.find((item) => item.id === selectedWorkerId)

    if (!worker || !hasCoordinates(worker)) return

    mapRef.current.panTo({
      lat: worker.latitude,
      lng: worker.longitude,
    })

    if ((mapRef.current.getZoom() || 0) < 11) {
      mapRef.current.setZoom(11)
    }
  }, [mapReady, selectedWorkerId, workers])

  return (
    <div className="relative min-h-[620px] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl">
      <div ref={mapElementRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-5 top-5 z-10 rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 shadow-xl backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          Worker Availability
        </p>

        <p className="mt-1 text-sm font-bold text-slate-300">
          {workers.filter(hasCoordinates).length} visible on map
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

      {!mapReady && !error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-cyan-400" />
            <p className="mt-5 font-black text-white">Loading Google Maps...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950 p-6">
          <div className="max-w-lg rounded-[2rem] border border-red-400/30 bg-red-500/10 p-8 text-center">
            <p className="text-4xl">🗺️</p>
            <h2 className="mt-5 text-2xl font-black text-white">
              Map unavailable
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-red-100">
              {error}
            </p>
          </div>
        </div>
      )}
    </div>
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
      existingScript.addEventListener('load', () => resolve(), {
        once: true,
      })

      existingScript.addEventListener(
        'error',
        () => reject(new Error('Google Maps script failed to load.')),
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
      () => reject(new Error('Google Maps script failed to load.')),
      { once: true },
    )

    document.head.appendChild(script)
  })
}

function createMarkerIcon(worker: MapWorker, selected: boolean) {
  const available =
    Boolean(worker.available_for_work) &&
    !Boolean(worker.currently_working)

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

function hasCoordinates(
  worker: MapWorker,
): worker is MapWorker & {
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

function getWorkerName(worker: MapWorker) {
  return worker.full_name || worker.company_name || 'CrewCall Worker'
}

function isActuallyOnline(worker: MapWorker) {
  if (!worker.is_online || !worker.last_seen) return false

  const lastSeen = new Date(worker.last_seen).getTime()

  if (Number.isNaN(lastSeen)) return false

  return Date.now() - lastSeen < 90_000
}