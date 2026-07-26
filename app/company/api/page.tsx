'use client'

export default function CompanyApiPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="text-4xl font-bold">Developer API</h1>

        <p className="mt-4 text-slate-400">
          CrewCall API Center
        </p>

        <div className="mt-8 rounded-xl border border-cyan-500/30 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">
            API Dashboard
          </h2>

          <p className="mt-2 text-slate-400">
            Your API keys, usage, documentation, and integrations will appear here.
          </p>
        </div>
      </div>
    </main>
  )
}
