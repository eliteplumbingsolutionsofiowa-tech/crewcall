'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { isNativeIOS } from '@/app/lib/nativePlatform'

const CREWCALL_VIDEO_URL =
  'https://uwegfsuzbnryxxygghiz.supabase.co/storage/v1/object/public/videos/crewcall-launch.mp4'

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

type PlatformStats = {
  companies: number
  workers: number
  openJobs: number
  completedJobs: number
  applications: number
  reviews: number
}

export default function HomePage() {
  const t = useTranslations('Home')
  const nativeIOS = isNativeIOS()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myApplicationsCount, setMyApplicationsCount] = useState(0)
  const [myJobsCount, setMyJobsCount] = useState(0)
  const [featuredJobs, setFeaturedJobs] = useState<FeaturedJob[]>([])
  const [stats, setStats] = useState<PlatformStats>({
    companies: 0,
    workers: 0,
    openJobs: 0,
    completedJobs: 0,
    applications: 0,
    reviews: 0,
  })

  useEffect(() => {
    loadHome()
  }, [])

  async function loadHome() {
    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

    const [
      companiesRes,
      workersRes,
      openJobsRes,
      completedJobsRes,
      applicationsRes,
      reviewsRes,
      featuredRes,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'company'),

      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'worker'),

      supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open'),

      supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed'),

      supabase.from('applications').select('*', { count: 'exact', head: true }),

      supabase.from('reviews').select('*', { count: 'exact', head: true }),

      supabase
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
        .limit(6),
    ])

    setStats({
      companies: companiesRes.count || 0,
      workers: workersRes.count || 0,
      openJobs: openJobsRes.count || 0,
      completedJobs: completedJobsRes.count || 0,
      applications: applicationsRes.count || 0,
      reviews: reviewsRes.count || 0,
    })

    const activeFeatured = (featuredRes.data || [])
      .map((job: any) => ({
        ...job,
        company: Array.isArray(job.company) ? job.company[0] : job.company,
      }))
      .filter((job) => isFeatured(job)) as FeaturedJob[]

    setFeaturedJobs(activeFeatured)

    if (!user) {
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

    } catch (error) {
      console.error('Home page failed to load:', error)
    } finally {
      setLoading(false)
    }
  }

  const displayName =
    profile?.company_name || profile?.full_name || t('welcomeToCrewCall')

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
              CrewCall
            </p>
            <h1 className="mt-3 text-3xl font-black">{t('loading')}</h1>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-200">
              {t('publicBeta')}
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
              {t('heroTitle')}
            </h1>

            <p className="mt-6 max-w-3xl text-lg font-semibold leading-8 text-slate-300">
              {t('heroDescription')}
            </p>

            <div className="mt-6 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
              <p className="text-xl font-black text-cyan-100">
                {t('freeTrialBanner')}
              </p>
              {!nativeIOS ? (
                <p className="mt-2 text-sm font-bold text-slate-300">
                  {t('foundingPrice')}
                </p>
              ) : null}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {profile?.role === 'company' ? (
                <>
                  <Link href="/company/dashboard" className="primary-btn">
                    {t('companyDashboard')}
                  </Link>
                  <Link href="/post-job" className="secondary-btn">
                    {t('postJob')}
                  </Link>
                </>
              ) : profile?.role === 'worker' ? (
                <>
                  <Link href="/worker/dashboard" className="primary-btn">
                    {t('workerDashboard')}
                  </Link>
                  <Link href="/jobs" className="secondary-btn">
                    {t('browseJobs')}
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/signup" className="primary-btn">
                    {t('startFreeTrial')}
                  </Link>
                  <Link href="/jobs" className="secondary-btn">
                    {t('browseJobs')}
                  </Link>
                </>
              )}
            </div>

            {profile && (
              <p className="mt-5 text-sm font-bold text-slate-400">
                {t('welcomeBack', { name: displayName })}
              </p>
            )}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-500/10">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
              {t('liveSnapshot')}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <StatCard label={t('companies')} value={stats.companies} />
              <StatCard label={t('workers')} value={stats.workers} />
              <StatCard label={t('openJobs')} value={stats.openJobs} />
              <StatCard label={t('completed')} value={stats.completedJobs} />
              <StatCard label={t('applications')} value={stats.applications} />
              <StatCard label={t('reviews')} value={stats.reviews} />

              {profile?.role === 'worker' && (
                <StatCard label={t('myApplications')} value={myApplicationsCount} />
              )}

              {profile?.role === 'company' && (
                <StatCard label={t('myPostedJobs')} value={myJobsCount} />
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-7xl">
          <div className="overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-black shadow-2xl shadow-cyan-500/20">
            <div className="border-b border-white/10 bg-slate-950/80 px-5 py-4">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
                {t('watchInAction')}
              </p>
            </div>

            <video
              className="aspect-video w-full bg-black object-cover"
              autoPlay
              muted
              loop
              playsInline
              controls
              preload="auto"
            >
              <source src={CREWCALL_VIDEO_URL} type="video/mp4" />
            </video>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow={t('builtForTrades')}
            title={t('platformTitle')}
            text={t('platformText')}
          />

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              t('plumbing'),
              t('hvac'),
              t('electrical'),
              t('pipefitting'),
              t('welding'),
              t('carpentry'),
              t('concrete'),
              t('generalLabor'),
            ].map((trade) => (
              <div
                key={trade}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
              >
                <p className="text-2xl font-black">{trade}</p>
                <p className="mt-2 text-sm font-semibold text-slate-400">
                  {t('tradeCardText')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          <HowItWorks
            title={t('forCompanies')}
            steps={[
              t('postAJob'),
              t('receiveApplicants'),
              t('messageWorkers'),
              t('hireRightPerson'),
              t('paySecurely'),
            ]}
            href="/signup"
            buttonText={t('startCompanyTrial')}
          />

          <HowItWorks
            title={t('forWorkers')}
            steps={[
              t('createProfile'),
              t('browseOpenJobs'),
              t('applyFast'),
              t('getHired'),
              t('buildReviews'),
            ]}
            href="/jobs"
            buttonText={t('browseWork')}
          />
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-cyan-400/20 bg-cyan-400/10 p-8">
          <SectionHeader
            eyebrow={t('whyCrewCall')}
            title={t('hireFasterTitle')}
            text={t('hireFasterText')}
          />

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              t('hireFaster'),
              t('workerProfiles'),
              t('securePayments'),
              t('messagingBuiltIn'),
              t('ratingsReviews'),
              t('fileUploads'),
              t('mobileFriendly'),
              t('iowaBased'),
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
              >
                <p className="text-lg font-black">✓ {item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
                {t('featuredWork')}
              </p>
              <h2 className="mt-2 text-3xl font-black">{t('boostedOpenJobs')}</h2>
            </div>

            <Link href="/jobs" className="secondary-btn">
              {t('viewAllJobs')}
            </Link>
          </div>

          {featuredJobs.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-slate-950/60 p-6 text-slate-300">
              {t('noFeaturedJobs')}
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featuredJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="group rounded-3xl border border-white/10 bg-slate-950/60 p-5 transition hover:-translate-y-1 hover:border-cyan-400/60"
                >
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
                    {t('featured')}
                  </p>

                  <h3 className="mt-2 text-xl font-black text-white group-hover:text-cyan-300">
                    {job.title}
                  </h3>

                  <p className="mt-3 text-sm font-bold text-slate-400">
                    {job.company?.company_name ||
                      job.company?.full_name ||
                      t('company')}
                  </p>

                  <div className="mt-4 space-y-2 text-sm font-semibold text-slate-300">
                    <p>{job.trade || t('tradeNotListed')}</p>
                    <p>{job.location || t('locationNotListed')}</p>
                    <p className="text-cyan-300">
                      {job.pay_rate ? t('pay', { pay: job.pay_rate }) : t('payNotListed')}
                    </p>
                  </div>

                  <p className="mt-5 font-black text-cyan-300">{t('viewJob')}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {!nativeIOS ? (
        <>
      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow={t('pricing')}
            title={t('pricingTitle')}
            text={t('pricingText')}
          />

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <PriceCard
              title={t('freeTrial')}
              price="$0"
              text={t('trialText')}
              items={[
                t('unlimitedJobPosts'),
                t('workerSearch'),
                t('messaging'),
                t('applicants'),
                t('analytics'),
              ]}
            />

            <PriceCard
              title={t('foundingMember')}
              price="$29/mo"
              text={t('foundingMemberText')}
              items={[
                t('everythingInTrial'),
                t('companyDashboardFeature'),
                t('savedWorkers'),
                t('reviews'),
                t('fileUploads'),
              ]}
              highlight
              badgeText={t('bestLaunchDeal')}
            />

            <PriceCard
              title={t('regularPlan')}
              price="$49/mo"
              text={t('regularPlanText')}
              items={[
                t('unlimitedHiringTools'),
                t('noContracts'),
                t('cancelAnytime'),
                t('featuredJobsOptional'),
                t('urgentJobsOptional'),
              ]}
            />
          </div>

          <div className="mt-8 text-center">
            <Link href="/pricing" className="secondary-btn">
              {t('viewFullPricing')}
            </Link>
          </div>
        </div>
      </section>

        </>
      ) : null}

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-cyan-400/20 bg-gradient-to-r from-cyan-400/20 to-blue-500/20 p-10 text-center">
          <h2 className="text-4xl font-black">
            {t('readyTitle')}
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-300">
            {t('readyText')}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/signup" className="primary-btn">
              {t('startFreeTrial')}
            </Link>

            <Link href="/jobs" className="secondary-btn">
              {t('browseJobs')}
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xl font-black">CrewCall</p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {t('tagline')}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-300">
            <Link href="/about">{t('about')}</Link>
            <Link href="/contact">{t('contact')}</Link>
            {!nativeIOS ? <Link href="/pricing">{t('pricing')}</Link> : null}
            <Link href="/faq">{t('faq')}</Link>
            <Link href="/privacy">{t('privacy')}</Link>
            <Link href="/terms">{t('terms')}</Link>
            <Link href="/jobs">{t('jobs')}</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
      <p className="text-sm font-bold text-slate-400">{label}</p>
      <p className="mt-2 text-4xl font-black text-white">{value}</p>
    </div>
  )
}

function SectionHeader({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string
  title: string
  text: string
}) {
  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
        {eyebrow}
      </p>
      <h2 className="mt-3 max-w-4xl text-3xl font-black sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-slate-300">
        {text}
      </p>
    </div>
  )
}

function HowItWorks({
  title,
  steps,
  href,
  buttonText,
}: {
  title: string
  steps: string[]
  href: string
  buttonText: string
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
      <h2 className="text-3xl font-black">{title}</h2>

      <div className="mt-6 space-y-4">
        {steps.map((step, index) => (
          <div
            key={step}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400 text-lg font-black text-slate-950">
              {index + 1}
            </div>
            <p className="font-black text-white">{step}</p>
          </div>
        ))}
      </div>

      <Link href={href} className="mt-6 inline-flex primary-btn">
        {buttonText}
      </Link>
    </div>
  )
}

function PriceCard({
  title,
  price,
  text,
  items,
  highlight = false,
  badgeText,
}: {
  title: string
  price: string
  text: string
  items: string[]
  highlight?: boolean
  badgeText?: string
}) {
  return (
    <div
      className={`rounded-[2rem] border p-8 ${
        highlight
          ? 'border-cyan-300 bg-cyan-400/10 shadow-2xl shadow-cyan-500/10'
          : 'border-white/10 bg-white/5'
      }`}
    >
      {highlight && (
        <div className="mb-4 inline-flex rounded-full bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950">
          {badgeText}
        </div>
      )}

      <h3 className="text-2xl font-black">{title}</h3>
      <p className="mt-5 text-5xl font-black text-cyan-300">{price}</p>
      <p className="mt-2 text-sm font-bold text-slate-400">{text}</p>

      <ul className="mt-6 space-y-3 text-sm font-semibold text-slate-300">
        {items.map((item) => (
          <li key={item}>✓ {item}</li>
        ))}
      </ul>
    </div>
  )
}

function isFeatured(job: FeaturedJob) {
  if (!job.is_featured || !job.featured_until) return false
  return new Date(job.featured_until).getTime() > Date.now()
}