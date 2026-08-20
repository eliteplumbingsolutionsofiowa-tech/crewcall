import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Privacy Policy | CrewCall',
  description: 'Privacy Policy for CrewCall.',
}

export default async function PrivacyPolicyPage() {
  const t = await getTranslations('Privacy')
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <a
          href="/"
          className="mb-10 inline-block text-sm font-semibold text-blue-400 hover:text-blue-300"
        >
          ← {t('back')}
        </a>

        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            {t('title')}
          </h1>
          <p className="mt-3 text-slate-400">
            {t('effective')}
          </p>
        </div>

        <div className="space-y-10 leading-7">
          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              {t('introTitle')}
            </h2>
            <p>
              {t('introText')}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              {t('collectTitle')}
            </h2>
            <p className="mb-3">
              {t('collectIntro')}
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>{t('collect1')}</li>
              <li>{t('collect2')}</li>
              <li>{t('collect3')}</li>
              <li>{t('collect4')}</li>
              <li>{t('collect5')}</li>
              <li>{t('collect6')}</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              {t('useTitle')}
            </h2>
            <p className="mb-3">{t('useIntro')}</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>{t('use1')}</li>
              <li>{t('use2')}</li>
              <li>{t('use3')}</li>
              <li>{t('use4')}</li>
              <li>{t('use5')}</li>
              <li>{t('use6')}</li>
              <li>{t('use7')}</li>
              <li>{t('use8')}</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              {t('locationTitle')}
            </h2>
            <p>
              {t('locationText')}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              {t('shareTitle')}
            </h2>
            <p>
              {t('shareText')}
            </p>
            <p className="mt-3">
              {t('noSell')}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              {t('paymentsTitle')}
            </h2>
            <p>
              {t('paymentsText')}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              {t('retentionTitle')}
            </h2>
            <p>
              {t('retentionText')}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              {t('securityTitle')}
            </h2>
            <p>
              {t('securityText')}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              {t('choicesTitle')}
            </h2>
            <p>
              {t('choicesText')}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              {t('childrenTitle')}
            </h2>
            <p>
              {t('childrenText')}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              {t('changesTitle')}
            </h2>
            <p>
              {t('changesText')}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">
              {t('contactTitle')}
            </h2>
            <p>
              {t('contactText')}
            </p>
          </section>
        </div>

        <div className="mt-14 border-t border-slate-800 pt-8 text-sm text-slate-500">
          © 2026 CrewCall. {t('rights')}
        </div>
      </div>
    </main>
  )
}
