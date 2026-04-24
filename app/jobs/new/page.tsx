'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function NewJobPage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [trade, setTrade] = useState('Plumbing')
  const [location, setLocation] = useState('')
  const [payRate, setPayRate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function createJob(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setSaving(true)
    setErrorMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setErrorMessage('You must be logged in to post a job.')
      setSaving(false)
      return
    }

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        company_id: user.id,
        title,
        trade,
        location,
        pay_rate: payRate || null,
        start_date: startDate || null,
        description: description || null,
        status: 'open',
      })
      .select('id')
      .single()

    if (error) {
      setErrorMessage(error.message)
      setSaving(false)
      return
    }

    router.push(`/jobs/${data.id}`)
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase text-blue-700">
          Company Tools
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Post a Job
        </h1>
        <p className="mt-2 text-slate-600">
          Create a job opening and start receiving applicants.
        </p>
      </div>

      <form
        onSubmit={createJob}
        className="space-y-5 rounded-3xl border bg-white p-6 shadow-sm"
      >
        {errorMessage && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-semibold">
            Job Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Example: Licensed plumber needed"
            className="w-full rounded-xl border px-4 py-3"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold">Trade</label>
            <select
              value={trade}
              onChange={(e) => setTrade(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            >
              <option>Plumbing</option>
              <option>Electrical</option>
              <option>HVAC</option>
              <option>Concrete</option>
              <option>Framing</option>
              <option>Drywall</option>
              <option>Roofing</option>
              <option>Painting</option>
              <option>General Labor</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Location
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              placeholder="Example: Des Moines, IA"
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Pay Rate
            </label>
            <input
              value={payRate}
              onChange={(e) => setPayRate(e.target.value)}
              placeholder="Example: $35/hr or $2,500 flat"
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">
            Job Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the work, schedule, requirements, tools needed, and any special notes."
            className="min-h-36 w-full rounded-xl border px-4 py-3"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Posting...' : 'Post Job'}
        </button>
      </form>
    </main>
  )
}