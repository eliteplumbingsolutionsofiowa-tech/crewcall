'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function StripePageClient() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const sessionId = searchParams.get('session_id')

  const isSuccess = status === 'success' || !!sessionId

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
          CrewCall Payments
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          {isSuccess ? 'Payment Processing' : 'Stripe'}
        </h1>

        <p className="mt-3 text-slate-600">
          {isSuccess
            ? 'Your payment was received by Stripe. CrewCall is checking the payment status and updating the job.'
            : 'This page handles Stripe payment redirects for CrewCall.'}
        </p>

        {sessionId ? (
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
            Session ID: <span className="font-mono">{sessionId}</span>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Company Dashboard
          </Link>

          <Link
            href="/my-jobs"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            My Jobs
          </Link>
        </div>
      </div>
    </main>
  )
}