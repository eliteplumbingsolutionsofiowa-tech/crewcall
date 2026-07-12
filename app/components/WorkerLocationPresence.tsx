'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const db = supabase as any

type LocationStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'denied'
  | 'unavailable'
  | 'error'

type WorkerProfile = {
  id: string
  role: string | null
  is_online: boolean | null
  location_visible: boolean | null
}

type Coordinates = {
  latitude: number
  longitude: number
}

const LOCATION_UPDATE_INTERVAL = 5 * 60 * 1000
const LOCATION_MAXIMUM_AGE = 2 * 60 * 1000

export default function WorkerLocationPresence() {
  const [status, setStatus] = useState<LocationStatus>('idle')
  const [message, setMessage] = useState('')
  const [locationVisible, setLocationVisible] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [isWorker, setIsWorker] = useState(false)

  const mountedRef = useRef(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const workerIdRef = useRef<string | null>(null)
  const locationVisibleRef = useRef(false)

  const clearLocationInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const setLocationVisibility = useCallback((visible: boolean) => {
    locationVisibleRef.current = visible
    setLocationVisible(visible)
  }, [])

  const getBrowserCoordinates = useCallback((): Promise<Coordinates> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
        },
        (error) => {
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: LOCATION_MAXIMUM_AGE,
        }
      )
    })
  }, [])

  const saveCoordinates = useCallback(
    async (workerId: string, coordinates: Coordinates) => {
      const { error } = await db
        .from('profiles')
        .update({
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          location_visible: true,
          location_updated_at: new Date().toISOString(),
        })
        .eq('id', workerId)

      if (error) {
        throw new Error(error.message)
      }
    },
    []
  )

  const updateWorkerLocation = useCallback(
    async (showRequestMessage = false) => {
      const workerId = workerIdRef.current

      if (!workerId || !mountedRef.current) {
        return false
      }

      try {
        if (showRequestMessage) {
          setStatus('requesting')
          setMessage('Requesting your location…')
        }

        const coordinates = await getBrowserCoordinates()

        if (!mountedRef.current) {
          return false
        }

        await saveCoordinates(workerId, coordinates)

        if (!mountedRef.current) {
          return false
        }

        setLocationVisibility(true)
        setStatus('active')
        setMessage('Your location is visible to nearby companies.')

        return true
      } catch (error) {
        if (!mountedRef.current) {
          return false
        }

        const locationError = error as {
          code?: number
          message?: string
        }

        if (locationError.code === 1) {
          setStatus('denied')
          setMessage(
            'Location access was denied. Allow location access in your browser settings to appear on the worker map.'
          )
          return false
        }

        if (locationError.code === 2) {
          setStatus('unavailable')
          setMessage(
            'Your location could not be determined. Check your device location settings.'
          )
          return false
        }

        if (locationError.code === 3) {
          setStatus('unavailable')
          setMessage(
            'The location request timed out. Move somewhere with a stronger GPS or network signal and try again.'
          )
          return false
        }

        console.error('Worker location update failed:', error)

        setStatus('error')
        setMessage(
          locationError.message || 'Your location could not be updated.'
        )

        return false
      }
    },
    [getBrowserCoordinates, saveCoordinates, setLocationVisibility]
  )

  const startLocationInterval = useCallback(() => {
    clearLocationInterval()

    intervalRef.current = setInterval(() => {
      void updateWorkerLocation(false)
    }, LOCATION_UPDATE_INTERVAL)
  }, [clearLocationInterval, updateWorkerLocation])

  const disableLocationSharing = useCallback(async () => {
    const workerId = workerIdRef.current

    clearLocationInterval()

    if (!workerId) {
      return
    }

    const { error } = await db
      .from('profiles')
      .update({
        location_visible: false,
      })
      .eq('id', workerId)

    if (error) {
      console.error('Unable to disable location sharing:', error)

      if (mountedRef.current) {
        setStatus('error')
        setMessage('Location sharing could not be turned off.')
      }

      return
    }

    if (mountedRef.current) {
      setLocationVisibility(false)
      setStatus('idle')
      setMessage('Your location is hidden from companies.')
    }
  }, [clearLocationInterval, setLocationVisibility])

  const enableLocationSharing = useCallback(async () => {
    const locationSaved = await updateWorkerLocation(true)

    if (!mountedRef.current || !locationSaved) {
      return
    }

    startLocationInterval()
  }, [startLocationInterval, updateWorkerLocation])

  useEffect(() => {
    mountedRef.current = true

    const initializeLocationPresence = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        console.error('Unable to load location user:', userError)

        if (mountedRef.current) {
          setProfileLoaded(true)
        }

        return
      }

      if (!user || !mountedRef.current) {
        if (mountedRef.current) {
          setProfileLoaded(true)
        }

        return
      }

      const { data, error } = await db
        .from('profiles')
        .select('id, role, is_online, location_visible')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Unable to load worker location profile:', error)

        if (mountedRef.current) {
          setProfileLoaded(true)
        }

        return
      }

      const profile = data as WorkerProfile | null

      if (!profile || profile.role !== 'worker' || !mountedRef.current) {
        if (mountedRef.current) {
          setProfileLoaded(true)
        }

        return
      }

      workerIdRef.current = profile.id
      setIsWorker(true)
      setLocationVisibility(profile.location_visible === true)
      setProfileLoaded(true)

      if (
        profile.is_online === true &&
        profile.location_visible === true
      ) {
        const locationSaved = await updateWorkerLocation(false)

        if (mountedRef.current && locationSaved) {
          startLocationInterval()
        }
      }
    }

    void initializeLocationPresence()

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        locationVisibleRef.current &&
        workerIdRef.current
      ) {
        void updateWorkerLocation(false)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mountedRef.current = false
      clearLocationInterval()

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      )
    }
  }, [
    clearLocationInterval,
    setLocationVisibility,
    startLocationInterval,
    updateWorkerLocation,
  ])

  if (!profileLoaded || !isWorker) {
    return null
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${
                locationVisible
                  ? 'bg-emerald-400 shadow-lg shadow-emerald-400/40'
                  : 'bg-slate-500'
              }`}
            />

            <h2 className="text-lg font-semibold text-white">
              Worker location
            </h2>
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Share your current location so nearby companies can find and
            invite you to work.
          </p>

          {message ? (
            <p
              className={`mt-3 text-sm ${
                status === 'active'
                  ? 'text-emerald-300'
                  : status === 'denied' ||
                      status === 'unavailable' ||
                      status === 'error'
                    ? 'text-amber-300'
                    : 'text-slate-300'
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          {locationVisible ? (
            <>
              <button
                type="button"
                onClick={() => void updateWorkerLocation(true)}
                disabled={status === 'requesting'}
                className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === 'requesting'
                  ? 'Updating…'
                  : 'Update location'}
              </button>

              <button
                type="button"
                onClick={() => void disableLocationSharing()}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Hide location
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void enableLocationSharing()}
              disabled={status === 'requesting'}
              className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'requesting'
                ? 'Requesting location…'
                : 'Share my location'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-400/5 px-4 py-3">
        <p className="text-xs leading-5 text-slate-300">
          CrewCall only stores your most recently reported location. You
          can hide your location at any time.
        </p>
      </div>
    </section>
  )
}