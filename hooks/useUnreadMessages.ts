'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useUnreadMessages() {
  const [count, setCount] = useState(0)

  async function load() {
    const { count, error } = await supabase
      .from('messages')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('is_read', false)

    if (error) {
      console.error(error)
      return
    }

    setCount(count ?? 0)
  }

  useEffect(() => {
    load()

    const channel = supabase
      .channel('mission-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          load()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return count
}
