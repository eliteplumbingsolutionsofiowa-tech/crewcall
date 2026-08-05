type LaunchProgressProps = {
  completed: number
  total: number
}

export default function LaunchProgress({
  completed,
  total,
}: LaunchProgressProps) {
  const progress =
    total === 0
      ? 0
      : Math.round((completed / total) * 100)

  return (
    <section className="rounded-3xl border border-sky-500/20 bg-slate-900/80 p-8 shadow-2xl">

      <div className="flex items-center justify-between">

        <div>

          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">
            Mission Status
          </p>

          <h2 className="mt-2 text-4xl font-black text-white">
            Launch Readiness
          </h2>

          <p className="mt-3 text-slate-400">
            {completed} of {total} launch tasks complete
          </p>

        </div>

        <div className="text-right">

          <div className="text-6xl font-black text-sky-400">
            {progress}%
          </div>

          <div className="text-sm uppercase tracking-widest text-slate-500">
            Ready
          </div>

        </div>

      </div>

      <div className="mt-8 h-4 overflow-hidden rounded-full bg-slate-800">

        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-all duration-700"
          style={{
            width: `${progress}%`,
          }}
        />

      </div>

    </section>
  )
}
