'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type Notification = {
  id: string
  title: string | null
  body: string | null
  is_read: boolean | null
  read: boolean | null
  created_at: string | null
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setNotifications([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('notifications')
      .select(
        'id,title,body,is_read,read,created_at'
      )
      .eq('user_id', user.id)
      .order('created_at', {
        ascending: false,
      })
      .limit(20)

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    setNotifications(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()

    const id = setInterval(load, 30000)

    return () => clearInterval(id)
  }, [])

  return {
    notifications,
    loading,
    unread: notifications.filter(
      n => !n.is_read && !n.read
    ).length,
    refresh: load,
  }
}
