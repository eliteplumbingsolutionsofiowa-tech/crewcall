'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Referral = {
  id: string
  full_name: string | null
  role: string | null
  invite_code_used: string | null
}

export default function AdminReferralsPage() {
  const [profiles, setProfiles] = useState<Referral[]>([])

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select(
        'id, full_name, role, invite_code_used',
      )
      .not(
        'invite_code_used',
        'is',
        null,
      )

    setProfiles(data || [])
  }

  useEffect(() => {
    void load()
  }, [])

  const codes = profiles.reduce(
    (acc, profile) => {
      const code =
        profile.invite_code_used || 'unknown'

      acc[code] =
        (acc[code] || 0) + 1

      return acc
    },
    {} as Record<string, number>,
  )

  const ranking = Object.entries(codes)
    .sort((a, b) => b[1] - a[1])

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-8">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">

          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
            CrewCall Growth
          </p>

          <h1 className="mt-3 text-5xl font-black">
            Referral Leaderboard
          </h1>

          <p className="mt-3 text-slate-400">
            Track who is helping grow the network.
          </p>

        </section>


        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">

          <h2 className="text-2xl font-black">
            Top Invite Sources
          </h2>

          <div className="mt-6 space-y-3">

            {ranking.length === 0 ? (
              <p className="text-slate-400">
                No referrals yet.
              </p>
            ) : (

              ranking.map(([code, count], index) => (

                <div
                  key={code}
                  className="flex items-center justify-between rounded-xl bg-slate-900 p-4"
                >

                  <div>
                    <p className="font-black">
                      #{index + 1} {code}
                    </p>

                    <p className="text-sm text-slate-400">
                      Invite code
                    </p>
                  </div>


                  <div className="text-3xl font-black text-cyan-300">
                    {count}
                  </div>

                </div>

              ))

            )}

          </div>

        </section>


        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">

          <h2 className="text-2xl font-black">
            Referred Users
          </h2>

          <div className="mt-5 space-y-3">

            {profiles.map((profile) => (

              <div
                key={profile.id}
                className="rounded-xl bg-slate-900 p-4"
              >

                <p className="font-bold">
                  {profile.full_name || 'User'}
                </p>

                <p className="text-sm text-slate-400">
                  {profile.role || 'unknown'} · {profile.invite_code_used}
                </p>

              </div>

            ))}

          </div>

        </section>

      </div>
    </main>
  )
}
