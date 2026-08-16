'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('WorkerLocation')
  const [status, setStatus] = useState<LocationStatus>('idle')
  const [message, setMessage] = useState('')
  const [locationVisible, setLocationVisible] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [isWorker, setIsWorker] = useState(false)
  const [saving, setSaving] = useState(false)

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
        reject(new Error(t('geolocationUnsupported')))
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
        setSaving(true)

        if (showRequestMessage) {
          setStatus('requesting')
          setMessage(t('requestingCurrent'))
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
        setMessage(
          t('visibleMessage')
        )

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
            t('accessDenied')
          )
          return false
        }

        if (locationError.code === 2) {
          setStatus('unavailable')
          setMessage(
            t('couldNotDetermine')
          )
          return false
        }

        if (locationError.code === 3) {
          setStatus('unavailable')
          setMessage(
            t('timedOut')
          )
          return false
        }

        setStatus('error')
        setMessage(
          locationError.message || t('couldNotUpdate')
        )

        return false
      } finally {
        if (mountedRef.current) {
          setSaving(false)
        }
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

    if (!workerId || saving) {
      return
    }

    const confirmed = window.confirm(
      t('hideConfirm')
    )

    if (!confirmed) {
      return
    }

    clearLocationInterval()
    setSaving(true)
    setMessage(t('hiding'))

    const { error } = await db
      .from('profiles')
      .update({
        location_visible: false,
        latitude: null,
        longitude: null,
        location_updated_at: null,
      })
      .eq('id', workerId)

    if (error) {
      if (mountedRef.current) {
        setStatus('error')
        setMessage(t('couldNotTurnOff'))
        setSaving(false)
      }

      return
    }

    if (mountedRef.current) {
      setLocationVisibility(false)
      setStatus('idle')
      setMessage(
        t('hiddenMessage')
      )
      setSaving(false)
    }
  }, [clearLocationInterval, saving, setLocationVisibility])

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

      if (userError || !user) {
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

      if (profile.location_visible === true) {
        setStatus('active')
        setMessage(
          t('visibleMessage')
        )
      } else {
        setStatus('idle')
        setMessage(
          t('hiddenShareMessage')
        )
      }

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

  const statusMessageClass =
    status === 'active'
      ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
      : status === 'denied' ||
          status === 'unavailable' ||
          status === 'error'
        ? 'border-amber-400/25 bg-amber-400/10 text-amber-200'
        : status === 'requesting'
          ? 'border-cyan-400/25 bg-cyan-400/10 text-cyan-200'
          : 'border-white/10 bg-slate-950/60 text-slate-300'

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-950 shadow-2xl">
      <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/20 via-slate-900 to-blue-500/20 px-6 py-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full ${
                  locationVisible
                    ? 'bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.75)]'
                    : 'bg-slate-500'
                }`}
              />

              <h2 className="text-xl font-black text-white">
                {t('title')}
              </h2>
            </div>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              {t('description')}
            </p>
          </div>

          <span
            className={`w-fit rounded-full px-4 py-2 text-sm font-black ${
              locationVisible
                ? 'border border-emerald-400/25 bg-emerald-400/15 text-emerald-200'
                : 'border border-white/10 bg-white/10 text-slate-300'
            }`}
          >
            {locationVisible ? t('locationOn') : t('locationOff')}
          </span>
        </div>
      </div>

      <div className="bg-slate-950 p-6">
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${statusMessageClass}`}
        >
          {message}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {locationVisible ? (
            <>
              <button
                type="button"
                onClick={() => void updateWorkerLocation(true)}
                disabled={saving}
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? t('updating') : t('updateLocation')}
              </button>

              <button
                type="button"
                onClick={() => void disableLocationSharing()}
                disabled={saving}
                className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-3 text-sm font-black text-red-200 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('hideLocation')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void enableLocationSharing()}
              disabled={saving}
              className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? t('requestingLocation') : t('shareLocation')}
            </button>
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3">
          <p className="text-xs leading-5 text-cyan-100">
            {t('privacyNote')}
          </p>
        </div>
      </div>
    </section>
  )
}