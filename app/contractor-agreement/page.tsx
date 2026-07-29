export default function ContractorAgreementPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white md:px-6">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/5 p-8">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
          Contractor Agreement
        </p>

        <h1 className="mt-4 text-4xl font-black">
          Independent Contractor Agreement
        </h1>

        <p className="mt-4 text-sm font-bold text-slate-400">
          Last updated: July 2026
        </p>

        <div className="mt-8 space-y-8 text-slate-300">

          <Section title="Independent Relationship">
            CrewCall is a marketplace platform that connects companies and
            skilled workers. CrewCall does not employ workers, supervise work,
            or control the manner in which services are performed.
          </Section>

          <Section title="Worker Responsibilities">
            Workers are responsible for accurately representing their skills,
            experience, licenses, certifications, insurance status, and ability
            to perform accepted work.
          </Section>

          <Section title="Taxes and Payments">
            Workers are responsible for determining and satisfying their own tax
            obligations, business expenses, and reporting requirements.
          </Section>

          <Section title="Safety and Compliance">
            Workers and companies are responsible for following applicable
            safety requirements, laws, permits, and jobsite rules.
          </Section>

          <Section title="No Employment Relationship">
            Use of CrewCall does not create an employment relationship between
            CrewCall and any worker or company.
          </Section>

        </div>
      </div>
    </main>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-2xl font-black text-white">{title}</h2>
      <p className="mt-3 leading-8">{children}</p>
    </section>
  )
}
