import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export default async function AboutPage() {
  const t = await getTranslations('About')
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white md:px-6">
      <div className="mx-auto max-w-5xl space-y-10">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            {t('eyebrow')}
          </p>

          <h1 className="mt-4 text-4xl font-black md:text-6xl">
            {t('title')}
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            {t('intro1')}
          </p>

          <p className="mt-4 text-lg leading-8 text-slate-300">
            {t('intro2')}
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <Card
            title={t('forCompanies')}
            text={t('forCompaniesText')}
          />
          <Card
            title={t('forWorkers')}
            text={t('forWorkersText')}
          />
          <Card
            title={t('whyItExists')}
            text={t('whyItExistsText')}
          />
        </section>

        <section className="rounded-[2rem] border border-cyan-400/20 bg-cyan-400/10 p-8">
          <h2 className="text-3xl font-black">{t('iowaTitle')}</h2>

          <p className="mt-4 text-lg leading-8 text-slate-300">
            {t('iowaText')}
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/signup"
              className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 hover:bg-cyan-300"
            >
              {t('startFreeTrial')}
            </Link>

            <Link
              href="/jobs"
              className="rounded-2xl border border-white/20 bg-white/5 px-6 py-4 font-black text-white hover:bg-white/10"
            >
              {t('browseJobs')}
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}

function Card({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="mt-4 leading-7 text-slate-300">{text}</p>
    </div>
  )
}