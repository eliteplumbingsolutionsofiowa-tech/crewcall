'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Check = {
  label: string
  value: string
  status: 'good' | 'warning' | 'bad'
}

export default function LaunchReadinessPage() {
  const [checks, setChecks] = useState<Check[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {

      const [
        profilesResult,
        jobsResult,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'role, insurance_verified, liability_form_verified'
          ),

        supabase
          .from('jobs')
          .select(
            'status, payment_status'
          ),
      ])

      const profiles = profilesResult.data || []
      const jobs = jobsResult.data || []

      const workers = profiles.filter(
        (p) => p.role === 'worker'
      )

      const companies = profiles.filter(
        (p) => p.role === 'company'
      )

      const verifiedWorkers = workers.filter(
        (w) =>
          w.insurance_verified &&
          w.liability_form_verified
      )

      const openJobs = jobs.filter(
        (j) => j.status === 'open'
      )

      const paidJobs = jobs.filter(
        (j) => j.payment_status === 'paid'
      )

      setChecks([
        {
          label: 'Workers',
          value: String(workers.length),
          status:
            workers.length > 0
              ? 'good'
              : 'bad',
        },

        {
          label: 'Companies',
          value: String(companies.length),
          status:
            companies.length > 0
              ? 'good'
              : 'bad',
        },

        {
          label: 'Verified Workers',
          value: String(verifiedWorkers.length),
          status:
            verifiedWorkers.length > 0
              ? 'good'
              : 'warning',
        },

        {
          label: 'Open Jobs',
          value: String(openJobs.length),
          status:
            openJobs.length > 0
              ? 'good'
              : 'warning',
        },

        {
          label: 'Paid Jobs',
          value: String(paidJobs.length),
          status:
            paidJobs.length > 0
              ? 'good'
              : 'warning',
        },
      ])

      setLoading(false)
    }

    load()
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        Loading launch readiness...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">

      <div className="mx-auto max-w-6xl">

        <h1 className="text-4xl font-black">
          CrewCall Launch Readiness
        </h1>

        <p className="mt-2 text-slate-400">
          Pre-launch health check for the marketplace.
        </p>


        <div className="mt-8 grid gap-5 md:grid-cols-2">

          {checks.map((check) => (

            <div
              key={check.label}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >

              <p className="text-sm text-slate-400">
                {check.label}
              </p>

              <p className="mt-2 text-4xl font-black">
                {check.value}
              </p>

              <p className={
                check.status === 'good'
                  ? 'mt-2 text-emerald-400'
                  : check.status === 'warning'
                    ? 'mt-2 text-yellow-400'
                    : 'mt-2 text-red-400'
              }>
                {check.status.toUpperCase()}
              </p>

            </div>

          ))}

        </div>

      </div>

    </main>
  )
}
