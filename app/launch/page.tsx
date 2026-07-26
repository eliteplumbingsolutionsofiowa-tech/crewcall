'use client'

const companyBenefits = [
  'Fill labor shortages faster',
  'AI-powered worker matching',
  'Verified skilled trades',
  'Secure payments',
  'Build your trusted crew',
]

const workerBenefits = [
  'Find local jobs',
  'Work with better companies',
  'Control your availability',
  'Get paid securely',
  'Build your reputation',
]

const stats = [
  {
    value: 'AI Powered',
    label: 'Smart worker matching',
  },
  {
    value: 'Verified',
    label: 'Trade profiles',
  },
  {
    value: 'Secure',
    label: 'Stripe payments',
  },
  {
    value: 'Growing',
    label: 'Nationwide network',
  },
]

const faqs = [
  {
    q: 'How does CrewCall work?',
    a: 'Companies post jobs and skilled workers can apply, receive invites, and get hired through the platform.',
  },
  {
    q: 'What trades are supported?',
    a: 'CrewCall is built for skilled trades including plumbing, HVAC, electrical, construction, and more.',
  },
  {
    q: 'How do payments work?',
    a: 'Companies pay through CrewCall and workers receive secure payouts after job completion.',
  },
  {
    q: 'How much does CrewCall cost?',
    a: 'CrewCall offers simple pricing with no long-term contracts.',
  },
]

export default function LaunchPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">

      <section className="mx-auto max-w-7xl px-6 py-16">

        <div className="rounded-3xl border border-cyan-400/20 bg-white/5 p-10 text-center">

          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
            CrewCall Launch
          </p>

          <h1 className="mt-5 text-5xl font-black">
            Find Help.
            <br />
            Find Work.
            <br />
            Fast.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
            The blue-collar hiring network built for skilled trades.
            Connect companies with qualified workers when they need help most.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">

            <button className="rounded-xl bg-cyan-400 px-8 py-4 font-black text-slate-950">
              Join as Company
            </button>

            <button className="rounded-xl bg-white/10 px-8 py-4 font-black">
              Join as Worker
            </button>

          </div>

        </div>


        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center"
            >
              <p className="text-2xl font-black text-cyan-300">
                {item.value}
              </p>

              <p className="mt-2 text-sm text-slate-400">
                {item.label}
              </p>
            </div>
          ))}

        </section>


        <section className="mt-12 grid gap-6 lg:grid-cols-2">

          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">

            <h2 className="text-3xl font-black">
              For Companies
            </h2>

            <ul className="mt-5 space-y-3 text-slate-300">

              {companyBenefits.map((item) => (
                <li key={item}>
                  ✓ {item}
                </li>
              ))}

            </ul>

          </div>


          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">

            <h2 className="text-3xl font-black">
              For Workers
            </h2>

            <ul className="mt-5 space-y-3 text-slate-300">

              {workerBenefits.map((item) => (
                <li key={item}>
                  ✓ {item}
                </li>
              ))}

            </ul>

          </div>

        </section>


        <section className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-8">

          <h2 className="text-3xl font-black">
            Why CrewCall?
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">

            <Feature title="AI Recruiting">
              Find qualified workers faster.
            </Feature>

            <Feature title="Verified Trades">
              See experience, insurance, and ratings.
            </Feature>

            <Feature title="Secure Hiring">
              Manage jobs and payments in one place.
            </Feature>

          </div>

        </section>


        <section className="mt-12 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-8">

          <h2 className="text-3xl font-black">
            Get Early Access
          </h2>

          <p className="mt-3 text-slate-300">
            Join contractors and skilled workers building the future of trade hiring.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">

            <input
              placeholder="Name"
              className="rounded-xl bg-slate-950 px-4 py-3"
            />

            <input
              placeholder="Email"
              className="rounded-xl bg-slate-950 px-4 py-3"
            />

            <button className="rounded-xl bg-cyan-400 font-black text-slate-950">
              Request Access
            </button>

          </div>

        </section>


        <section className="mt-12">

          <h2 className="text-3xl font-black">
            FAQ
          </h2>

          <div className="mt-5 space-y-4">

            {faqs.map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-white/10 bg-white/5 p-5"
              >
                <h3 className="font-black">
                  {item.q}
                </h3>

                <p className="mt-2 text-slate-400">
                  {item.a}
                </p>

              </div>
            ))}

          </div>

        </section>

      </section>

    </main>
  )
}

function Feature({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl bg-slate-950/60 p-5">
      <h3 className="font-black">
        {title}
      </h3>

      <p className="mt-2 text-slate-400">
        {children}
      </p>
    </div>
  )
}
