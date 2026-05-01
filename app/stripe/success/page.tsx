'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  payment_status: string | null
  status: string | null
}

function StripeSuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Confirming payment...')
  const [success, setSuccess] = useState(false)
  const [job, setJob] = useState<Job | null>(null)

  useEffect(() => {
    confirmPayment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  async function confirmPayment() {
    setLoading(true)
    setSuccess(false)

    if (!sessionId) {
      setMessage('Missing Stripe session ID.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('jobs')
      .select('id, title, payment_status, status')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle()

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    if (!data) {
      setMessage(
        'Payment finished, but CrewCall could not find the matching job. Go back to My Jobs and refresh.'
      )
      setLoading(false)
      return
    }

    const foundJob = data as Job
    setJob(foundJob)

    if (
      foundJob.payment_status === 'paid' &&
      foundJob.status === 'completed'
    ) {
      setMessage('Payment already confirmed. This job is completed.')
      setSuccess(true)
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        payment_status: 'paid',
        status: 'completed',
        paid_at: new Date().toISOString(),
      })
      .eq('id', foundJob.id)

    if (updateError) {
      setMessage(updateError.message)
      setLoading(false)
      return
    }

    setJob({
      ...foundJob,
      payment_status: 'paid',
      status: 'completed',
    })

    setMessage('Payment confirmed. This job is now completed.')
    setSuccess(true)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div
          className={`mb-5 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold ${
            success
              ? 'bg-green-100 text-green-700'
              : loading
                ? 'bg-blue-100 text-blue-700'
                : 'bg-yellow-100 text-yellow-700'
          }`}
        >
          {success ? '✓' : loading ? '…' : '!'}
        </div>

        <h1 className="mb-3 text-2xl font-bold text-gray-900">
          {success ? 'Payment Successful' : 'Stripe Payment'}
        </h1>

        {job?.title && (
          <p className="mb-2 text-sm font-semibold text-gray-900">
            Job: {job.title}
          </p>
        )}

        <p className="mb-6 text-gray-600">{message}</p>

        <div className="flex flex-wrap gap-3">
          {job?.id && (
            <Link
              href={`/jobs/${job.id}/review`}
              className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600"
            >
              Leave Review
            </Link>
          )}

          <Link
            href="/completed-jobs"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Completed Jobs
          </Link>

          <Link
            href="/my-jobs"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            My Jobs
          </Link>

          <Link
            href="/dashboard"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function StripeSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 px-6 py-10">
          <div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">
              Loading payment...
            </h1>
            <p className="mt-3 text-gray-600">Confirming Stripe payment.</p>
          </div>
        </main>
      }
    >
      <StripeSuccessContent />
    </Suspense>
  )
}