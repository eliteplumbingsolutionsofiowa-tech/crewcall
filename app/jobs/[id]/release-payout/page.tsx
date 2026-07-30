'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ReleasePayoutPage() {
  const params = useParams()
  const router = useRouter()

  const jobId = String(params?.id || '')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleRelease() {
    if (!jobId) {
      setMessage('Missing job ID')
      return
    }

    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Authorization token missing. Please log in again.')
      }

      const res = await fetch('/api/stripe/release-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          jobId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Release payout failed')
      }

      setMessage('Payout released successfully.')

      setTimeout(() => {
        router.push('/my-jobs')
      }, 2000)

    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : 'Something went wrong'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8">

        <h1 className="text-3xl font-bold mb-4">
          Release Worker Payout
        </h1>

        <p className="text-slate-300 mb-6">
          Job ID:
        </p>

        <div className="rounded-lg bg-black/30 p-3 text-sm mb-6 break-all">
          {jobId}
        </div>

        <button
          onClick={handleRelease}
          disabled={loading}
          className="w-full rounded-xl bg-green-500 px-6 py-4 font-bold text-black"
        >
          {loading ? 'Processing...' : 'Release Payout'}
        </button>

        {message && (
          <div className="mt-6 rounded-xl bg-white/10 p-4">
            {message}
          </div>
        )}

      </div>
    </main>
  )
}
