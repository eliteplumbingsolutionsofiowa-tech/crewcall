'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ReleasePayoutPage() {
  const params = useParams()
  const router = useRouter()

  const jobId = String(params?.id || '')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleRelease() {
    if (!jobId) {
      setMessage('Missing job ID')
      return
    }

    const confirmed = window.confirm(
      'Are you sure you want to release this worker payout?'
    )

    if (!confirmed) return

    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/stripe/release-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Release payout failed')
      }

      setSuccess(true)
      setMessage(
        data.alreadyReleased
          ? 'Payout was already released.'
          : 'Worker payout released successfully.'
      )

      setTimeout(() => {
        router.push('/company/dashboard')
      }, 3000)

    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">

      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-10 shadow-2xl">

        <div className="text-center">

          {success ? (
            <>
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-500/20 text-5xl">
                ✓
              </div>

              <h1 className="text-4xl font-black mb-4">
                Payment Released
              </h1>

              <p className="text-slate-300 text-lg">
                The worker payout has been successfully sent through Stripe.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-black mb-4">
                Release Worker Payout
              </h1>

              <p className="text-slate-300 mb-8">
                Confirm that the job is complete and release payment to the worker.
              </p>
            </>
          )}

        </div>


        <div className="rounded-2xl bg-black/30 border border-white/10 p-5 mb-8">

          <div className="text-sm text-slate-400 mb-2">
            Job ID
          </div>

          <div className="break-all font-mono text-sm">
            {jobId}
          </div>

        </div>


        {!success && (
          <button
            onClick={handleRelease}
            disabled={loading}
            className="w-full rounded-2xl bg-green-500 px-6 py-5 text-xl font-black text-black hover:bg-green-400 disabled:opacity-50"
          >
            {loading
              ? 'Processing Payment...'
              : 'Release Payout'}
          </button>
        )}


        {message && (
          <div
            className={`mt-6 rounded-2xl p-5 text-center font-semibold ${
              success
                ? 'bg-green-500/20 text-green-300'
                : 'bg-white/10 text-white'
            }`}
          >
            {message}
          </div>
        )}

      </div>

    </main>
  )
}
