import Link from 'next/link'

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white md:px-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            Contact
          </p>

          <h1 className="mt-4 text-4xl font-black md:text-6xl">
            Need help with CrewCall?
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Have a question about signing up, posting jobs, applying for work,
            payments, or your account? Reach out and we’ll help.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-black">General Support</h2>
            <p className="mt-4 leading-7 text-slate-300">
              For account help, billing questions, feedback, or platform
              support.
            </p>
            <p className="mt-5 font-black text-cyan-300">
              support@crewcall.app
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-black">Contractor Questions</h2>
            <p className="mt-4 leading-7 text-slate-300">
              Want to bring your company onto CrewCall or ask about pricing?
            </p>
            <p className="mt-5 font-black text-cyan-300">
              hello@crewcall.app
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-cyan-400/20 bg-cyan-400/10 p-8">
          <h2 className="text-3xl font-black">Ready to get started?</h2>
          <p className="mt-4 text-lg leading-8 text-slate-300">
            Companies can start a free 14-day trial. Workers can create a
            profile and browse jobs.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/signup"
              className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 hover:bg-cyan-300"
            >
              Sign Up
            </Link>

            <Link
              href="/pricing"
              className="rounded-2xl border border-white/20 bg-white/5 px-6 py-4 font-black text-white hover:bg-white/10"
            >
              View Pricing
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}