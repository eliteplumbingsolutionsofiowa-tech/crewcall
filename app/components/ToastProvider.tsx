'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Toast = {
  id: string
  title: string
  body: string | null
  link_url: string | null
  created_at: string
}

export default function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [userId, setUserId] = useState<string | null>(null)

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
    if (!userId) return

    const channel = supabase
      .channel(`crewcall-toast-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as Toast

          setToasts((prev) => [
            {
              id: notification.id,
              title: notification.title || 'New Alert',
              body: notification.body || null,
              link_url: notification.link_url || null,
              created_at: notification.created_at,
            },
            ...prev,
          ])

          window.dispatchEvent(new Event('crewcall-refresh-nav'))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  useEffect(() => {
    if (toasts.length === 0) return

    const timeout = setTimeout(() => {
      setToasts((prev) => prev.slice(0, -1))
    }, 6500)

    return () => clearTimeout(timeout)
  }, [toasts])

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed right-4 top-24 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 sm:right-6">
      {toasts.slice(0, 3).map((toast) => (
        <div
          key={toast.id}
          className="rounded-3xl border border-cyan-400/30 bg-slate-950/95 p-4 text-white shadow-2xl shadow-cyan-500/20 backdrop-blur"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                New Alert
              </p>

              <h3 className="mt-1 text-base font-black">
                {toast.title}
              </h3>

              {toast.body && (
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-300">
                  {toast.body}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white hover:bg-white/20"
            >
              ×
            </button>
          </div>

          {toast.link_url && (
            <Link
              href={toast.link_url}
              onClick={() => dismiss(toast.id)}
              className="mt-4 inline-flex rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20"
            >
              Open
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}