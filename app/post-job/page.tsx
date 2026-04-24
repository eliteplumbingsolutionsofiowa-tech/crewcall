'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  role: string | null
}

export default function PostJobPage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [trade, setTrade] = useState('')
  const [location, setLocation] = useState('')
  const [payRate, setPayRate] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [checkingRole, setCheckingRole] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
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
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        setMessage(error.message)
        setCheckingRole(false)
        return
      }

      const role = (data as Profile | null)?.role

      if (role !== 'company') {
        setMessage('Only company accounts can post jobs.')
        setCheckingRole(false)
        return
      }

      setAllowed(true)
      setCheckingRole(false)
    }

    checkRole()
  }, [])

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
      status: 'open',
    })

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    setMessage('Job posted successfully.')
    setSaving(false)

    setTimeout(() => {
      router.push('/jobs')
    }, 1000)
  }

  if (checkingRole) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-4xl font-bold">Post Job</h1>
        <div className="mt-8 rounded-3xl border bg-white p-8 shadow-sm">
          Checking account...
        </div>
      </main>
    )
  }

  if (!allowed) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-4xl font-bold">Post Job</h1>
        <div className="mt-8 rounded-3xl border border-yellow-200 bg-yellow-50 p-8 text-yellow-800 shadow-sm">
          {message || 'Only company accounts can post jobs.'}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-4xl font-bold">Post Job</h1>

      <form
        onSubmit={handleSubmit}
        className="mt-8 rounded-3xl border bg-white p-8 shadow-sm"
      >
        <div className="grid gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Job Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Master Plumber"
              className="mt-1 w-full rounded-xl border px-4 py-3"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the work..."
              rows={5}
              className="mt-1 w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Trade
              </label>
              <input
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                placeholder="Plumbing"
                className="mt-1 w-full rounded-xl border px-4 py-3"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Des Moines, Iowa"
                className="mt-1 w-full rounded-xl border px-4 py-3"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Pay
            </label>
            <input
              value={payRate}
              onChange={(e) => setPayRate(e.target.value)}
              placeholder="45/hr"
              className="mt-1 w-full rounded-xl border px-4 py-3"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Posting...' : 'Post Job'}
          </button>

          {message && <div className="text-sm text-blue-600">{message}</div>}
        </div>
      </form>
    </main>
  )
}