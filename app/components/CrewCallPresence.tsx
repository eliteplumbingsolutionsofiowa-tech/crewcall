'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function CrewCallPresence() {
  useEffect(() => {
    let mounted = true
    let intervalId: ReturnType<typeof setInterval> | null = null

    async function setPresence(isOnline: boolean) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !mounted) return

      await supabase
        .from('profiles')
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString(),
        })
        .eq('id', user.id)
    }

    // -----------------------------
    // INITIAL ONLINE STATUS
    // -----------------------------
    setPresence(true)

    // -----------------------------
    // HEARTBEAT (keeps user alive)
    // -----------------------------
    intervalId = setInterval(() => {
      if (!document.hidden) {
        setPresence(true)
      }
    }, 30000)

    // -----------------------------
    // TAB VISIBILITY HANDLER
    // -----------------------------
    function handleVisibilityChange() {
      setPresence(!document.hidden)
    }

    // -----------------------------
    // LEAVE PAGE HANDLER
    // -----------------------------
    function handleBeforeUnload() {
      setPresence(false)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    // -----------------------------
    // REAL-TIME NOTIFICATIONS
    // -----------------------------
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          window.dispatchEvent(
            new CustomEvent('new-notification', {
              detail: payload.new,
            })
          )
        }
      )
      .subscribe()

    // -----------------------------
    // CLEANUP
    // -----------------------------
    return () => {
      mounted = false

      if (intervalId) {
        clearInterval(intervalId)
      }

      setPresence(false)

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      )

      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload
      )

      supabase.removeChannel(channel)
    }
  }, [])

  return null
}