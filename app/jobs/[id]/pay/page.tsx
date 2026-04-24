import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Job = {
  id: string
  title: string | null
  location: string | null
  pay_rate: string | null
  description: string | null
}

function formatPay(payRate: string | null) {
  if (!payRate) return 'Pay not set'

  const value = String(payRate).trim()

  if (value.includes('/hr') || value.includes('/hour')) {
    return value.startsWith('$') ? value : `$${value}`
  }

  const cleaned = value.replace(/[^0-9.]/g, '')
  if (!cleaned) return value

  const num = Number(cleaned)
  if (!Number.isFinite(num)) return value

  return `$${num.toFixed(2)}`
}

export default async function JobPayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  if (!id) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold text-red-600">Pay Page Error</h1>
        <p className="mt-4 text-gray-700">Job ID is missing.</p>

        <Link
          href="/jobs"
          className="mt-6 inline-block rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Back to Jobs
        </Link>
      </main>
    )
  }

  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, location, pay_rate, description')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold text-red-600">Pay Page Error</h1>
        <p className="mt-4 text-gray-700">{error.message}</p>

        <Link
          href="/jobs"
          className="mt-6 inline-block rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Back to Jobs
        </Link>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold">Job not found</h1>
        <p className="mt-4 text-gray-700">
          No matching job was found for this pay page.
        </p>

        <Link
          href="/jobs"
          className="mt-6 inline-block rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Back to Jobs
        </Link>
      </main>
    )
  }

  const job = data as Job

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6">
        <Link
          href={`/jobs/${job.id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Job
        </Link>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">{job.title || 'Untitled Job'}</h1>

        <p className="mt-2 text-gray-600">
          {job.location || 'No location listed'}
        </p>

        <div className="mt-6 rounded-xl border bg-gray-50 p-5">
          <div className="text-sm font-medium text-gray-500">Pay</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">
            {formatPay(job.pay_rate)}
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Raw value: {job.pay_rate || 'empty'}
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-lg font-semibold">Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-gray-700">
            {job.description || 'No description provided.'}
          </p>
        </div>

        <div className="mt-8 flex gap-3">
          <Link
            href="/jobs"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Back to Jobs
          </Link>

          <Link
            href={`/jobs/${job.id}`}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Back to Listing
          </Link>
        </div>
      </div>
    </main>
  )
}