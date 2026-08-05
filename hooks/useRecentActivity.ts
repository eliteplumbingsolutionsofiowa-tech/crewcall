'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type Activity = {
  id: string
  title: string
  created_at: string | null
}

export function useRecentActivity() {
  const [items, setItems] = useState<Activity[]>([])

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('jobs')
        .select('id,title,created_at')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error(error)
        return
      }

      setItems(data ?? [])
    }

    load()
  }, [])

  return items
}
