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

  const icon = success ? '✓' : loading ? '…' : '!'

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-orange-100 px-4 py-10">
      <div className="absolute left-[-80px] top-32 h-60 w-60 rounded-full bg-blue-300/30 blur-3xl" />
      <div className="absolute right-[-80px] top-20 h-72 w-72 rounded-full bg-orange-300/40 blur-3xl" />
      <div className="absolute bottom-[-100px] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-purple-300/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-[75vh] max-w-4xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-2xl shadow-blue-900/10 backdrop-blur md:p-10">
          <div className="mx-auto mb-7 flex h-24 w-24 items-center justify-center rounded-full bg-green-100 shadow-inner">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full text-4xl font-black text-white shadow-lg ${
                success
                  ? 'bg-gradient-to-br from-green-400 to-emerald-600'
                  : loading
                    ? 'bg-gradient-to-br from-blue-400 to-blue-700'
                    : 'bg-gradient-to-br from-yellow-400 to-orange-600'
              }`}
            >
              {icon}
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-4xl font-black tracking-tight text-gray-950 md:text-6xl">
              {success ? (
                <>
                  Payment{' '}
                  <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-orange-500 bg-clip-text text-transparent">
                    Successful!
                  </span>
                </>
              ) : (
                'Stripe Payment'
              )}
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-base font-medium text-gray-600 md:text-lg">
              {message}
            </p>
          </div>

          <div className="my-8 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

          <div className="mx-auto flex max-w-xl items-center justify-center gap-4 rounded-3xl bg-gray-50 p-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 text-3xl">
              🔧
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Job
              </p>
              <p className="text-2xl font-black text-gray-950">
                {job?.title || 'CrewCall Job'}
              </p>

              {success && (
                <span className="mt-2 inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-700">
                  ✓ Completed
                </span>
              )}
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {job?.id && (
              <Link
                href={`/jobs/${job.id}/review`}
                className="rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-5 py-4 text-center text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:scale-[1.02]"
              >
                ★ Leave Review
              </Link>
            )}

            <Link
              href="/completed-jobs"
              className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-4 text-center text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.02]"
            >
              Completed Jobs
            </Link>

            <Link
              href="/my-jobs"
              className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-center text-sm font-black text-gray-900 shadow-sm transition hover:scale-[1.02] hover:bg-gray-50"
            >
              My Jobs
            </Link>

            <Link
              href="/dashboard"
              className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-center text-sm font-black text-gray-900 shadow-sm transition hover:scale-[1.02] hover:bg-gray-50"
            >
              Dashboard
            </Link>
          </div>

          <div className="mt-8 rounded-3xl bg-gradient-to-r from-blue-600 via-purple-600 to-orange-500 p-5 text-white shadow-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-black">Thanks for using CrewCall.</p>
                <p className="text-sm text-white/85">
                  Together, we get the job done.
                </p>
              </div>

              <Link
                href="/messages"
                className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-black text-blue-700 transition hover:bg-blue-50"
              >
                Go to Messages
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function StripeSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-100 px-6 py-10">
          <div className="mx-auto max-w-xl rounded-3xl border border-white bg-white/90 p-8 shadow-xl">
            <h1 className="text-2xl font-black text-gray-900">
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