'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
  role: 'worker' | 'company' | null
}

type FeaturedJob = {
  id: string
  title: string
  trade: string
  location: string
  pay_rate: string | null
  is_featured: boolean | null
  featured_until: string | null
  company: {
    company_name: string | null
    full_name: string | null
  } | null
}

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [openJobsCount, setOpenJobsCount] = useState(0)
  const [myApplicationsCount, setMyApplicationsCount] = useState(0)
  const [myJobsCount, setMyJobsCount] = useState(0)
  const [featuredJobs, setFeaturedJobs] = useState<FeaturedJob[]>([])

  useEffect(() => {
    loadHome()
  }, [])

  async function loadHome() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { count: jobsCount } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open')

    setOpenJobsCount(jobsCount || 0)

    const { data: featuredData } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        trade,
        location,
        pay_rate,
        is_featured,
        featured_until,
        company:company_id (
          company_name,
          full_name
        )
      `)
      .eq('status', 'open')
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(6)

    const activeFeatured =
      ((featuredData as FeaturedJob[]) || []).filter((job) =>
        isFeatured(job)
      )

    setFeaturedJobs(activeFeatured)

    if (!user) {
      setLoading(false)
      return
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, role')
      .eq('id', user.id)
      .maybeSingle()

    const loadedProfile = profileData as Profile | null
    setProfile(loadedProfile)

    if (loadedProfile?.role === 'worker') {
      const { count } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('worker_id', user.id)

      setMyApplicationsCount(count || 0)
    }

    if (loadedProfile?.role === 'company') {
      const { count } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', user.id)

      setMyJobsCount(count || 0)
    }

    setLoading(false)
  }

  if (loading) return <main className="p-6">Loading CrewCall...</main>

  const loggedIn = !!profile
  const isWorker = profile?.role === 'worker'
  const isCompany = profile?.role === 'company'
  const displayName =
    profile?.company_name || profile?.full_name || 'CrewCall User'

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-900 px-8 py-12 text-white">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-100">
              CrewCall
            </p>

            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
              {loggedIn
                ? `Welcome back, ${displayName}`
                : 'Blue-collar hiring made simple.'}
            </h1>

            <p className="mt-4 max-w-2xl text-slate-200">
              {isCompany
                ? 'Post jobs, track applicants, boost listings, and build reliable crews faster.'
                : isWorker
                ? 'Find trusted jobs, save opportunities, apply fast, and message companies directly.'
                : 'Post work, find crews, apply for jobs, and keep projects moving from one place.'}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/jobs"
                className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-900"
              >
                Browse Jobs
              </Link>

              {isCompany && (
                <>
                  <Link
                    href="/jobs/new"
                    className="rounded-xl border border-white/25 px-5 py-3 font-semibold text-white hover:bg-white/10"
                  >
                    Post Job
                  </Link>

                  <Link
                    href="/my-jobs"
                    className="rounded-xl border border-white/25 px-5 py-3 font-semibold text-white hover:bg-white/10"
                  >
                    My Jobs
                  </Link>
                </>
              )}

              {isWorker && (
                <>
                  <Link
                    href="/my-applications"
                    className="rounded-xl border border-white/25 px-5 py-3 font-semibold text-white hover:bg-white/10"
                  >
                    My Applications
                  </Link>

                  <Link
                    href="/saved-jobs"
                    className="rounded-xl border border-white/25 px-5 py-3 font-semibold text-white hover:bg-white/10"
                  >
                    Saved Jobs
                  </Link>
                </>
              )}

              {!loggedIn && (
                <>
                  <Link
                    href="/signup"
                    className="rounded-xl border border-white/25 px-5 py-3 font-semibold text-white hover:bg-white/10"
                  >
                    Get Started
                  </Link>

                  <Link
                    href="/login"
                    className="rounded-xl border border-white/25 px-5 py-3 font-semibold text-white hover:bg-white/10"
                  >
                    Log In
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {featuredJobs.length > 0 && (
          <div className="rounded-3xl border-2 border-yellow-300 bg-yellow-50 p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold uppercase text-yellow-800">
                  Featured Jobs
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Boosted opportunities hiring now
                </h2>
              </div>

              <Link
                href="/jobs"
                className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-bold text-yellow-950 hover:bg-yellow-400"
              >
                View All Jobs
              </Link>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {featuredJobs.map((job) => {
                const companyName =
                  job.company?.company_name ||
                  job.company?.full_name ||
                  'Company'

                return (
                  <div
                    key={job.id}
                    className="rounded-2xl border border-yellow-200 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-3">
                      <span className="rounded-full bg-yellow-200 px-3 py-1 text-xs font-bold text-yellow-900">
                        ⭐ Featured
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900">
                      {job.title}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {companyName}
                    </p>

                    <p className="mt-3 text-sm text-slate-700">
                      {job.trade} · {job.location}
                    </p>

                    <p className="mt-2 text-sm text-slate-600">
                      Pay: {job.pay_rate || 'Not listed'}
                    </p>

                    <Link
                      href={`/jobs/${job.id}`}
                      className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      View Job
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-3">
          <StatCard
            title="Open Jobs"
            value={String(openJobsCount)}
            text="Active jobs available now."
          />
          <StatCard
            title="Fast Hiring"
            value="Direct"
            text="Message, apply, hire, and review from one flow."
          />
          <StatCard
            title="Trusted Crews"
            value="Verified"
            text="Compliance, reviews, saved jobs, and performance stats."
          />
        </div>

        {loggedIn && (
          <div className="grid gap-5 md:grid-cols-3">
            {isWorker && (
              <DashboardCard
                title="My Applications"
                value={String(myApplicationsCount)}
                text="Jobs you have applied to."
                href="/my-applications"
                linkText="View applications"
              />
            )}

            {isCompany && (
              <DashboardCard
                title="My Jobs"
                value={String(myJobsCount)}
                text="Jobs posted by your company."
                href="/my-jobs"
                linkText="Manage jobs"
              />
            )}

            <DashboardCard
              title="Messages"
              value="Inbox"
              text="Keep job conversations moving."
              href="/messages"
              linkText="Open messages"
            />

            <DashboardCard
              title="Profile"
              value="Account"
              text="Manage your public CrewCall profile."
              href="/profile"
              linkText="View profile"
            />
          </div>
        )}

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            How CrewCall Works
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Step
              title="1. Post or Find Work"
              text="Companies post jobs. Workers browse, filter, save, and apply."
            />
            <Step
              title="2. Message Fast"
              text="Companies and workers connect directly inside CrewCall."
            />
            <Step
              title="3. Hire and Review"
              text="Hire workers, complete jobs, leave reviews, and build trust."
            />
          </div>
        </div>
      </section>
    </main>
  )
}

function isFeatured(job: FeaturedJob) {
  if (!job.is_featured || !job.featured_until) return false
  return new Date(job.featured_until).getTime() > Date.now()
}

function StatCard({
  title,
  value,
  text,
}: {
  title: string
  value: string
  text: string
}) {
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <p className="text-sm font-bold uppercase text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
    </div>
  )
}

function DashboardCard({
  title,
  value,
  text,
  href,
  linkText,
}: {
  title: string
  value: string
  text: string
  href: string
  linkText: string
}) {
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <p className="text-sm font-bold uppercase text-blue-700">{title}</p>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
      <Link
        href={href}
        className="mt-4 inline-flex text-sm font-bold text-blue-700 hover:text-blue-800"
      >
        {linkText} →
      </Link>
    </div>
  )
}

function Step({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
    </div>
  )
}