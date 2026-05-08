'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  role: string | null
  company_name: string | null
  verified: boolean | null
}

export default function PostJobPage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [trade, setTrade] = useState('')
  const [location, setLocation] = useState('')
  const [payRate, setPayRate] = useState('')
  const [startDate, setStartDate] = useState('')

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [checkingRole, setCheckingRole] = useState(true)
  const [allowed, setAllowed] = useState(false)

  const [companyName, setCompanyName] = useState('')
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    checkRole()
  }, [])

  async function checkRole() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    const user = session?.user

    if (sessionError || !user) {
      setMessage('You must be logged in to post a job.')
      setCheckingRole(false)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('role, company_name, verified')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      setMessage(error.message)
      setCheckingRole(false)
      return
    }

    const profile = data as Profile | null

    if (profile?.role !== 'company') {
      setMessage('Only company accounts can post jobs.')
      setCheckingRole(false)
      return
    }

    setCompanyName(profile?.company_name || 'Company')
    setVerified(profile?.verified || false)

    setAllowed(true)
    setCheckingRole(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setSaving(true)
    setMessage(null)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    const user = session?.user

    if (sessionError || !user) {
      setMessage('You must be logged in to post a job.')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('jobs').insert({
      company_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      trade: trade.trim(),
      location: location.trim(),
      pay_rate: payRate.trim() || null,
      start_date: startDate || null,
      status: 'open',
    })

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    setMessage('Job posted successfully.')

    setTitle('')
    setDescription('')
    setTrade('')
    setLocation('')
    setPayRate('')
    setStartDate('')

    setSaving(false)

    setTimeout(() => {
      router.push('/my-jobs')
    }, 1000)
  }

  if (checkingRole) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-100 p-6">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-xl">
          <h1 className="text-4xl font-black text-slate-950">
            Post Job
          </h1>

          <div className="mt-6 text-lg text-slate-600">
            Checking account...
          </div>
        </div>
      </main>
    )
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-100 p-6">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-yellow-200 bg-yellow-50 p-8 shadow-xl">
          <h1 className="text-4xl font-black text-yellow-900">
            Post Job
          </h1>

          <div className="mt-6 text-lg text-yellow-800">
            {message || 'Only company accounts can post jobs.'}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-2xl shadow-slate-900/5 backdrop-blur">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-600">
                Company Hiring
              </p>

              <h1 className="mt-3 text-5xl font-black tracking-tight text-slate-950">
                Post a CrewCall Job
              </h1>

              <p className="mt-3 max-w-2xl text-lg text-slate-600">
                Reach skilled tradespeople and hire faster.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-right shadow-sm">
              <p className="text-xl font-black text-slate-950">
                {companyName}
              </p>

              <div className="mt-2 flex items-center justify-end gap-2">
                {verified && (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700">
                    Verified
                  </span>
                )}

                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
                  Company
                </span>
              </div>
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-2xl shadow-slate-900/5 backdrop-blur"
        >
          <div className="grid gap-6">
            <div>
              <label className="block text-sm font-black uppercase tracking-wide text-slate-600">
                Job Title
              </label>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Master Plumber"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none transition focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-black uppercase tracking-wide text-slate-600">
                Description
              </label>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the work..."
                rows={6}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none transition focus:border-blue-500"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-black uppercase tracking-wide text-slate-600">
                  Trade
                </label>

                <input
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  placeholder="Plumbing"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none transition focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-black uppercase tracking-wide text-slate-600">
                  Location
                </label>

                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Des Moines, Iowa"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none transition focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-black uppercase tracking-wide text-slate-600">
                  Pay Rate
                </label>

                <input
                  value={payRate}
                  onChange={(e) => setPayRate(e.target.value)}
                  placeholder="45/hr"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none transition focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-black uppercase tracking-wide text-slate-600">
                  Start Date
                </label>

                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none transition focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-sm font-black text-white shadow-xl shadow-blue-500/20 transition hover:scale-[1.02] disabled:opacity-50"
            >
              {saving ? 'Posting Job...' : 'Post Job'}
            </button>

            {message && (
              <div className="text-sm font-semibold text-blue-600">
                {message}
              </div>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}