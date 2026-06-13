'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LiveNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let active = true

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!active) return
      setUserId(user?.id || null)
    }

    loadUser()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    function unlockSound() {
      setEnabled(true)

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }

      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume()
      }

      window.removeEventListener('click', unlockSound)
      window.removeEventListener('keydown', unlockSound)
      window.removeEventListener('touchstart', unlockSound)
    }

    window.addEventListener('click', unlockSound)
    window.addEventListener('keydown', unlockSound)
    window.addEventListener('touchstart', unlockSound)

    return () => {
      window.removeEventListener('click', unlockSound)
      window.removeEventListener('keydown', unlockSound)
      window.removeEventListener('touchstart', unlockSound)
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`crewcall-live-sound-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          playTone()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, enabled])

  function playTone() {
    if (!enabled) return

    const audioContext =
      audioContextRef.current || new AudioContext()

    audioContextRef.current = audioContext

    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(
      720,
      audioContext.currentTime
    )

    gain.gain.setValueAtTime(0.0001, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(
      0.18,
      audioContext.currentTime + 0.02
    )
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      audioContext.currentTime + 0.22
    )

    oscillator.connect(gain)
    gain.connect(audioContext.destination)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.24)
  }

  return null
}
