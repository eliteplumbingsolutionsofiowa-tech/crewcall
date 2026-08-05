'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useUnreadNotifications() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    async function load() {
      const { count } = await supabase
        .from('notifications')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('read', false)

      setCount(count ?? 0)
    }

    load()

    const channel = supabase
      .channel('notifications')

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        load
      )

      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return count
}
