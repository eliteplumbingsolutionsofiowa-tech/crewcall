export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white md:px-6">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/5 p-8">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
          Privacy Policy
        </p>

        <h1 className="mt-4 text-4xl font-black">Privacy Policy</h1>

        <p className="mt-4 text-sm font-bold text-slate-400">
          Last updated: August 2026
        </p>

        <div className="mt-8 space-y-8 text-slate-300">
          <Section title="Information We Collect">
            CrewCall collects information needed to provide our skilled trades
            marketplace. This may include name, email address, company
            information, trade, role, profile information, job postings,
            applications, reviews, uploaded documents, messages, and payment
            related information.

            We may also collect location information when users enable location
            services to help connect workers and companies based on distance
            and availability.
          </Section>

          <Section title="How We Use Information">
            We use information to create accounts, connect companies with
            workers, display job opportunities, support messaging, process
            payments, improve matching services, maintain security, prevent
            abuse, and provide customer support.
          </Section>

          <Section title="Location Information">
            Workers may choose to share location information to help companies
            find available workers nearby. Location sharing can be managed
            through account settings and device permissions.
          </Section>

          <Section title="Messages and Communications">
            Messages sent through CrewCall may be stored to provide
            communication features between companies and workers, support job
            coordination, and maintain platform security.
          </Section>

          <Section title="Payments">
            Payments may be processed through third-party payment providers
            such as Stripe. CrewCall does not store full payment card numbers
            on its own servers.
          </Section>

          <Section title="Uploaded Files">
            Users may upload profile photos, compliance documents, job files,
            certifications, and other materials. Users are responsible for
            having permission to upload and share these materials.
          </Section>

          <Section title="Sharing Information">
            Information may be shared with other CrewCall users when required
            for platform functionality, including worker profiles, company
            profiles, job postings, applications, reviews, and messages.
          </Section>

          <Section title="Data Security">
            We use reasonable technical and organizational safeguards to
            protect user information. However, no online service can guarantee
            complete security.
          </Section>

          <Section title="Your Choices">
            Users may update profile information, control available settings,
            manage location permissions, and request assistance with their
            account information.

            Users may request account deletion by contacting support.
          </Section>

          <Section title="Contact">
            Questions about this Privacy Policy can be sent to:
            support@crewcall.app
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
