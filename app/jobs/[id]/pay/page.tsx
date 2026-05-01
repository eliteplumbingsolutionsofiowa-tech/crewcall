'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string
  assigned_worker_id: string | null
  status: string | null
  pay_rate: string | null
  payment_status: string | null
}

export default function PayPage() {
  const params = useParams()
  const jobId = String(params.id || '')

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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

    const amount = job.pay_rate || '0'

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id, amount }),
    })

    const text = await res.text()

    let result: any = {}

    try {
      result = JSON.parse(text)
    } catch {
      console.error('RAW NON-JSON RESPONSE:', text)
      setMessage('Server did not return JSON. Check app/api/checkout/route.ts.')
      setPaying(false)
      return
    }

    if (!res.ok || !result.url) {
      setMessage(result.error || 'Could not start payment.')
      setPaying(false)
      return
    }

    window.location.href = result.url
  }

  if (loading) return <div className="p-6">Loading...</div>

  if (!job) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Job not found</h1>
        <Link href="/jobs" className="text-blue-600">
          Back to Jobs
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-xl rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold">Pay Worker</h1>

        <div className="mt-6 space-y-2 text-gray-700">
          <p>
            <strong>Job:</strong> {job.title}
          </p>

          <p>
            <strong>Status:</strong> {job.status || 'Open'}
          </p>

          <p>
            <strong>Payment:</strong> {job.payment_status || 'unpaid'}
          </p>

          <p>
            <strong>Amount:</strong> {job.pay_rate || '$0'}
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
            {paying ? 'Opening Stripe...' : 'Send Payment'}
          </button>

          <Link
            href={`/jobs/${job.id}`}
            className="rounded-xl border px-5 py-3 font-semibold hover:bg-gray-100"
          >
            Back to Job
          </Link>
        </div>
      </div>
    </main>
  )
}