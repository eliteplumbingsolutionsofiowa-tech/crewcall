import Link from 'next/link'

const companyFaq = [
  {
    question: 'How does CrewCall work?',
    answer:
      'Create a company account, post a job, review applicants, message workers, hire the right person, and pay securely through the platform.',
  },
  {
    question: 'How much does CrewCall cost?',
    answer:
      'Companies receive a 14-day free trial. Founding Members can lock in $29/month during beta. Regular pricing is $49/month.',
  },
  {
    question: 'Can I post unlimited jobs?',
    answer:
      'Yes. Company memberships include unlimited job postings and unlimited applicants.',
  },
  {
    question: 'Can I hire someone permanently?',
    answer:
      'Yes. CrewCall helps companies connect with workers. Any long-term employment relationship is between the company and the worker.',
  },
  {
    question: 'How do payments work?',
    answer:
      'Payments are securely processed through Stripe. Companies pay through CrewCall and workers receive payouts after approved job completion.',
  },
]

const workerFaq = [
  {
    question: 'Is CrewCall free for workers?',
    answer:
      'Yes. Workers can create an account, build a profile, browse jobs, and apply at no cost.',
  },
  {
    question: 'How do I get paid?',
    answer:
      'Companies pay through CrewCall. Approved payments are released to your connected payout account.',
  },
  {
    question: 'Can I work for multiple companies?',
    answer:
      'Absolutely. You control which jobs you apply for and who you work with.',
  },
  {
    question: 'How do reviews work?',
    answer:
      'After completed jobs, both companies and workers can leave reviews to help build trust within the marketplace.',
  },
  {
    question: 'Do I need insurance?',
    answer:
      'Some jobs may require insurance or additional compliance documents. Companies determine the requirements for their projects.',
  },
]

const generalFaq = [
  {
    question: 'Where is CrewCall available?',
    answer:
      'CrewCall is launching in Iowa and will continue expanding into additional markets.',
  },
  {
    question: 'How do I contact support?',
    answer:
      'You can contact our support team through the Contact page or by emailing support@crewcall.app.',
  },
  {
    question: 'Can I cancel my subscription?',
    answer:
      'Yes. Company subscriptions can be canceled at any time.',
  },
  {
    question: 'What trades are supported?',
    answer:
      'Plumbing, HVAC, Electrical, Pipefitting, Welding, Carpentry, Concrete, General Labor, and many other skilled trades.',
  },
]

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white md:px-6">
      <div className="mx-auto max-w-5xl">

        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            Frequently Asked Questions
          </p>

          <h1 className="mt-4 text-5xl font-black">
            Everything you need to know
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg text-slate-300">
            Answers to the most common questions from companies and skilled
            trades workers.
          </p>
        </div>

        <Section
          title="For Companies"
          items={companyFaq}
        />

        <Section
          title="For Workers"
          items={workerFaq}
        />

        <Section
          title="General Questions"
          items={generalFaq}
        />

        <div className="mt-16 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-8 text-center">

          <h2 className="text-3xl font-black">
            Still have questions?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            We're here to help. Reach out anytime and we'll get back to you as
            quickly as possible.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">

            <Link
              href="/contact"
              className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 hover:bg-cyan-300"
            >
              Contact Us
            </Link>

            <Link
              href="/signup"
              className="rounded-2xl border border-white/20 bg-white/5 px-6 py-4 font-black hover:bg-white/10"
            >
              Start Free Trial
            </Link>

          </div>
        </div>

      </div>
    </main>
  )
}

function Section({
  title,
  items,
}: {
  title: string
  items: {
    question: string
    answer: string
  }[]
}) {
  return (
    <section className="mt-16">
      <h2 className="mb-8 text-3xl font-black">
        {title}
      </h2>

      <div className="space-y-5">

        {items.map((item) => (
          <div
            key={item.question}
            className="rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <h3 className="text-xl font-black">
              {item.question}
            </h3>

            <p className="mt-3 leading-8 text-slate-300">
              {item.answer}
            </p>
          </div>
        ))}

      </div>
    </section>
  )
}