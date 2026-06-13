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
        created_at,
        company:company_id (
          company_name,
          full_name
        )
      `)
      .eq('status', 'open')
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(6)

    const activeFeatured = (featuredData || [])
      .map((job: any) => ({
        ...job,
        company: Array.isArray(job.company) ? job.company[0] : job.company,
      }))
      .filter((job) => isFeatured(job)) as FeaturedJob[]

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

  const displayName =
    profile?.company_name || profile?.full_name || 'Welcome to CrewCall'

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-400">
              CrewCall
            </p>
            <h1 className="mt-3 text-3xl font-black">Loading dashboard...</h1>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 shadow-2xl">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.35fr_0.65fr] lg:p-10">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-400">
                CrewCall
              </p>

              <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Find crews. Fill jobs. Keep the work moving.
              </h1>

              <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-slate-300 sm:text-lg">
                {profile
                  ? `Welcome back, ${displayName}.`
                  : 'The blue-collar hiring network for companies and skilled workers.'}
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                {profile?.role === 'company' ? (
                  <>
                    <Link
                      href="/post-job"
                      className="rounded-2xl bg-orange-500 px-6 py-4 text-center font-black text-slate-950 shadow-lg transition hover:bg-orange-400"
                    >
                      Post a Job
                    </Link>
                    <Link
                      href="/company/jobs"
                      className="rounded-2xl border border-slate-700 bg-slate-800 px-6 py-4 text-center font-black text-white transition hover:bg-slate-700"
                    >
                      Manage Jobs
                    </Link>
                  </>
                ) : profile?.role === 'worker' ? (
                  <>
                    <Link
                      href="/jobs"
                      className="rounded-2xl bg-orange-500 px-6 py-4 text-center font-black text-slate-950 shadow-lg transition hover:bg-orange-400"
                    >
                      Browse Jobs
                    </Link>
                    <Link
                      href="/applications"
                      className="rounded-2xl border border-slate-700 bg-slate-800 px-6 py-4 text-center font-black text-white transition hover:bg-slate-700"
                    >
                      My Applications
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      className="rounded-2xl bg-orange-500 px-6 py-4 text-center font-black text-slate-950 shadow-lg transition hover:bg-orange-400"
                    >
                      Get Started
                    </Link>
                    <Link
                      href="/login"
                      className="rounded-2xl border border-slate-700 bg-slate-800 px-6 py-4 text-center font-black text-white transition hover:bg-slate-700"
                    >
                      Log In
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
                Live Snapshot
              </p>

              <div className="mt-5 space-y-4">
                <StatCard label="Open Jobs" value={openJobsCount} />
                {profile?.role === 'worker' && (
                  <StatCard label="My Applications" value={myApplicationsCount} />
                )}
                {profile?.role === 'company' && (
                  <StatCard label="My Posted Jobs" value={myJobsCount} />
                )}
                {!profile && <StatCard label="Featured Jobs" value={featuredJobs.length} />}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <ActionCard
            title="Companies"
            description="Post jobs, review applicants, invite workers, and keep your crews staffed."
            href={profile?.role === 'company' ? '/post-job' : '/signup'}
            buttonText={profile?.role === 'company' ? 'Post Job' : 'Create Company Account'}
          />

          <ActionCard
            title="Workers"
            description="Find open trade work, apply fast, and build your verified profile."
            href="/jobs"
            buttonText="Browse Work"
          />

          <ActionCard
            title="Trust"
            description="Profiles, insurance, compliance files, reviews, and job history all in one place."
            href={profile ? '/profile' : '/signup'}
            buttonText={profile ? 'View Profile' : 'Build Profile'}
          />
        </section>

        <section className="rounded-[2rem] border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-400">
                Featured Work
              </p>
              <h2 className="mt-2 text-3xl font-black">Boosted open jobs</h2>
            </div>

            <Link
              href="/jobs"
              className="rounded-2xl border border-slate-700 bg-slate-800 px-5 py-3 text-center font-black text-white transition hover:bg-slate-700"
            >
              View All Jobs
            </Link>
          </div>

          {featuredJobs.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-700 bg-slate-950 p-6 text-slate-300">
              No featured jobs are active right now.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featuredJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="group rounded-3xl border border-slate-800 bg-slate-950 p-5 transition hover:-translate-y-1 hover:border-orange-500/60 hover:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">
                        Featured
                      </p>
                      <h3 className="mt-2 text-xl font-black text-white group-hover:text-orange-300">
                        {job.title}
                      </h3>
                    </div>
                  </div>

                  <p className="mt-3 text-sm font-bold text-slate-400">
                    {job.company?.company_name || job.company?.full_name || 'Company'}
                  </p>

                  <div className="mt-4 space-y-2 text-sm font-semibold text-slate-300">
                    <p>{job.trade || 'Trade not listed'}</p>
                    <p>{job.location || 'Location not listed'}</p>
                    <p className="text-orange-300">
                      {job.pay_rate ? `Pay: ${job.pay_rate}` : 'Pay not listed'}
                    </p>
                  </div>

                  <p className="mt-5 font-black text-orange-400">
                    View Job →
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm font-bold text-slate-400">{label}</p>
      <p className="mt-2 text-4xl font-black text-white">{value}</p>
    </div>
  )
}

function ActionCard({
  title,
  description,
  href,
  buttonText,
}: {
  title: string
  description: string
  href: string
  buttonText: string
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
      <h3 className="text-2xl font-black text-white">{title}</h3>
      <p className="mt-3 min-h-[72px] text-sm font-semibold leading-6 text-slate-300">
        {description}
      </p>
      <Link
        href={href}
        className="mt-5 inline-flex rounded-2xl bg-slate-800 px-5 py-3 font-black text-white transition hover:bg-orange-500 hover:text-slate-950"
      >
        {buttonText}
      </Link>
    </div>
  )
}

function isFeatured(job: FeaturedJob) {
  if (!job.is_featured || !job.featured_until) return false
  return new Date(job.featured_until).getTime() > Date.now()
}