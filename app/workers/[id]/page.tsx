'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type WorkerProfile = {
  id: string
  role: string | null
  full_name: string | null
  company_name: string | null
  phone: string | null
  city: string | null
  state: string | null
  trade: string | null
  insurance_provider: string | null
  insurance_policy_number: string | null
  years_experience: string | null
  job_experience: string | null
  liability_form_signed: boolean | null
}

export default function WorkerProfilePage() {
  const params = useParams()
  const router = useRouter()
  const workerId = String(params.id || '')

  const [worker, setWorker] = useState<WorkerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadWorker()
  }, [])

  async function loadWorker() {
    setLoading(true)
    setMessage(null)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', workerId)
      .maybeSingle()

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    if (!data || data.role !== 'worker') {
      setMessage('Worker profile not found.')
      setLoading(false)
      return
    }

    setWorker(data as WorkerProfile)
    setLoading(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8">
          Loading worker profile...
        </div>
      </main>
    )
  }

  if (!worker) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-red-300">{message || 'Worker not found.'}</p>

          <button
            onClick={() => router.back()}
            className="mt-5 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300"
          >
            Go Back
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/jobs" className="text-sm font-semibold text-cyan-300">
          ← Back to jobs
        </Link>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Worker Profile
              </p>

              <h1 className="mt-3 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-4xl font-black text-transparent">
                {worker.full_name || 'Unnamed Worker'}
              </h1>

              <p className="mt-3 text-lg text-slate-300">
                {worker.trade || 'Trade not listed'}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                {[worker.city, worker.state].filter(Boolean).join(', ') ||
                  'Location not listed'}
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-center">
              <div className="text-3xl font-black text-cyan-300">★ 5.0</div>
              <p className="text-xs uppercase tracking-widest text-slate-300">
                Rating Coming Soon
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-3">
          <InfoCard
            title="Experience"
            value={
              worker.years_experience
                ? `${worker.years_experience} years`
                : 'Not listed'
            }
          />

          <InfoCard
            title="Insurance"
            value={worker.insurance_provider || 'Not listed'}
          />

          <InfoCard
            title="Liability Form"
            value={worker.liability_form_signed ? 'Signed' : 'Not signed'}
          />
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <h2 className="text-xl font-bold">Job Experience</h2>

          <p className="mt-4 whitespace-pre-wrap text-slate-300">
            {worker.job_experience ||
              'This worker has not added job experience yet.'}
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <h2 className="text-xl font-bold">Compliance Details</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Detail label="Insurance Provider" value={worker.insurance_provider} />
            <Detail
              label="Policy Number"
              value={worker.insurance_policy_number}
            />
            <Detail label="Phone" value={worker.phone} />
            <Detail
              label="Location"
              value={[worker.city, worker.state].filter(Boolean).join(', ')}
            />
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/messages"
            className="rounded-2xl bg-cyan-400 px-6 py-3 text-center font-bold text-slate-950 shadow-lg shadow-cyan-400/20 hover:bg-cyan-300"
          >
            Message Worker
          </Link>

          <Link
            href="/my-jobs"
            className="rounded-2xl border border-white/10 px-6 py-3 text-center font-semibold text-white hover:bg-white/10"
          >
            Invite to Job
          </Link>
        </div>
      </div>
    </main>
  )
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
      <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
        {title}
      </p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function Detail({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-semibold text-white">{value || 'Not listed'}</p>
    </div>
  )
}