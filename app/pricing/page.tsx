'use client'

import Link from 'next/link'

const membershipFeatures = [
  'Unlimited Job Posts',
  'Unlimited Applicants',
  'Worker Search',
  'Direct Messaging',
  'Invite Workers',
  'Job Management',
  'Analytics Dashboard',
  'Reviews & Ratings',
  'File Uploads',
  'Mobile Access',
]

const includedFeatures = [
  {
    title: 'Post Unlimited Jobs',
    text: 'Post as many jobs as you need.',
  },
  {
    title: 'Unlimited Applicants',
    text: 'Receive unlimited applications.',
  },
  {
    title: 'Messaging',
    text: 'Message workers directly in app.',
  },
  {
    title: 'Reviews & Ratings',
    text: 'Build trust with verified reviews.',
  },
  {
    title: 'Analytics',
    text: 'Track views, applications, and hiring performance.',
  },
  {
    title: 'File Uploads',
    text: 'Upload plans, photos, and documents.',
  },
  {
    title: 'Mobile Access',
    text: 'Manage jobs from anywhere.',
  },
]

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white md:px-6">
      <div className="mx-auto max-w-7xl space-y-10">
        <section className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            Pricing
          </p>

          <h1 className="mt-4 text-5xl font-black md:text-6xl">
            Simple Pricing.
            <br />
            No Contracts.
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            CrewCall was built for skilled trades companies that need qualified
            workers fast. Start free, then keep your company moving with one
            affordable monthly membership.
          </p>
        </section>

        <section className="grid gap-8 lg:grid-cols-3">
          <div className="rounded-[2rem] border-2 border-cyan-400 bg-cyan-400/10 p-8 shadow-2xl shadow-cyan-500/10">
            <div className="mb-6 inline-flex rounded-full bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950">
              ★ FOUNDING MEMBER
            </div>

            <h2 className="text-2xl font-black">Company Membership</h2>

            <p className="mt-6 text-xl font-black uppercase text-cyan-300">
              14-Day Free Trial
            </p>

            <p className="mt-2 text-7xl font-black text-cyan-300">FREE</p>

            <p className="mt-2 text-lg text-slate-300">
              No credit card required
            </p>

            <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-slate-950/60 p-5 text-center">
              <p className="text-xl font-black text-cyan-200">
                Then only $29/month
              </p>
              <p className="mt-1 text-sm font-bold text-slate-400">
                for Founding Members
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                Regular price $49/month
              </p>
            </div>

            <ul className="mt-8 space-y-3 text-slate-200">
              {membershipFeatures.map((feature) => (
                <li key={feature} className="font-semibold">
                  ✅ {feature}
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="mt-10 inline-flex w-full justify-center rounded-2xl bg-cyan-400 px-6 py-4 text-lg font-black text-slate-950 hover:bg-cyan-300"
            >
              Start Free Trial
            </Link>

            <p className="mt-4 text-center text-sm font-bold text-slate-400">
              Cancel anytime. No contracts.
            </p>
          </div>

          <div className="rounded-[2rem] border-2 border-yellow-400 bg-yellow-400/10 p-8 shadow-2xl shadow-yellow-400/10">
            <div className="mb-6 inline-flex rounded-full bg-yellow-400 px-4 py-2 text-sm font-black text-slate-950">
              FEATURED
            </div>

            <h2 className="text-2xl font-black">Featured Job</h2>

            <p className="mt-6 text-6xl font-black text-yellow-300">$25</p>

            <p className="text-lg text-slate-300">one time</p>

            <p className="mt-6 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-center text-slate-300">
              Make your job stand out and get more qualified applicants.
            </p>

            <ul className="mt-8 space-y-4 text-slate-200">
              <li>⭐ Appears Above Standard Jobs</li>
              <li>⭐ More Worker Visibility</li>
              <li>⭐ Featured Badge</li>
              <li>⭐ Highlighted in Search</li>
              <li>⭐ Better Applicant Response</li>
            </ul>

            <Link
              href="/faq"
              className="mt-10 inline-flex w-full justify-center rounded-2xl border border-yellow-400 px-6 py-4 text-lg font-black text-white hover:bg-yellow-400 hover:text-slate-950"
            >
              Learn More
            </Link>
          </div>

          <div className="rounded-[2rem] border border-red-400/40 bg-red-500/10 p-8">
            <div className="mb-6 inline-flex rounded-full bg-red-400 px-4 py-2 text-sm font-black text-slate-950">
              URGENT
            </div>

            <h2 className="text-2xl font-black">Urgent Hiring</h2>

            <p className="mt-6 text-6xl font-black text-red-300">$15</p>

            <p className="text-lg text-slate-300">one time</p>

            <p className="mt-6 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-center text-slate-300">
              Need help fast? Get your job in front of more workers.
            </p>

            <ul className="mt-8 space-y-4 text-slate-200">
              <li>🚨 Urgent Badge</li>
              <li>🚨 Higher Search Placement</li>
              <li>🚨 Increased Visibility</li>
              <li>🚨 Faster Worker Response</li>
              <li>🚨 Perfect for Same-Day Needs</li>
            </ul>

            <Link
              href="/faq"
              className="mt-10 inline-flex w-full justify-center rounded-2xl border border-red-400 px-6 py-4 text-lg font-black text-white hover:bg-red-400 hover:text-slate-950"
            >
              Learn More
            </Link>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
          <h2 className="text-center text-3xl font-black text-cyan-300">
            Everything included with your membership
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {includedFeatures.map((feature) => (
              <Feature
                key={feature.title}
                title={feature.title}
                text={feature.text}
              />
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
          <div className="grid gap-6 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-400/30 bg-cyan-400/10 text-4xl">
              🛡️
            </div>

            <div>
              <h2 className="text-3xl font-black">
                Cancel anytime. No contracts.
              </h2>

              <p className="mt-3 max-w-3xl text-slate-300">
                If CrewCall is not right for your company, you can cancel your
                subscription at any time.
              </p>
            </div>

            <Link
              href="/signup"
              className="rounded-2xl border border-cyan-400 px-6 py-4 text-center font-black text-cyan-200 hover:bg-cyan-400 hover:text-slate-950"
            >
              Start Free Trial
            </Link>
          </div>
        </section>

        <section className="text-center">
          <h2 className="text-4xl font-black">Still have questions?</h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            Check out our FAQ or reach out to support.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/faq"
              className="rounded-2xl border border-cyan-400 px-8 py-4 text-lg font-black text-cyan-200 hover:bg-cyan-400 hover:text-slate-950"
            >
              View FAQ
            </Link>

            <Link
              href="/contact"
              className="rounded-2xl border border-cyan-400 px-8 py-4 text-lg font-black text-cyan-200 hover:bg-cyan-400 hover:text-slate-950"
            >
              Contact Us
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 text-center">
      <h3 className="text-base font-black text-cyan-300">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  )
}