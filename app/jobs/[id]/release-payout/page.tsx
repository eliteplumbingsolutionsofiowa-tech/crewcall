'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ReleasePayoutPage() {
  const params = useParams()
  const router = useRouter()

  const jobId = params.id as string

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function releasePayout() {
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch(
        '/api/stripe/release-payment',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobId,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || 'Unable to release payout'
        )
      }

      setMessage(
        'Payout released successfully!'
      )

      setTimeout(() => {
        router.push('/my-jobs')
      }, 2000)

    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Payout failed'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="max-w-xl w-full rounded-2xl border border-white/10 bg-white/5 p-8 text-center">

        <h1 className="text-3xl font-bold mb-4">
          Release Worker Payout
        </h1>

        <p className="text-slate-300 mb-8">
          This will send the completed job payment
          to the worker's connected Stripe account.
        </p>

        <button
          onClick={releasePayout}
          disabled={loading}
          className="w-full rounded-xl bg-green-500 px-6 py-4 font-bold text-black disabled:opacity-50"
        >
          {loading
            ? 'Processing...'
            : 'Release Payout'}
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
