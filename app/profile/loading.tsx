export default function ProfileLoading() {
  return (
    <main className="min-h-screen px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="h-28 w-28 animate-pulse rounded-[2rem] bg-cyan-300/20" />

            <div className="flex-1">
              <div className="h-5 w-32 animate-pulse rounded-full bg-cyan-300/20" />

              <div className="mt-5 h-12 w-72 animate-pulse rounded-2xl bg-white/15" />

              <div className="mt-4 h-5 w-56 animate-pulse rounded-full bg-white/10" />

              <div className="mt-5 flex flex-wrap gap-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-10 w-28 animate-pulse rounded-2xl bg-white/10"
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur"
            >
              <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
              <div className="mt-5 h-10 w-20 animate-pulse rounded-2xl bg-white/15" />
            </div>
          ))}
        </div>

        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="h-7 w-48 animate-pulse rounded-2xl bg-white/15" />

          <div className="mt-6 space-y-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"
              >
                <div className="h-4 w-40 animate-pulse rounded-full bg-white/10" />
                <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-white/10" />
                <div className="mt-3 h-4 w-3/4 animate-pulse rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="h-7 w-40 animate-pulse rounded-2xl bg-white/15" />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"
              >
                <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
                <div className="mt-4 h-5 w-44 animate-pulse rounded-full bg-white/15" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}