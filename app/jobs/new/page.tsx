'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CrewButton } from '@/app/components/CrewButton'
import { CrewCard } from '@/app/components/CrewCard'
import { CrewInput } from '@/app/components/CrewInput'

const trades = [
  'Plumbing',
  'Electrical',
  'HVAC',
  'Framing',
  'Concrete',
  'Drywall',
  'Roofing',
  'Painting',
  'Flooring',
  'General Labor',
]

export default function NewJobPage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [trade, setTrade] = useState('Plumbing')
  const [location, setLocation] = useState('')
  const [payRate, setPayRate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function createJob(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('You must be logged in to post a job.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'company') {
      setMessage('Only company accounts can post jobs.')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('jobs').insert({
      company_id: user.id,
      title,
      trade,
      location,
      pay_rate: payRate,
      start_date: startDate || null,
      description,
      status: 'open',
      payment_status: 'unpaid',
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    router.push('/my-jobs')
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            CrewCall
          </p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            Post a Job
          </h1>
          <p className="mt-2 text-gray-600">
            Add the work you need help with and let available workers apply.
          </p>
        </div>

        <CrewCard>
          <form onSubmit={createJob} className="space-y-5">
            <CrewInput
              label="Job Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Example: Rough-in help needed"
              required
            />

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Trade
              </label>
              <select
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {trades.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <CrewInput
              label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Example: Des Moines, IA"
              required
            />

            <CrewInput
              label="Pay Rate / Job Price"
              value={payRate}
              onChange={(e) => setPayRate(e.target.value)}
              placeholder="Example: $45/hr or $1,200"
              required
            />

            <CrewInput
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Job Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the work, schedule, expectations, tools needed, and any special requirements."
                required
                rows={6}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {message && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {message}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <CrewButton type="submit" disabled={loading}>
                {loading ? 'Posting...' : 'Post Job'}
              </CrewButton>

              <CrewButton href="/my-jobs" variant="ghost">
                Cancel
              </CrewButton>
            </div>
          </form>
        </CrewCard>
      </div>
    </main>
  )
}