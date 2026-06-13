export default function JobsLoading() {
  return (
    <main className="min-h-screen px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur md:p-8">
          <div className="h-4 w-40 animate-pulse rounded-full bg-cyan-300/20" />
          <div className="mt-5 h-12 w-72 animate-pulse rounded-2xl bg-white/15" />
          <div className="mt-4 h-5 w-full max-w-xl animate-pulse rounded-full bg-white/10" />

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="rounded-3xl border border-white/10 bg-slate-950/40 p-5"
              >
                <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
                <div className="mt-4 h-8 w-16 animate-pulse rounded-xl bg-white/15" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2 h-12 animate-pulse rounded-2xl bg-white/10" />
            <div className="h-12 animate-pulse rounded-2xl bg-white/10" />
            <div className="h-12 animate-pulse rounded-2xl bg-white/10" />
          </div>
        </section>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur"
            >
              <div className="h-6 w-3/4 animate-pulse rounded-xl bg-white/15" />
              <div className="mt-4 h-4 w-1/2 animate-pulse rounded-full bg-white/10" />
              <div className="mt-6 h-24 animate-pulse rounded-3xl bg-slate-950/40" />
              <div className="mt-5 flex gap-2">
                <div className="h-9 w-24 animate-pulse rounded-full bg-cyan-300/20" />
                <div className="h-9 w-24 animate-pulse rounded-full bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}