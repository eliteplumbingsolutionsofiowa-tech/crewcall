import Link from 'next/link'

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white md:px-6">
      <div className="mx-auto max-w-5xl space-y-10">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            About CrewCall
          </p>

          <h1 className="mt-4 text-4xl font-black md:text-6xl">
            Built for the trades.
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            CrewCall helps contractors find skilled trades workers faster and
            helps workers find real job opportunities in their area.
          </p>

          <p className="mt-4 text-lg leading-8 text-slate-300">
            It was built for plumbers, HVAC techs, electricians, pipefitters,
            welders, carpenters, laborers, and the companies that depend on
            them to keep projects moving.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <Card
            title="For Companies"
            text="Post jobs, review applicants, message workers, hire, and manage work from one place."
          />
          <Card
            title="For Workers"
            text="Create a profile, browse jobs, apply fast, and build a reputation with reviews."
          />
          <Card
            title="Why It Exists"
            text="Because finding reliable skilled help should not require endless phone calls and text chains."
          />
        </section>

        <section className="rounded-[2rem] border border-cyan-400/20 bg-cyan-400/10 p-8">
          <h2 className="text-3xl font-black">Iowa-based. Trade-focused.</h2>

          <p className="mt-4 text-lg leading-8 text-slate-300">
            CrewCall is starting in Iowa with a focus on real contractors and
            real skilled trades workers. The goal is simple: help good companies
            find good workers faster.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/signup"
              className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 hover:bg-cyan-300"
            >
              Start Free Trial
            </Link>

            <Link
              href="/jobs"
              className="rounded-2xl border border-white/20 bg-white/5 px-6 py-4 font-black text-white hover:bg-white/10"
            >
              Browse Jobs
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}

function Card({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="mt-4 leading-7 text-slate-300">{text}</p>
    </div>
  )
}