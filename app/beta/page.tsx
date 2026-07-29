'use client'

import { useEffect, useState } from 'react'

const trades = [
  'Plumbing',
  'HVAC',
  'Electrical',
  'Construction',
  'Welding',
  'Carpentry',
  'Other',
]

export default function BetaPage() {
  const [type, setType] = useState('Company')
  const [referralSource, setReferralSource] = useState('')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search,
    )

    setReferralSource(
      params.get('ref') || 'direct',
    )
  }, [])

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    trade: 'Plumbing',
    company_name: '',
    message: '',
  })

  function updateField(
    key: keyof typeof form,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  async function submitLead() {
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          lead_type: type,
          referral_source: referralSource,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error || 'Submission failed',
        )
      }

      setMessage(
        'Thanks! We will contact you soon.',
      )

      setForm({
        name: '',
        email: '',
        phone: '',
        location: '',
        trade: 'Plumbing',
        company_name: '',
        message: '',
      })
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to submit.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-8">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8 text-center">

          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
            CrewCall Early Access
          </p>

          <h1 className="mt-4 text-5xl font-black">
            Join the CrewCall Launch
          </h1>

          <p className="mt-4 text-slate-400">
            Connect skilled trades with companies that need help fast.
          </p>

        </section>


        <section className="rounded-2xl border border-white/10 bg-white/5 p-8">

          <div className="flex gap-3">

            {['Company', 'Worker'].map((item) => (
              <button
                key={item}
                onClick={() => setType(item)}
                className={
                  type === item
                    ? 'rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950'
                    : 'rounded-xl bg-white/10 px-5 py-3 font-black'
                }
              >
                {item}
              </button>
            ))}

          </div>


          <div className="mt-6 grid gap-4">

            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) =>
                updateField('name', e.target.value)
              }
              className="rounded-xl bg-slate-900 px-4 py-3"
            />

            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                updateField('email', e.target.value)
              }
              className="rounded-xl bg-slate-900 px-4 py-3"
            />

            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) =>
                updateField('phone', e.target.value)
              }
              className="rounded-xl bg-slate-900 px-4 py-3"
            />

            <input
              placeholder="City / State"
              value={form.location}
              onChange={(e) =>
                updateField('location', e.target.value)
              }
              className="rounded-xl bg-slate-900 px-4 py-3"
            />

            <select
              value={form.trade}
              onChange={(e) =>
                updateField('trade', e.target.value)
              }
              className="rounded-xl bg-slate-900 px-4 py-3"
            >
              {trades.map((trade) => (
                <option key={trade}>
                  {trade}
                </option>
              ))}
            </select>


            {type === 'Company' ? (
              <input
                placeholder="Company Name"
                value={form.company_name}
                onChange={(e) =>
                  updateField(
                    'company_name',
                    e.target.value,
                  )
                }
                className="rounded-xl bg-slate-900 px-4 py-3"
              />
            ) : null}


            <textarea
              placeholder="Tell us what you need..."
              value={form.message}
              onChange={(e) =>
                updateField(
                  'message',
                  e.target.value,
                )
              }
              className="min-h-32 rounded-xl bg-slate-900 px-4 py-3"
            />


            <button
              onClick={submitLead}
              disabled={loading}
              className="rounded-xl bg-cyan-400 px-6 py-4 font-black text-slate-950 disabled:opacity-50"
            >
              {loading
                ? 'Submitting...'
                : 'Request Early Access'}
            </button>


            {message ? (
              <p className="text-center font-bold text-cyan-300">
                {message}
              </p>
            ) : null}

          </div>

        </section>

      </div>
    </main>
  )
}
