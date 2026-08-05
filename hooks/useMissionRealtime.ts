'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  refresh: () => void
}

export function useMissionRealtime({
  refresh,
}: Props) {
  useEffect(() => {
    const channel = supabase
      .channel('mission-control')

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
        },
        refresh
      )

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        refresh
      )

      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])
}
