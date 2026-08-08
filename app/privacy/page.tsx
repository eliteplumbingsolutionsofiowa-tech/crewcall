import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | CrewCall',
  description: 'Privacy Policy for CrewCall.',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <a
          href="/"
          className="mb-10 inline-block text-sm font-semibold text-blue-400 hover:text-blue-300"
        >
          ← Back to CrewCall
        </a>

        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Privacy Policy
          </h1>
          <p className="mt-3 text-slate-400">
            Effective date: August 7, 2026
          </p>
        </div>

        <div className="space-y-10 leading-7">
          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              1. Introduction
            </h2>
            <p>
              CrewCall provides a platform that helps companies and skilled
              workers connect for work opportunities. This Privacy Policy
              explains how CrewCall collects, uses, stores, and shares
              information when you use our website, mobile application, and
              related services.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              2. Information We Collect
            </h2>
            <p className="mb-3">
              Depending on how you use CrewCall, we may collect information
              including:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Name, email address, phone number, and account information.</li>
              <li>
                Company, trade, skills, work experience, certifications, and
                professional profile information.
              </li>
              <li>
                Job postings, applications, offers, messages, reviews, and
                other content you submit through CrewCall.
              </li>
              <li>
                Approximate or precise location information when you choose to
                enable location-based features.
              </li>
              <li>
                Device, browser, IP address, log, and diagnostic information.
              </li>
              <li>
                Subscription, transaction, and payout-related information.
                Payment information may be processed by third-party payment
                providers rather than stored directly by CrewCall.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              3. How We Use Information
            </h2>
            <p className="mb-3">We may use information to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Create, maintain, and secure CrewCall accounts.</li>
              <li>Connect workers with companies and job opportunities.</li>
              <li>
                Provide job matching, recruiting, messaging, notifications,
                location-based features, and other platform functionality.
              </li>
              <li>Process subscriptions, payments, and worker payouts.</li>
              <li>Verify accounts and help prevent fraud or misuse.</li>
              <li>Provide customer support.</li>
              <li>Improve the performance, reliability, and safety of CrewCall.</li>
              <li>Comply with applicable legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              4. Location Information
            </h2>
            <p>
              CrewCall may use location information to provide features such
              as nearby job opportunities, worker availability, distance
              calculations, and worker mapping. Location access depends on
              your device permissions and CrewCall settings. You can control
              location permissions through your device settings.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              5. How We Share Information
            </h2>
            <p>
              We may share information as necessary to operate CrewCall,
              including with other users when required for marketplace
              functionality and with service providers that support hosting,
              authentication, databases, payments, communications, analytics,
              and security. We may also disclose information when required by
              law or to protect CrewCall, our users, or others.
            </p>
            <p className="mt-3">
              CrewCall does not sell personal information to advertisers.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              6. Payments
            </h2>
            <p>
              CrewCall may use third-party payment processors to handle
              subscriptions, payments, and payouts. Those providers may
              collect financial and identity information according to their
              own privacy policies and legal obligations.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              7. Data Retention
            </h2>
            <p>
              We retain personal information for as long as reasonably
              necessary to provide CrewCall, maintain business and transaction
              records, resolve disputes, enforce agreements, prevent fraud,
              and comply with legal obligations.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              8. Data Security
            </h2>
            <p>
              We use reasonable administrative, technical, and organizational
              safeguards designed to protect information. No method of
              electronic transmission or storage, however, can be guaranteed
              to be completely secure.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              9. Your Choices
            </h2>
            <p>
              You may update certain account information and permissions
              through CrewCall or your device settings. You may also contact
              us regarding access, correction, or deletion of personal
              information, subject to applicable legal and record-retention
              requirements.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              10. Children's Privacy
            </h2>
            <p>
              CrewCall is intended for adults and is not directed to children
              under 13. We do not knowingly collect personal information from
              children under 13.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              11. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy periodically. When we make
              changes, we may update the effective date displayed on this
              page. Continued use of CrewCall after an updated policy becomes
              effective constitutes acceptance of the updated policy to the
              extent permitted by law.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              12. Contact Us
            </h2>
            <p>
              If you have questions about this Privacy Policy or CrewCall's
              privacy practices, please contact CrewCall through the support
              options provided within the application or website.
            </p>
          </section>
        </div>

        <div className="mt-14 border-t border-slate-800 pt-8 text-sm text-slate-500">
          © 2026 CrewCall. All rights reserved.
        </div>
      </div>
    </main>
  )
}
