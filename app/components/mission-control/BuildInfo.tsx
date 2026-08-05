export default function BuildInfo() {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-8">
      <h2 className="text-2xl font-black text-white">
        Build Information
      </h2>

      <div className="mt-6 space-y-3 text-sm">

        <div className="flex justify-between">
          <span className="text-slate-400">Environment</span>
          <span>Production</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Platform</span>
          <span>Next.js 16</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Release</span>
          <span>1.0.0 RC1</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Status</span>
          <span className="text-emerald-400">
            Healthy
          </span>
        </div>

      </div>
    </section>
  )
}
