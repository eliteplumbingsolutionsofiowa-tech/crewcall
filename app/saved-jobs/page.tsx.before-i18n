'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Company = {
  company_name: string | null
  full_name: string | null
  insurance_status: string | null
  liability_status: string | null
}

type Job = {
  id: string
  title: string
  description: string | null
  trade: string
  location: string
  pay_rate: string | null
  status: string
  company_id: string
  company: Company | null
}

type RawJob = Omit<Job, 'company'> & {
  company: Company | Company[] | null
}

type SavedJobRow = {
  job_id: string
}

type SavedJobInsert = {
  worker_id: string
  job_id: string
}

function firstOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [savedJobIds, setSavedJobIds] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [trade, setTrade] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [openOnly, setOpenOnly] = useState(false)

  const loadJobs = useCallback(async () => {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    setUserId(user?.id ?? null)

    const { data } = await supabase
      .from('jobs')
      .select(
        `
        *,
        company:company_id (
          company_name,
          full_name,
          insurance_status,
          liability_status
        )
      `
      )
      .order('created_at', { ascending: false })
      .returns<RawJob[]>()

    const cleanedJobs: Job[] = (data ?? []).map((job) => ({
      ...job,
      company: firstOrNull(job.company),
    }))

    setJobs(cleanedJobs)

    if (user) {
      const { data: savedData } = await supabase
        .from('saved_jobs')
        .select('job_id')
        .eq('worker_id', user.id)
        .returns<SavedJobRow[]>()

      setSavedJobIds((savedData ?? []).map((item) => item.job_id).filter(Boolean))
    } else {
      setSavedJobIds([])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  async function toggleSaveJob(jobId: string) {
    if (!userId) {
      alert('Please log in to save jobs.')
      return
    }

    const alreadySaved = savedJobIds.includes(jobId)

    if (alreadySaved) {
      await supabase
        .from('saved_jobs')
        .delete()
        .match({
          worker_id: userId,
          job_id: jobId,
        })

      setSavedJobIds((prev) => prev.filter((id) => id !== jobId))
      return
    }

    const payload: SavedJobInsert = {
      worker_id: userId,
      job_id: jobId,
    }

    await supabase.from('saved_jobs').insert(payload)

    setSavedJobIds((prev) => [...prev, jobId])
  }

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch = job.location
        .toLowerCase()
        .includes(search.toLowerCase())

      const matchesTrade = trade ? job.trade === trade : true

      const isVerified =
        job.company?.insurance_status === 'verified' &&
        job.company?.liability_status === 'verified'

      const matchesVerified = verifiedOnly ? isVerified : true

      const matchesOpen = openOnly ? job.status === 'open' : true

      return matchesSearch && matchesTrade && matchesVerified && matchesOpen
    })
  }, [jobs, search, trade, verifiedOnly, openOnly])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          Loading jobs...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen space-y-6 bg-slate-50 p-6">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Jobs</h1>

        <p className="mt-2 text-slate-600">
          Search, filter, apply, and save jobs for later.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <input
          placeholder="Search location..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-xl border px-3 py-2"
        />

        <select
          value={trade}
          onChange={(event) => setTrade(event.target.value)}
          className="rounded-xl border px-3 py-2"
        >
          <option value="">All Trades</option>
          <option value="Plumbing">Plumbing</option>
          <option value="Electrical">Electrical</option>
          <option value="HVAC">HVAC</option>
          <option value="Concrete">Concrete</option>
          <option value="Framing">Framing</option>
        </select>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={() => setVerifiedOnly((current) => !current)}
          />
          Verified Only
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={() => setOpenOnly((current) => !current)}
          />
          Open Jobs Only
        </label>

        <Link
          href="/saved-jobs"
          className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Saved Jobs
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {filteredJobs.map((job) => {
          const companyName =
            job.company?.company_name || job.company?.full_name || 'Company'

          const verified =
            job.company?.insurance_status === 'verified' &&
            job.company?.liability_status === 'verified'

          const saved = savedJobIds.includes(job.id)

          return (
            <div
              key={job.id}
              className="rounded-3xl border bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {job.title}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">{companyName}</p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-600">
                  {job.status}
                </span>
              </div>

              <div className="mt-3">
                {verified ? (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    ✔ Verified Company
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    Not Verified
                  </span>
                )}
              </div>

              <p className="mt-4 text-sm text-slate-700">
                {job.trade} · {job.location}
              </p>

              <p className="mt-2 text-sm text-slate-600">
                Pay: {job.pay_rate || 'Not listed'}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={`/jobs/${job.id}`}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  View Job
                </Link>

                <button
                  type="button"
                  onClick={() => void toggleSaveJob(job.id)}
                  className={
                    saved
                      ? 'rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-200'
                      : 'rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100'
                  }
                >
                  {saved ? 'Saved ❤️' : 'Save Job 🤍'}
                </button>

                <Link
                  href={`/profiles/${job.company_id}`}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  View Company
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}