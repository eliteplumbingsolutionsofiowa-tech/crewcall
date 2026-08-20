'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { isNativeIOS } from '@/app/lib/nativePlatform'

export default function FAQPage() {
  const t = useTranslations('FAQ')
  const nativeIOS = isNativeIOS()

  const companyFaq = [
    {
      question: t('companyQ1'),
      answer: t('companyA1'),
    },
    {
      question: t('companyQ2'),
      answer: nativeIOS
        ? t('companyA2Ios')
        : t('companyA2'),
    },
    {
      question: t('companyQ3'),
      answer: nativeIOS
        ? t('companyA3Ios')
        : t('companyA3'),
    },
    {
      question: t('companyQ4'),
      answer: t('companyA4'),
    },
    {
      question: t('companyQ5'),
      answer: t('companyA5'),
    },
  ]

  const workerFaq = [
    {
      question: t('workerQ1'),
      answer: t('workerA1'),
    },
    {
      question: t('workerQ2'),
      answer: t('workerA2'),
    },
    {
      question: t('workerQ3'),
      answer: t('workerA3'),
    },
    {
      question: t('workerQ4'),
      answer: t('workerA4'),
    },
    {
      question: t('workerQ5'),
      answer: t('workerA5'),
    },
  ]

  const generalFaq = [
    {
      question: t('generalQ1'),
      answer: t('generalA1'),
    },
    {
      question: t('generalQ2'),
      answer: t('generalA2'),
    },
    {
      question: t('generalQ3'),
      answer: t('generalA3'),
    },
    {
      question: t('generalQ4'),
      answer: t('generalA4'),
    },
  ]

  const companyFaqItems = companyFaq

  const generalFaqItems = nativeIOS
    ? generalFaq.filter((_, index) => index !== 2)
    : generalFaq

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white md:px-6">
      <div className="mx-auto max-w-5xl">

        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            {t('eyebrow')}
          </p>

          <h1 className="mt-4 text-5xl font-black">
            {t('title')}
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg text-slate-300">
            {t('description')}
          </p>
        </div>

        <Section
          title={t('forCompanies')}
          items={companyFaqItems}
        />

        <Section
          title={t('forWorkers')}
          items={workerFaq}
        />

        <Section
          title={t('generalQuestions')}
          items={generalFaqItems}
        />

        <div className="mt-16 rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-8 text-center">

          <h2 className="text-3xl font-black">
            {t('stillHaveQuestions')}
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            {t('supportText')}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">

            <Link
              href="/contact"
              className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 hover:bg-cyan-300"
            >
              {t('contactUs')}
            </Link>

            <Link
              href="/signup"
              className="rounded-2xl border border-white/20 bg-white/5 px-6 py-4 font-black hover:bg-white/10"
            >
              {t('startFreeTrial')}
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