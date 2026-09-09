'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string | null
  company_id: string | null
  assigned_worker_id: string | null
  status: string | null
  payment_status: string | null
  payout_status: string | null
  escrow_status: string | null
  escrow_amount_cents: number | null
  stripe_payment_intent_id: string | null
  stripe_transfer_id: string | null
}

type RefundResponse = {
  success?: boolean
  alreadyRefunded?: boolean
  processing?: boolean
  refundId?: string | null
  amountCents?: number
  status?: string | null
  warning?: string
  error?: string
  code?: string
}

function moneyFromCents(value: number | null) {
  if (typeof value !== 'number') {
    return '$0.00'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value / 100)
}

export default function RefundJobPage() {
  const params = useParams()

  const jobId = useMemo(() => {
    const value = params?.id

    if (Array.isArray(value)) {
      return value[0] || ''
    }

    return typeof value === 'string'
      ? value
      : ''
  }, [params])

  const [job, setJob] =
    useState<Job | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [submitting, setSubmitting] =
    useState(false)

  const [confirmed, setConfirmed] =
    useState(false)

  const [reason, setReason] =
    useState('')

  const [error, setError] =
    useState('')

  const [success, setSuccess] =
    useState('')

  const loadJob = useCallback(async () => {
    if (!jobId) {
      setError('Missing job ID.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError(
        'You must be signed in to manage this payment.'
      )
      setLoading(false)
      return
    }

    const {
      data,
      error: jobError,
    } = await supabase
      .from('jobs')
      .select(
        `
          id,
          title,
          company_id,
          assigned_worker_id,
          status,
          payment_status,
          payout_status,
          escrow_status,
          escrow_amount_cents,
          stripe_payment_intent_id,
          stripe_transfer_id
        `
      )
      .eq('id', jobId)
      .maybeSingle()

    if (jobError) {
      setError(jobError.message)
      setLoading(false)
      return
    }

    if (!data) {
      setError('Job not found.')
      setLoading(false)
      return
    }

    setJob(data as Job)
    setLoading(false)
  }, [jobId])

  useEffect(() => {
    void loadJob()
  }, [loadJob])

  const refundable =
    job?.payment_status === 'paid' &&
    job?.escrow_status === 'funded' &&
    Boolean(job?.stripe_payment_intent_id) &&
    !job?.stripe_transfer_id &&
    job?.payout_status !== 'released' &&
    job?.payout_status !== 'processing'

  async function handleRefund() {
    if (!job || !confirmed || submitting) {
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          'Your session expired. Please sign in again.'
        )
      }

      const response = await fetch(
        '/api/stripe/refund-job',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            jobId: job.id,
            reason: reason.trim() || null,
            confirmed: true,
          }),
        }
      )

      const result =
        (await response
          .json()
          .catch(() => ({}))) as RefundResponse

      if (!response.ok) {
        throw new Error(
          result.error ||
            'Unable to refund this payment.'
        )
      }

      if (result.warning) {
        setSuccess(
          `Stripe accepted the refund. ${result.warning}`
        )
      } else if (result.processing) {
        setSuccess(
          'The refund has been submitted to Stripe and is processing.'
        )
      } else if (result.alreadyRefunded) {
        setSuccess(
          'This payment has already been refunded.'
        )
      } else {
        setSuccess(
          'Payment refunded successfully. The job has been cancelled.'
        )
      }

      setConfirmed(false)
      await loadJob()
    } catch (refundError) {
      setError(
        refundError instanceof Error
          ? refundError.message
          : 'Unable to refund this payment.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-2xl">
          <p className="text-slate-300">
            Loading payment...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/jobs/${jobId}`}
          className="text-sm font-semibold text-blue-300 hover:text-blue-200"
        >
          ← Back to Job
        </Link>

        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="border-b border-slate-800 px-6 py-6 sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">
              Payment Refund
            </p>

            <h1 className="mt-2 text-2xl font-black sm:text-3xl">
              Cancel Job & Refund Payment
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              Use this only when the job will not
              move forward and the worker has not
              been paid.
            </p>
          </div>

          <div className="space-y-6 px-6 py-6 sm:px-8">
            {job && (
              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Job
                </p>

                <p className="mt-1 text-lg font-bold">
                  {job.title || 'CrewCall Job'}
                </p>

                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Refund Amount
                    </p>

                    <p className="mt-1 text-3xl font-black">
                      {moneyFromCents(
                        job.escrow_amount_cents
                      )}
                    </p>
                  </div>

                  <div className="text-right text-sm">
                    <p className="font-semibold text-emerald-300">
                      Funds Secured
                    </p>

                    <p className="mt-1 text-slate-400">
                      Worker payout not released
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!refundable && job && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
                <p className="font-bold text-amber-200">
                  This payment is not eligible for
                  an automatic refund.
                </p>

                <p className="mt-2 text-sm leading-6 text-amber-100/80">
                  CrewCall only allows this refund
                  flow while the payment is secured
                  and before the worker payout has
                  started.
                </p>
              </div>
            )}

            {refundable && (
              <>
                <div>
                  <label
                    htmlFor="refund-reason"
                    className="text-sm font-bold text-slate-200"
                  >
                    Reason for cancellation
                  </label>

                  <textarea
                    id="refund-reason"
                    value={reason}
                    onChange={(event) =>
                      setReason(event.target.value)
                    }
                    rows={4}
                    maxLength={1000}
                    placeholder="Optional — tell us why the job is being cancelled."
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
                  />
                </div>

                <label className="flex cursor-pointer gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-5">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) =>
                      setConfirmed(
                        event.target.checked
                      )
                    }
                    className="mt-1 h-5 w-5 shrink-0"
                  />

                  <span>
                    <span className="block font-bold text-red-100">
                      I confirm this job is being
                      cancelled and authorize
                      CrewCall to refund the secured
                      payment.
                    </span>

                    <span className="mt-2 block text-sm leading-6 text-red-100/75">
                      The worker payout must not
                      have been released. After the
                      refund succeeds, CrewCall will
                      mark this job cancelled and
                      refunded.
                    </span>
                  </span>
                </label>
              </>
            )}

            {error && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-200">
                {success}
              </div>
            )}

            {refundable && (
              <button
                type="button"
                onClick={handleRefund}
                disabled={
                  !confirmed || submitting
                }
                className="w-full rounded-2xl bg-red-600 px-5 py-4 text-base font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting
                  ? 'Processing Refund...'
                  : `Cancel Job & Refund ${moneyFromCents(
                      job?.escrow_amount_cents ??
                        null
                    )}`}
              </button>
            )}

            <p className="text-center text-xs leading-5 text-slate-500">
              Refund timing at the customer&apos;s
              bank may vary after Stripe processes
              the refund.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
