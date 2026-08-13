'use client'

import { useLocale, useTranslations } from 'next-intl'

export default function LanguageSwitcher() {
  const locale = useLocale()
  const t = useTranslations('Common')

  function changeLanguage(nextLocale: 'en' | 'es') {
    document.cookie = `CREWCALL_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`
    window.location.reload()
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/80 p-1.5 shadow-lg backdrop-blur">
      <span className="hidden px-2 text-xs font-black uppercase tracking-wider text-slate-400 sm:block">
        {t('language')}
      </span>

      <button
        type="button"
        onClick={() => changeLanguage('en')}
        className={`rounded-xl px-3 py-2 text-xs font-black transition ${
          locale === 'en'
            ? 'bg-cyan-400 text-slate-950'
            : 'text-slate-300 hover:bg-white/10'
        }`}
      >
        English
      </button>

      <button
        type="button"
        onClick={() => changeLanguage('es')}
        className={`rounded-xl px-3 py-2 text-xs font-black transition ${
          locale === 'es'
            ? 'bg-cyan-400 text-slate-950'
            : 'text-slate-300 hover:bg-white/10'
        }`}
      >
        Español
      </button>
    </div>
  )
}
