export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>

      <Section title="Information We Collect">
        We collect account details such as name, email, phone number, and profile information.
      </Section>

      <Section title="How We Use Information">
        Information is used to operate the platform, connect users, and improve services.
      </Section>

      <Section title="Sharing of Information">
        We do not sell your personal data. Information may be shared as needed to operate the platform.
      </Section>

      <Section title="Data Security">
        We take reasonable steps to protect your information but cannot guarantee complete security.
      </Section>

      <Section title="User Control">
        You may update or delete your account information at any time.
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
