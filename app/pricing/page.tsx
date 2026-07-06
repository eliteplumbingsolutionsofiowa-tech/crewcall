'use client'

import Link from 'next/link'

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white md:px-6">
      <div className="mx-auto max-w-6xl">

        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            Pricing
          </p>

          <h1 className="mt-4 text-5xl font-black">
            Simple Pricing.
            <br />
            No Contracts.
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg text-slate-300">
            CrewCall was built for skilled trades companies that need qualified
            workers fast. One affordable monthly subscription gives your company
            everything needed to hire, message and manage workers.
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-3">

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-2xl font-black">
              Company Membership
            </h2>

            <p className="mt-6 text-6xl font-black text-cyan-300">
              $49
            </p>

            <p className="text-lg text-slate-300">
              per month
            </p>

            <ul className="mt-8 space-y-4 text-slate-200">
              <li>✔ Unlimited Job Posts</li>
              <li>✔ Unlimited Applicants</li>
              <li>✔ Worker Search</li>
              <li>✔ Direct Messaging</li>
              <li>✔ Invite Workers</li>
              <li>✔ Company Dashboard</li>
              <li>✔ Hiring Analytics</li>
              <li>✔ Saved Workers</li>
              <li>✔ Reviews & Ratings</li>
              <li>✔ Job File Uploads</li>
              <li>✔ Mobile Friendly</li>
            </ul>

            <Link
              href="/signup"
              className="mt-10 inline-flex w-full justify-center rounded-2xl bg-cyan-400 px-6 py-4 text-lg font-black text-slate-950 hover:bg-cyan-300"
            >
              Start Free
            </Link>
          </div>

          <div className="rounded-3xl border-2 border-yellow-400 bg-yellow-400/10 p-8 shadow-2xl shadow-yellow-400/10">

            <div className="mb-4 inline-flex rounded-full bg-yellow-400 px-4 py-2 text-sm font-black text-slate-950">
              MOST POPULAR
            </div>

            <h2 className="text-2xl font-black">
              Featured Job
            </h2>

            <p className="mt-6 text-6xl font-black text-yellow-300">
              $25
            </p>

            <p className="text-lg text-slate-300">
              one time
            </p>

            <ul className="mt-8 space-y-4 text-slate-200">
              <li>⭐ Appears Above Standard Jobs</li>
              <li>⭐ More Worker Visibility</li>
              <li>⭐ Featured Badge</li>
              <li>⭐ More Applications</li>
              <li>⭐ Lasts Until Filled</li>
            </ul>

            <div className="mt-10 rounded-2xl bg-slate-900/70 p-4 text-center text-sm font-bold text-slate-300">
              Add anytime while posting a job.
            </div>

          </div>

          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8">

            <h2 className="text-2xl font-black">
              Urgent Hiring
            </h2>

            <p className="mt-6 text-6xl font-black text-red-300">
              $15
            </p>

            <p className="text-lg text-slate-300">
              one time
            </p>

            <ul className="mt-8 space-y-4 text-slate-200">
              <li>🚨 Urgent Badge</li>
              <li>🚨 Higher Search Placement</li>
              <li>🚨 Increased Visibility</li>
              <li>🚨 Faster Worker Response</li>
              <li>🚨 Perfect for Same-Day Needs</li>
            </ul>

            <div className="mt-10 rounded-2xl bg-slate-900/70 p-4 text-center text-sm font-bold text-slate-300">
              Turn on Urgent during job posting.
            </div>

          </div>

        </div>

        <div className="mt-16 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-10">

          <h2 className="text-center text-3xl font-black">
            Why Contractors Choose CrewCall
          </h2>

          <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">

            <Feature
              title="Find Workers Fast"
              text="Post jobs and receive qualified applicants quickly."
            />

            <Feature
              title="Message Instantly"
              text="Communicate directly without exchanging phone numbers."
            />

            <Feature
              title="Hire with Confidence"
              text="View ratings, reviews and worker profiles before hiring."
            />

            <Feature
              title="Grow Your Business"
              text="Fill open positions faster and keep projects moving."
            />

          </div>

        </div>

        <div className="mt-16 text-center">

          <h2 className="text-4xl font-black">
            Ready to Hire Better?
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
            Join the fastest growing hiring network for plumbers, HVAC,
            electricians, pipefitters, welders and skilled trades.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">

            <Link
              href="/signup"
              className="rounded-2xl bg-cyan-400 px-8 py-4 text-lg font-black text-slate-950 hover:bg-cyan-300"
            >
              Start Today
            </Link>

            <Link
              href="/jobs"
              className="rounded-2xl border border-white/20 bg-white/5 px-8 py-4 text-lg font-black hover:bg-white/10"
            >
              Browse Jobs
            </Link>

          </div>

        </div>

      </div>
    </main>
  )
}

function Feature({
  title,
  text,
}: {
  title: string
  text: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-6">
      <h3 className="text-xl font-black">
        {title}
      </h3>

      <p className="mt-3 text-slate-300">
        {text}
      </p>
    </div>
  )
}