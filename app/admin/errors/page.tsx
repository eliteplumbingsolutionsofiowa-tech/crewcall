'use client'

const errors = [
  {
    type: 'Info',
    message: 'Stripe webhook processed',
    route: '/api/stripe/webhook',
    time: 'Today 10:15 AM',
  },
]

export default function ErrorCenterPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <a
          href="/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-300 transition hover:border-cyan-400/30 hover:bg-white/10 hover:text-white"
        >
          ← Back to Control Center
        </a>


        <section className="rounded-3xl border border-red-400/20 bg-red-400/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-red-300">
            Admin
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Error Center
          </h1>

          <p className="mt-3 text-slate-400">
            Monitor application issues before they affect customers.
          </p>
        </section>

        <section className="grid gap-5 sm:grid-cols-3">

          <Stat title="Errors Today" value="0" />

          <Stat title="Warnings" value="0" />

          <Stat title="Resolved" value="48" />

        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">

          <h2 className="text-2xl font-black">
            Recent Events
          </h2>

          <div className="mt-5 space-y-4">

            {errors.map((error) => (
              <div
                key={error.message}
                className="rounded-xl bg-slate-950/70 p-5"
              >
                <div className="flex flex-wrap justify-between gap-3">

                  <p className="font-black">
                    {error.message}
                  </p>

                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
                    {error.type}
                  </span>

                </div>

                <p className="mt-2 text-sm text-slate-400">
                  {error.route}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {error.time}
                </p>

              </div>
            ))}

          </div>

        </section>

      </div>
    </main>
  )
}

function Stat({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-black">
        {value}
      </p>
    </div>
  )
}
