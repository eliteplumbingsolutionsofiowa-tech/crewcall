'use client'

import { useState } from 'react'

const stats = [
  {
    label: 'Invites Sent',
    value: '24',
  },
  {
    label: 'Joined',
    value: '8',
  },
  {
    label: 'Jobs Created',
    value: '5',
  },
  {
    label: 'Rewards Earned',
    value: '$250',
  },
]

const companyRewards = [
  '5 referred companies',
  'Featured listing credits',
  'Priority support',
]

const workerRewards = [
  '5 referred workers',
  'Profile boost',
  'More job visibility',
]

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false)

  const referralLink =
    'https://crewcall.com/signup?ref=CREW-JAY-2026'

  async function copyLink() {
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)

    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            Growth
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Referral Center
          </h1>

          <p className="mt-3 text-slate-400">
            Grow the CrewCall network by inviting companies and skilled workers.
          </p>
        </section>


        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <p className="text-xs font-bold uppercase text-slate-500">
                {item.label}
              </p>

              <p className="mt-2 text-3xl font-black">
                {item.value}
              </p>
            </div>
          ))}
        </section>


        <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-6">

          <h2 className="text-2xl font-black">
            Your Referral Link
          </h2>

          <div className="mt-5 flex flex-wrap gap-3">

            <div className="flex-1 rounded-xl bg-slate-950 px-4 py-3 text-sm text-slate-300">
              {referralLink}
            </div>

            <button
              onClick={copyLink}
              className="rounded-xl bg-cyan-400 px-6 py-3 font-black text-slate-950"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>

          </div>

        </section>


        <section className="grid gap-6 lg:grid-cols-2">

          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">

            <h2 className="text-2xl font-black">
              Company Rewards
            </h2>

            <ul className="mt-5 space-y-3 text-slate-300">
              {companyRewards.map((item) => (
                <li key={item}>
                  ✓ {item}
                </li>
              ))}
            </ul>

          </div>


          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">

            <h2 className="text-2xl font-black">
              Worker Rewards
            </h2>

            <ul className="mt-5 space-y-3 text-slate-300">
              {workerRewards.map((item) => (
                <li key={item}>
                  ✓ {item}
                </li>
              ))}
            </ul>

          </div>

        </section>


        <section className="rounded-2xl border border-white/10 bg-white/5 p-8">

          <h2 className="text-2xl font-black">
            Share CrewCall
          </h2>

          <div className="mt-5 flex flex-wrap gap-4">

            <button className="rounded-xl bg-white/10 px-6 py-3 font-bold">
              Email Invite
            </button>

            <button className="rounded-xl bg-white/10 px-6 py-3 font-bold">
              Text Invite
            </button>

            <button className="rounded-xl bg-white/10 px-6 py-3 font-bold">
              Copy Message
            </button>

          </div>

        </section>


        <section className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-6">

          <h2 className="text-xl font-black">
            Referral Growth Ideas
          </h2>

          <div className="mt-4 space-y-3 text-slate-300">
            <p>
              • Reward contractors who bring quality companies.
            </p>

            <p>
              • Reward workers who bring skilled tradespeople.
            </p>

            <p>
              • Feature top referrers in the CrewCall community.
            </p>
          </div>

        </section>

      </div>
    </main>
  )
}
