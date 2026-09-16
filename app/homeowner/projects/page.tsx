import Link from 'next/link'

export default function HomeownerProjectsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
            Homeowner Projects
          </p>

          <h1 className="mt-4 text-3xl font-black">
            My Projects
          </h1>

          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-400">
            Projects you post to CrewCall will appear here along with the
            contractor bids you receive.
          </p>

          <Link
            href="/homeowner/projects/new"
            className="mt-6 inline-flex rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-4 text-sm font-black text-slate-950"
          >
            Post a Project
          </Link>
        </div>
      </div>
    </main>
  )
}
