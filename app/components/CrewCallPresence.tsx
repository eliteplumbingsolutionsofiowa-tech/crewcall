'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type PresenceUpdate = {
  is_online: boolean
  last_seen: string
}

type QueryError = {
  message: string
}

type UpdateEqQuery = {
  eq: (
    column: string,
    value: string
  ) => Promise<{ data: null; error: QueryError | null }>
}

type UpdateTable<TUpdate> = {
  update: (value: TUpdate) => UpdateEqQuery
}

function profilesTable() {
  return supabase.from('profiles') as unknown as UpdateTable<PresenceUpdate>
}

export default function CrewCallPresence() {
  useEffect(() => {
    let mounted = true
    let intervalId: ReturnType<typeof setInterval> | null = null

    async function updatePresence(isOnline: boolean) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !mounted) return

      await profilesTable()
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString(),
        })
        .eq('id', user.id)
    }

    updatePresence(true)

    intervalId = setInterval(() => {
      updatePresence(true)
    }, 30000)

    function handleVisibilityChange() {
      updatePresence(!document.hidden)
    }

    function handleBeforeUnload() {
      updatePresence(false)
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    )

    window.addEventListener(
      'beforeunload',
      handleBeforeUnload
    )

    return () => {
      mounted = false

      if (intervalId) {
        clearInterval(intervalId)
      }

      updatePresence(false)

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      )

      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload
      )
    }
  }, [])

  return null
}