export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white md:px-6">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/5 p-8">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
          Privacy Policy
        </p>

        <h1 className="mt-4 text-4xl font-black">Privacy Policy</h1>

        <p className="mt-4 text-sm font-bold text-slate-400">
          Last updated: July 2026
        </p>

        <div className="mt-8 space-y-8 text-slate-300">
          <Section title="Information We Collect">
            CrewCall may collect account information such as your name, email,
            company name, role, trade, location, profile information, job posts,
            applications, messages, reviews, uploaded files, and payment-related
            information.
          </Section>

          <Section title="How We Use Information">
            We use information to operate CrewCall, connect companies and
            workers, process job activity, support messaging, manage accounts,
            improve the service, prevent abuse, and provide customer support.
          </Section>

          <Section title="Payments">
            Payments may be processed through third-party payment providers such
            as Stripe. CrewCall does not store full credit card numbers on its
            own servers.
          </Section>

          <Section title="Uploaded Files">
            Users may upload profile files, job files, compliance documents, or
            other materials. Users are responsible for ensuring they have the
            right to upload and share those files.
          </Section>

          <Section title="Sharing Information">
            Information may be visible to other users when needed for the
            platform to function, such as profiles, job posts, applications,
            reviews, and messages between connected users.
          </Section>

          <Section title="Data Security">
            We use reasonable technical and organizational measures to protect
            account data. No online service can guarantee complete security.
          </Section>

          <Section title="Your Choices">
            You may update your profile, manage your account, and contact
            support with questions about your information.
          </Section>

          <Section title="Contact">
            Questions about this Privacy Policy can be sent to
            support@crewcall.app.
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