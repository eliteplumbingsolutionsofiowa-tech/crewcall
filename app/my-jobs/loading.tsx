export default function MyJobsLoading() {
  return (
    <main className="min-h-screen px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur md:p-8">
          <div className="h-4 w-36 animate-pulse rounded-full bg-cyan-300/20" />

          <div className="mt-5 h-12 w-80 animate-pulse rounded-2xl bg-white/15" />

          <div className="mt-4 h-5 w-full max-w-2xl animate-pulse rounded-full bg-white/10" />

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="rounded-3xl border border-white/10 bg-slate-950/40 p-5"
              >
                <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
                <div className="mt-4 h-9 w-20 animate-pulse rounded-2xl bg-white/15" />
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

        <div className="space-y-5">
          {[1, 2, 3, 4, 5].map((item) => (
            <section
              key={item}
              className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <div className="h-8 w-64 animate-pulse rounded-2xl bg-white/15" />

                  <div className="mt-4 flex flex-wrap gap-3">
                    <div className="h-8 w-24 animate-pulse rounded-full bg-cyan-300/20" />
                    <div className="h-8 w-28 animate-pulse rounded-full bg-emerald-300/10" />
                    <div className="h-8 w-20 animate-pulse rounded-full bg-orange-300/10" />
                  </div>

                  <div className="mt-6 h-5 w-full animate-pulse rounded-full bg-white/10" />
                  <div className="mt-3 h-5 w-4/5 animate-pulse rounded-full bg-white/10" />

                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    {[1, 2, 3].map((detail) => (
                      <div
                        key={detail}
                        className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                      >
                        <div className="h-3 w-20 animate-pulse rounded-full bg-white/10" />
                        <div className="mt-3 h-5 w-28 animate-pulse rounded-full bg-white/15" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 lg:w-56 lg:flex-col">
                  {[1, 2, 3, 4].map((button) => (
                    <div
                      key={button}
                      className="h-11 w-40 animate-pulse rounded-2xl bg-white/10"
                    />
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}