'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatPayRate } from '@/lib/formatPayRate'

type Job = {
  id: string
  title: string
  assigned_worker_id: string | null
  status: string | null
  pay_rate: string | null
  payment_status: string | null
}

export default function PayPage() {
  const t = useTranslations('JobPayment')
  const params = useParams()
  const jobId = String(params.id || '')

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [finalAmount, setFinalAmount] = useState('')

  useEffect(() => {
    loadJob()
  }, [jobId])

  async function loadJob() {
    setLoading(true)
    setMessage(null)

    const { data, error } = await supabase
      .from('jobs')
      .select('id, title, assigned_worker_id, status, pay_rate, payment_status')
      .eq('id', jobId)
      .eq('is_test', false)
      .maybeSingle()

    if (error || !data) {
      setJob(null)
    } else {
      setJob(data as Job)
    }

    setLoading(false)
  }

  async function handlePay() {
    if (!job) return

    setPaying(true)
    setMessage(null)

    if (!job.assigned_worker_id) {
      setMessage('No worker assigned to this job yet.')
      setPaying(false)
      return
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setMessage('Authorization token required.')
      setPaying(false)
      return
    }

    const amount = finalAmount.trim()

    if (!amount) {
      setMessage('Enter the final payment amount for this job.')
      setPaying(false)
      return
    }

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        jobId: job.id,
        amount,
      }),
    })

    const text = await res.text()

    let result: any = {}

    try {
      result = JSON.parse(text)
    } catch {
      console.error('RAW NON-JSON RESPONSE:', text)
      setMessage(
        'Server did not return JSON. Check app/api/stripe/checkout/route.ts.'
      )
      setPaying(false)
      return
    }

    if (
      res.ok &&
      result.reconciled === true &&
      result.paymentStatus === 'paid'
    ) {
      window.location.href = `/jobs/${job.id}`
      return
    }

    if (!res.ok || !result.url) {
      setMessage(result.error || 'Could not start payment.')
      setPaying(false)
      return
    }

    window.location.href = result.url
  }

  if (loading) return <div className="p-6">{t('loading')}</div>

  if (!job) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">{t('jobNotFound')}</h1>
        <Link href="/jobs" className="text-blue-600">
          {t('backToJobs')}
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-xl rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold">{t('title')}</h1>

        <div className="mt-6 space-y-2 text-gray-700">
          <p>
            <strong>{t('job')}:</strong> {job.title}
          </p>

          <p>
            <strong>Status:</strong> {job.status || 'Open'}
          </p>

          <p>
            <strong>{t('payment')}:</strong> {job.payment_status || t('unpaid')}
          </p>

          <p>
            <strong>Agreed Rate:</strong> {formatPayRate(job.pay_rate)}
          </p>
        </div>

        <div className="mt-6">
          <label
            htmlFor="final-payment-amount"
            className="mb-2 block text-sm font-bold text-gray-700"
          >
            Final Job Amount
          </label>

          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-semibold text-gray-500">
              $
            </span>

            <input
              id="final-payment-amount"
              type="text"
              inputMode="decimal"
              value={finalAmount}
              onChange={(event) =>
                setFinalAmount(event.target.value)
              }
              placeholder="0.00"
              className="w-full rounded-xl border border-gray-300 py-3 pl-8 pr-4 text-lg font-semibold text-gray-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <p className="mt-2 text-sm text-gray-500">
            Enter the total amount being paid for this completed job.
          </p>
        </div>

        {!job.assigned_worker_id && (
          <div className="mt-4 rounded-xl bg-yellow-50 p-3 text-yellow-800">
            A worker must be assigned before payment can be sent.
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">
            {message}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={handlePay}
            disabled={paying || !job.assigned_worker_id}
            className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {paying ? t('openingStripe') : t('sendPayment')}
          </button>

          <Link
            href={`/jobs/${job.id}`}
            className="rounded-xl border px-5 py-3 font-semibold hover:bg-gray-100"
          >
            {t('backToJob')}
          </Link>
        </div>
      </div>
    </main>
  )
}
