import { getTranslations } from 'next-intl/server'

export default async function ContractorAgreementPage() {
  const t = await getTranslations('ContractorAgreement')
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white md:px-6">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/5 p-8">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
          {t('eyebrow')}
        </p>

        <h1 className="mt-4 text-4xl font-black">
          {t('title')}
        </h1>

        <p className="mt-4 text-sm font-bold text-slate-400">
          {t('updated')}
        </p>

        <div className="mt-8 space-y-8 text-slate-300">

          <Section title={t('relationshipTitle')}>
            {t('relationshipText')}
          </Section>

          <Section title={t('workerTitle')}>
            {t('workerText')}
          </Section>

          <Section title={t('taxesTitle')}>
            {t('taxesText')}
          </Section>

          <Section title={t('safetyTitle')}>
            {t('safetyText')}
          </Section>

          <Section title={t('employmentTitle')}>
            {t('employmentText')}
          </Section>

        </div>
      </div>
    </main>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-2xl font-black text-white">{title}</h2>
      <p className="mt-3 leading-8">{children}</p>
    </section>
  )
}
