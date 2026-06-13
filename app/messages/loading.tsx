export default function MessagesLoading() {
  return (
    <main className="min-h-screen px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur md:p-8">
          <div className="h-4 w-44 animate-pulse rounded-full bg-cyan-300/20" />
          <div className="mt-5 h-12 w-72 animate-pulse rounded-2xl bg-white/15" />
          <div className="mt-4 h-5 w-full max-w-xl animate-pulse rounded-full bg-white/10" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur">
            <div className="h-11 animate-pulse rounded-2xl bg-white/10" />

            <div className="mt-5 space-y-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div
                  key={item}
                  className="rounded-3xl border border-white/10 bg-slate-950/40 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 animate-pulse rounded-2xl bg-cyan-300/20" />
                    <div className="flex-1">
                      <div className="h-4 w-32 animate-pulse rounded-full bg-white/15" />
                      <div className="mt-3 h-3 w-44 animate-pulse rounded-full bg-white/10" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-4 border-b border-white/10 pb-5">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-cyan-300/20" />
              <div>
                <div className="h-5 w-40 animate-pulse rounded-full bg-white/15" />
                <div className="mt-3 h-3 w-28 animate-pulse rounded-full bg-white/10" />
              </div>
            </div>

            <div className="mt-6 space-y-5">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className={`flex ${
                    item % 2 === 0 ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div className="w-2/3 rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                    <div className="h-4 animate-pulse rounded-full bg-white/15" />
                    <div className="mt-3 h-4 w-3/4 animate-pulse rounded-full bg-white/10" />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex gap-3 border-t border-white/10 pt-5">
              <div className="h-12 flex-1 animate-pulse rounded-2xl bg-white/10" />
              <div className="h-12 w-24 animate-pulse rounded-2xl bg-cyan-300/20" />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}