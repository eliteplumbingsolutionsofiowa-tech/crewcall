type Props = {
  version: string
  build: number
  platform: 'Web' | 'Android' | 'iOS'
  status: 'Ready' | 'Testing' | 'Blocked'
}

const colors = {
  Ready: 'text-emerald-400 bg-emerald-500/10',
  Testing: 'text-yellow-400 bg-yellow-500/10',
  Blocked: 'text-red-400 bg-red-500/10',
}

export default function ReleaseCandidate({
  version,
  build,
  platform,
  status,
}: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-8">
      <div className="flex items-center justify-between">

        <div>
          <p className="text-sm uppercase tracking-widest text-slate-400">
            Release Candidate
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">
            {platform}
          </h2>
        </div>

        <span
          className={`rounded-full px-4 py-2 text-sm font-bold ${colors[status]}`}
        >
          {status}
        </span>

      </div>

      <div className="mt-8 grid grid-cols-2 gap-6">

        <div>
          <p className="text-xs uppercase text-slate-500">
            Version
          </p>

          <p className="mt-2 text-2xl font-black">
            {version}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase text-slate-500">
            Build
          </p>

          <p className="mt-2 text-2xl font-black">
            #{build}
          </p>
        </div>

      </div>
    </section>
  )
}
