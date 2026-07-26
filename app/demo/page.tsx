'use client'

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            CrewCall Demo
          </p>

          <h1 className="mt-3 text-5xl font-black">
            See CrewCall In Action
          </h1>

          <p className="mt-4 max-w-3xl text-slate-400">
            Explore how contractors find workers, manage jobs,
            and use AI recruiting to fill positions faster.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-3">

          <Card
            title="Active Jobs"
            value="24"
          />

          <Card
            title="Available Workers"
            value="486"
          />

          <Card
            title="AI Matches"
            value="92%"
          />

        </section>

        <section className="grid gap-5 md:grid-cols-2">

          <Panel title="AI Recruiter">
            Found 18 qualified workers for your plumbing job.
          </Panel>

          <Panel title="Operations Center">
            6 active crews, 12 applications, 3 jobs needing attention.
          </Panel>

          <Panel title="Payments">
            Workers paid securely through CrewCall.
          </Panel>

          <Panel title="Worker Network">
            Search verified skilled trades near your projects.
          </Panel>

        </section>

        <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-8 text-center">

          <h2 className="text-3xl font-black">
            Ready to build your crew?
          </h2>

          <button className="mt-5 rounded-xl bg-cyan-400 px-8 py-4 font-black text-slate-950">
            Create Free Account
          </button>

        </section>

      </div>
    </main>
  )
}

function Card({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <p className="text-xs uppercase text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-4xl font-black">
        {value}
      </p>
    </div>
  )
}

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-black">
        {title}
      </h2>

      <p className="mt-3 text-slate-400">
        {children}
      </p>
    </div>
  )
}
