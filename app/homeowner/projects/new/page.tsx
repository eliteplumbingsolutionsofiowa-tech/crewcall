import Link from 'next/link'

export default function NewHomeownerProjectPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[2rem] border border-cyan-400/20 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
            New Homeowner Project
          </p>

          <h1 className="mt-4 text-3xl font-black">
            Post a Project
          </h1>

          <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
            The homeowner account foundation is ready. The next build will
            connect this page to CrewCall's contractor bidding system.
          </p>

          <Link
            href="/homeowner/dashboard"
            className="mt-6 inline-flex rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white"
          >
            Back to Homeowner Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
