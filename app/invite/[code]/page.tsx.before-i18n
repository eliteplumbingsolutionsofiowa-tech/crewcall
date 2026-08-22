'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function InvitePage() {
  const params = useParams()

  const code = params.code as string

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-3xl">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-10 text-center">

          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
            CrewCall Invitation
          </p>

          <h1 className="mt-5 text-5xl font-black">
            You&apos;ve Been Invited
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-slate-400">
            Join CrewCall, the skilled trades network connecting
            companies with qualified workers.
          </p>


          <div className="mt-8 rounded-2xl bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Invite Code
            </p>

            <p className="mt-2 text-3xl font-black text-cyan-300">
              {code}
            </p>
          </div>


          <div className="mt-8 flex flex-col gap-4 sm:flex-row justify-center">

            <Link
              href={`/signup?invite=${code}`}
              className="rounded-xl bg-cyan-400 px-8 py-4 font-black text-slate-950"
            >
              Create Account
            </Link>


            <Link
              href="/login"
              className="rounded-xl border border-white/20 bg-white/5 px-8 py-4 font-black"
            >
              Login
            </Link>

          </div>

        </section>

      </div>
    </main>
  )
}
