'use client'

import { useState } from 'react'

export default function InvitesPage() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('worker')
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)

  async function createInvite() {
    setLoading(true)

    try {
      const response = await fetch(
        '/api/invites/create',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            role,
          }),
        },
      )

      const data = await response.json()

      if (data.link) {
        setLink(
          `${window.location.origin}${data.link}`,
        )
      }

    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">

      <div className="mx-auto max-w-3xl space-y-8">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">

          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
            CrewCall Network
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Invite Workers & Companies
          </h1>

          <p className="mt-3 text-slate-400">
            Grow the CrewCall network by inviting trusted people.
          </p>

        </section>


        <section className="rounded-2xl border border-white/10 bg-white/5 p-8 space-y-5">

          <select
            value={role}
            onChange={(e) =>
              setRole(e.target.value)
            }
            className="w-full rounded-xl bg-slate-900 px-4 py-3"
          >
            <option value="worker">
              Worker
            </option>

            <option value="company">
              Company
            </option>

          </select>


          <input
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            placeholder="Email (optional)"
            className="w-full rounded-xl bg-slate-900 px-4 py-3"
          />


          <button
            onClick={createInvite}
            disabled={loading}
            className="rounded-xl bg-cyan-400 px-6 py-3 font-black text-slate-950"
          >
            {loading
              ? 'Creating...'
              : 'Create Invite'}
          </button>


          {link ? (

            <div className="rounded-xl bg-slate-900 p-5">

              <p className="text-sm text-slate-400">
                Share this link:
              </p>

              <p className="mt-2 break-all font-bold text-cyan-300">
                {link}
              </p>

            </div>

          ) : null}


        </section>

      </div>

    </main>
  )
}
