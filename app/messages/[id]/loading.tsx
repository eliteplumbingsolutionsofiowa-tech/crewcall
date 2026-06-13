export default function MessageThreadLoading() {
  return (
    <main className="min-h-screen px-3 py-4 pb-36 text-white sm:px-4 sm:py-8 md:pb-10">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="sticky top-[88px] z-30 rounded-[2rem] border border-white/10 bg-slate-950/90 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="h-3 w-28 animate-pulse rounded-full bg-cyan-300/20" />

              <div className="mt-4 flex items-center gap-3">
                <div className="h-12 w-12 animate-pulse rounded-2xl bg-cyan-300/20" />

                <div className="flex-1">
                  <div className="h-7 w-48 animate-pulse rounded-2xl bg-white/15" />
                  <div className="mt-3 h-4 w-40 animate-pulse rounded-full bg-white/10" />
                </div>
              </div>
            </div>

            <div className="hidden h-11 w-28 animate-pulse rounded-2xl bg-white/10 sm:block" />
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur">
          <div className="max-h-[68vh] min-h-[460px] space-y-4 overflow-y-auto bg-slate-950/45 p-4 md:p-5">
            <div className="flex justify-center">
              <div className="h-8 w-28 animate-pulse rounded-full bg-white/10" />
            </div>

            {[1, 2, 3, 4, 5, 6].map((item) => {
              const mine = item % 2 === 0

              return (
                <div
                  key={item}
                  className={`flex ${
                    mine ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[86%] rounded-3xl px-4 py-4 shadow-lg md:max-w-[72%] ${
                      mine
                        ? 'bg-cyan-400/20'
                        : 'border border-white/10 bg-slate-900'
                    }`}
                  >
                    <div className="h-4 w-56 animate-pulse rounded-full bg-white/15" />
                    <div className="mt-3 h-4 w-40 animate-pulse rounded-full bg-white/10" />
                    <div className="mt-4 h-3 w-20 animate-pulse rounded-full bg-white/10" />
                  </div>
                </div>
              )
            })}

            <div className="flex justify-start">
              <div className="rounded-3xl border border-white/10 bg-slate-900 px-5 py-4 shadow-sm">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" />
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-white/10 bg-slate-950/95 p-4 backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="min-h-20 flex-1 animate-pulse rounded-2xl bg-white/10" />

              <div className="flex items-end gap-2">
                <div className="h-12 w-24 animate-pulse rounded-2xl bg-white/10" />
                <div className="h-12 w-28 animate-pulse rounded-2xl bg-cyan-300/20" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}