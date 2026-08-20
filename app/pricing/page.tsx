'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { isNativeIOS } from '@/app/lib/nativePlatform'

export default function PricingPage() {
  const t = useTranslations('Pricing')
  const nativeIOS = isNativeIOS()

  const membershipFeatures = [
    t('unlimitedJobPosts'),
    t('unlimitedApplicants'),
    t('workerSearch'),
    t('directMessaging'),
    t('inviteWorkers'),
    t('jobManagement'),
    t('analyticsDashboard'),
    t('reviewsRatings'),
    t('fileUploads'),
    t('mobileAccess'),
  ]

  const includedFeatures = [
    {
      title: t('postUnlimitedJobs'),
      text: t('postUnlimitedJobsText'),
    },
    {
      title: t('unlimitedApplicants'),
      text: t('unlimitedApplicantsText'),
    },
    {
      title: t('messaging'),
      text: t('messagingText'),
    },
    {
      title: t('reviewsRatings'),
      text: t('reviewsText'),
    },
    {
      title: t('analytics'),
      text: t('analyticsText'),
    },
    {
      title: t('fileUploads'),
      text: t('fileUploadsText'),
    },
    {
      title: t('mobileAccess'),
      text: t('mobileAccessText'),
    },
  ]

  if (nativeIOS) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white md:px-6">
        <div className="mx-auto max-w-3xl">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
              CrewCall
            </p>

            <h1 className="mt-4 text-4xl font-black">
              {t('companyAccess')}
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-7 text-slate-300">
              {t('companyAccessDescription')}
            </p>

            <Link
              href="/signup"
              className="mt-8 inline-flex rounded-2xl bg-cyan-400 px-6 py-4 text-lg font-black text-slate-950 hover:bg-cyan-300"
            >
              {t('startFreeTrial')}
            </Link>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white md:px-6">
      <div className="mx-auto max-w-7xl space-y-10">
        <section className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            {t('pricing')}
          </p>

          <h1 className="mt-4 text-5xl font-black md:text-6xl">
            {t('simplePricing')}
            <br />
            {t('noContracts')}
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            {t('description')}
          </p>
        </section>

        <section className="grid gap-8 lg:grid-cols-3">
          <div className="rounded-[2rem] border-2 border-cyan-400 bg-cyan-400/10 p-8 shadow-2xl shadow-cyan-500/10">
            <div className="mb-6 inline-flex rounded-full bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950">
              {t('foundingMember')}
            </div>

            <h2 className="text-2xl font-black">{t('companyMembership')}</h2>

            <p className="mt-6 text-xl font-black uppercase text-cyan-300">
              {t('freeTrial')}
            </p>

            <p className="mt-2 text-7xl font-black text-cyan-300">{t('free')}</p>

            <p className="mt-2 text-lg text-slate-300">
              {t('noCreditCard')}
            </p>

            <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-slate-950/60 p-5 text-center">
              <p className="text-xl font-black text-cyan-200">
                {t('thenOnly')}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-400">
                {t('forFoundingMembers')}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {t('regularPrice')}
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
              {t('startFreeTrial')}
            </Link>

            <p className="mt-4 text-center text-sm font-bold text-slate-400">
              {t('cancelAnytime')}
            </p>
          </div>

          <div className="rounded-[2rem] border-2 border-yellow-400 bg-yellow-400/10 p-8 shadow-2xl shadow-yellow-400/10">
            <div className="mb-6 inline-flex rounded-full bg-yellow-400 px-4 py-2 text-sm font-black text-slate-950">
              {t('featured')}
            </div>

            <h2 className="text-2xl font-black">{t('featuredJob')}</h2>

            <p className="mt-6 text-6xl font-black text-yellow-300">$25</p>

            <p className="text-lg text-slate-300">{t('oneTime')}</p>

            <p className="mt-6 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-center text-slate-300">
              {t('featuredDescription')}
            </p>

            <ul className="mt-8 space-y-4 text-slate-200">
              <li>⭐ {t('appearsAbove')}</li>
              <li>⭐ {t('moreVisibility')}</li>
              <li>⭐ {t('featuredBadge')}</li>
              <li>⭐ {t('highlightedSearch')}</li>
              <li>⭐ {t('betterResponse')}</li>
            </ul>

            <Link
              href="/faq"
              className="mt-10 inline-flex w-full justify-center rounded-2xl border border-yellow-400 px-6 py-4 text-lg font-black text-white hover:bg-yellow-400 hover:text-slate-950"
            >
              {t('learnMore')}
            </Link>
          </div>

          <div className="rounded-[2rem] border border-red-400/40 bg-red-500/10 p-8">
            <div className="mb-6 inline-flex rounded-full bg-red-400 px-4 py-2 text-sm font-black text-slate-950">
              {t('urgent')}
            </div>

            <h2 className="text-2xl font-black">{t('urgentHiring')}</h2>

            <p className="mt-6 text-6xl font-black text-red-300">$15</p>

            <p className="text-lg text-slate-300">{t('oneTime')}</p>

            <p className="mt-6 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-center text-slate-300">
              {t('urgentDescription')}
            </p>

            <ul className="mt-8 space-y-4 text-slate-200">
              <li>🚨 {t('urgentBadge')}</li>
              <li>🚨 {t('higherPlacement')}</li>
              <li>🚨 {t('increasedVisibility')}</li>
              <li>🚨 {t('fasterResponse')}</li>
              <li>🚨 {t('sameDayNeeds')}</li>
            </ul>

            <Link
              href="/faq"
              className="mt-10 inline-flex w-full justify-center rounded-2xl border border-red-400 px-6 py-4 text-lg font-black text-white hover:bg-red-400 hover:text-slate-950"
            >
              {t('learnMore')}
            </Link>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
          <h2 className="text-center text-3xl font-black text-cyan-300">
            {t('everythingIncluded')}
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
                {t('cancelAnytime')}
              </h2>

              <p className="mt-3 max-w-3xl text-slate-300">
                {t('cancelDescription')}
              </p>
            </div>

            <Link
              href="/signup"
              className="rounded-2xl border border-cyan-400 px-6 py-4 text-center font-black text-cyan-200 hover:bg-cyan-400 hover:text-slate-950"
            >
              {t('startFreeTrial')}
            </Link>
          </div>
        </section>

        <section className="text-center">
          <h2 className="text-4xl font-black">{t('stillQuestions')}</h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            {t('questionsDescription')}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/faq"
              className="rounded-2xl border border-cyan-400 px-8 py-4 text-lg font-black text-cyan-200 hover:bg-cyan-400 hover:text-slate-950"
            >
              {t('viewFaq')}
            </Link>

            <Link
              href="/contact"
              className="rounded-2xl border border-cyan-400 px-8 py-4 text-lg font-black text-cyan-200 hover:bg-cyan-400 hover:text-slate-950"
            >
              {t('contactUs')}
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