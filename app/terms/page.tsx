export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white md:px-6">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/5 p-8">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
          Terms of Service
        </p>

        <h1 className="mt-4 text-4xl font-black">Terms of Service</h1>

        <p className="mt-4 text-sm font-bold text-slate-400">
          Last updated: July 2026
        </p>

        <div className="mt-8 space-y-8 text-slate-300">
          <Section title="Use of CrewCall">
            CrewCall is a platform that helps companies and skilled trades
            workers connect. Users are responsible for the accuracy of the
            information they provide and for complying with all applicable laws.
          </Section>

          <Section title="Accounts">
            You are responsible for maintaining the security of your account and
            for all activity under your account.
          </Section>

          <Section title="Jobs and Applications">
            Companies are responsible for job postings, hiring decisions, jobsite
            requirements, pay terms, and compliance with employment and
            contractor laws. Workers are responsible for accurately representing
            their skills, experience, licenses, and availability.
          </Section>

          <Section title="Payments">
            Paid features, subscriptions, job payments, and add-ons may be
            processed through third-party payment providers. Fees, subscriptions,
            and add-on purchases are subject to the terms shown at checkout.
          </Section>

          <Section title="User Content">
            Users may post jobs, profiles, messages, reviews, and upload files.
            You are responsible for your content and agree not to upload false,
            illegal, harmful, or infringing material.
          </Section>

          <Section title="No Guarantee">
            CrewCall does not guarantee that a company will find workers, that a
            worker will be hired, or that any job relationship will be successful.
          </Section>

          <Section title="Reviews">
            Reviews should be honest and based on real interactions. CrewCall may
            remove reviews or content that appears abusive, false, or violates
            platform rules.
          </Section>

          <Section title="Termination">
            CrewCall may suspend or remove accounts that misuse the platform,
            violate these terms, or create risk for other users.
          </Section>

          <Section title="Contact">
            Questions about these Terms can be sent to support@crewcall.app.
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