'use client'

import { useState } from 'react'

const categories = [
  'Bug Report',
  'Feature Request',
  'General Feedback',
  'Billing',
  'Account Help',
]

const priorities = [
  'Low',
  'Normal',
  'High',
  'Critical',
]

export default function FeedbackPage() {
  const [category, setCategory] = useState('Bug Report')
  const [priority, setPriority] = useState('Normal')

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-8">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            CrewCall
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Feedback Center
          </h1>

          <p className="mt-3 text-slate-400">
            Report issues, request features, and help improve CrewCall.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">

          <div className="grid gap-5">

            <div>
              <label className="text-sm font-bold text-slate-400">
                Category
              </label>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3"
              >
                {categories.map((item) => (
                  <option key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>


            <div>
              <label className="text-sm font-bold text-slate-400">
                Priority
              </label>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3"
              >
                {priorities.map((item) => (
                  <option key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>


            <input
              placeholder="Subject"
              className="rounded-xl bg-slate-900 px-4 py-3"
            />


            <textarea
              placeholder="Describe your feedback..."
              className="min-h-40 rounded-xl bg-slate-900 px-4 py-3"
            />


            <input
              type="file"
              className="rounded-xl bg-slate-900 px-4 py-3"
            />


            <button className="rounded-xl bg-cyan-400 px-6 py-3 font-black text-slate-950">
              Submit Feedback
            </button>

          </div>

        </section>


        <section className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-6">

          <h2 className="text-xl font-black">
            What happens next?
          </h2>

          <ul className="mt-4 space-y-3 text-slate-300">
            <li>✓ Bug reports are reviewed by CrewCall</li>
            <li>✓ Feature requests are prioritized</li>
            <li>✓ Critical issues are escalated</li>
            <li>✓ Updates appear in future releases</li>
          </ul>

        </section>

      </div>
    </main>
  )
}
