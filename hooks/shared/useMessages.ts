'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type Message = {
  id: string
  conversation_id: string | null
  sender_id: string | null
  recipient_id: string | null
  content: string | null
  is_read: boolean | null
  created_at: string | null
}

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessages([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('messages')
      .select(
        'id,conversation_id,sender_id,recipient_id,content,is_read,created_at'
      )
      .eq('recipient_id', user.id)
      .order('created_at', {
        ascending: false,
      })
      .limit(50)

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    setMessages(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()

    const channel = supabase
      .channel('shared-messages')
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

  return {
    loading,
    messages,
    unread: messages.filter(
      message => message.is_read === false
    ).length,
    refresh: load,
  }
}
