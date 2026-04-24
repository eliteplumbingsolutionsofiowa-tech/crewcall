export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">Terms of Service</h1>

      <p>
        By using CrewCall, you agree to the following terms and conditions.
      </p>

      <Section title="Platform Role">
        CrewCall is a marketplace that connects workers and companies. We do not employ workers or act as a contractor.
      </Section>

      <Section title="User Responsibility">
        Users are responsible for verifying licenses, insurance, and qualifications before entering into any agreement.
      </Section>

      <Section title="Payments">
        Any payments made between users are outside of CrewCall unless otherwise specified. CrewCall is not responsible for disputes.
      </Section>

      <Section title="Liability">
        CrewCall is not liable for damages, injuries, or losses resulting from work arranged through the platform.
      </Section>

      <Section title="Account Use">
        You agree not to misuse the platform, post false jobs, or provide misleading information.
      </Section>

      <Section title="Termination">
        We reserve the right to suspend or terminate accounts that violate these terms.
      </Section>

      <p className="text-sm text-gray-500">
        Last updated: {new Date().toLocaleDateString()}
      </p>
    </main>
  )
}

function Section({ title, children }: any) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-gray-700">{children}</p>
    </div>
  )
}