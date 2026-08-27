'use client'

import { useTranslations } from 'next-intl'

const companyBenefitKeys = [
  'companyBenefit1',
  'companyBenefit2',
  'companyBenefit3',
  'companyBenefit4',
  'companyBenefit5',
] as const

const workerBenefitKeys = [
  'workerBenefit1',
  'workerBenefit2',
  'workerBenefit3',
  'workerBenefit4',
  'workerBenefit5',
] as const

const statKeys = [
  ['stat1Value', 'stat1Label'],
  ['stat2Value', 'stat2Label'],
  ['stat3Value', 'stat3Label'],
  ['stat4Value', 'stat4Label'],
] as const

const faqKeys = [
  ['faq1Question', 'faq1Answer'],
  ['faq2Question', 'faq2Answer'],
  ['faq3Question', 'faq3Answer'],
  ['faq4Question', 'faq4Answer'],
] as const

export default function LaunchPage() {
  const t = useTranslations('Launch')

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      <section className="mx-auto max-w-7xl px-6 py-16">

        <div className="rounded-3xl border border-cyan-400/20 bg-white/5 p-10 text-center">

          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
            {t('eyebrow')}
          </p>

          <h1 className="mt-5 text-5xl font-black">
            {t('findHelp')}
            <br />
            {t('findWork')}
            <br />
            {t('fast')}
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
            {t('description')}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">

            <button className="rounded-xl bg-cyan-400 px-8 py-4 font-black text-slate-950">
              {t('joinCompany')}
            </button>

            <button className="rounded-xl bg-white/10 px-8 py-4 font-black">
              {t('joinWorker')}
            </button>

          </div>

        </div>


        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

          {statKeys.map(([valueKey, labelKey]) => (
            <div
              key={labelKey}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center"
            >
              <p className="text-2xl font-black text-cyan-300">
                {t(valueKey)}
              </p>

              <p className="mt-2 text-sm text-slate-400">
                {t(labelKey)}
              </p>
            </div>
          ))}

        </section>


        <section className="mt-12 grid gap-6 lg:grid-cols-2">

          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">

            <h2 className="text-3xl font-black">
              {t('forCompanies')}
            </h2>

            <ul className="mt-5 space-y-3 text-slate-300">

              {companyBenefitKeys.map((key) => (
                <li key={key}>
                  ✓ {t(key)}
                </li>
              ))}

            </ul>

          </div>


          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">

            <h2 className="text-3xl font-black">
              {t('forWorkers')}
            </h2>

            <ul className="mt-5 space-y-3 text-slate-300">

              {workerBenefitKeys.map((key) => (
                <li key={key}>
                  ✓ {t(key)}
                </li>
              ))}

            </ul>

          </div>

        </section>


        <section className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-8">

          <h2 className="text-3xl font-black">
            {t('whyCrewCall')}
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">

            <Feature title={t('aiRecruiting')}>
              {t('aiRecruitingText')}
            </Feature>

            <Feature title={t('verifiedTrades')}>
              {t('verifiedTradesText')}
            </Feature>

            <Feature title={t('secureHiring')}>
              {t('secureHiringText')}
            </Feature>

          </div>

        </section>


        <section className="mt-12 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-8">

          <h2 className="text-3xl font-black">
            {t('getEarlyAccess')}
          </h2>

          <p className="mt-3 text-slate-300">
            {t('earlyAccessText')}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">

            <input
              placeholder={t('name')}
              className="rounded-xl bg-slate-950 px-4 py-3"
            />

            <input
              placeholder={t('email')}
              className="rounded-xl bg-slate-950 px-4 py-3"
            />

            <button className="rounded-xl bg-cyan-400 font-black text-slate-950">
              {t('requestAccess')}
            </button>

          </div>

        </section>


        <section className="mt-12">

          <h2 className="text-3xl font-black">
            FAQ
          </h2>

          <div className="mt-5 space-y-4">

            {faqKeys.map(([questionKey, answerKey]) => (
              <div
                key={questionKey}
                className="rounded-xl border border-white/10 bg-white/5 p-5"
              >
                <h3 className="font-black">
                  {t(questionKey)}
                </h3>

                <p className="mt-2 text-slate-400">
                  {t(answerKey)}
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
