'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function PushTestPage() {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function sendTestPush() {
    setSending(true)
    setMessage('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setMessage('Please log in first.')
        return
      }

      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const result = await response
        .json()
        .catch(() => null)

      if (!response.ok) {
        setMessage(
          result?.error ||
            `Push test failed (${response.status})`
        )
        return
      }

      setMessage(
        JSON.stringify(result, null, 2)
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Push test failed.'
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-3xl font-black">
          CrewCall Push Test
        </h1>

        <p className="mt-3 text-slate-300">
          Sends a test notification to your registered iPhone.
        </p>

        <button
          type="button"
          onClick={() => void sendTestPush()}
          disabled={sending}
          className="mt-8 rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 disabled:opacity-50"
        >
          {sending
            ? 'Sending...'
            : 'Send Test Push'}
        </button>

        {message ? (
          <pre className="mt-6 whitespace-pre-wrap break-words rounded-2xl bg-black/30 p-4 text-sm">
            {message}
          </pre>
        ) : null}
      </div>
    </main>
  )
}
