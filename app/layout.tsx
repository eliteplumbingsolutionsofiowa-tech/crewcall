import './globals.css'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'
import CrewCallNav from './components/CrewCallNav'
import CrewCallPresence from './components/CrewCallPresence'
import ToastProvider from './components/ToastProvider'
import LiveNotificationSound from './components/LiveNotificationSound'
import MobileBottomNav from './components/MobileBottomNav'
import LanguageSwitcher from './components/LanguageSwitcher'

export const metadata: Metadata = {
  title: 'CrewCall',
  description: 'Blue collar hiring network for skilled trades.',
  applicationName: 'CrewCall',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#020617',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  const tFooter = await getTranslations('Footer')
  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body className="min-h-screen bg-slate-950 text-white antialiased">
        <NextIntlClientProvider messages={messages}>
        <CrewCallPresence />
        <ToastProvider />
        <LiveNotificationSound />

        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_32%),linear-gradient(135deg,#020617,#0f172a_45%,#111827)]" />

        <div className="fixed inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] opacity-30" />

        <div className="flex min-h-screen flex-col pb-28 md:pb-0">
          <div className="mx-auto flex w-full max-w-7xl justify-end px-4 pt-3">
            <LanguageSwitcher />
          </div>

          <CrewCallNav />

          <main className="flex-1">{children}</main>

          <footer className="border-t border-white/10 bg-black/20 px-5 py-8">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-bold text-slate-400">
              <a
                href="/terms"
                className="transition hover:text-cyan-300"
              >
                {tFooter('terms')}
              </a>

              <a
                href="/privacy"
                className="transition hover:text-cyan-300"
              >
                {tFooter('privacy')}
              </a>

              <a
                href="/contractor-agreement"
                className="transition hover:text-cyan-300"
              >
                {tFooter('contractorAgreement')}
              </a>

              <a
                href="/faq"
                className="transition hover:text-cyan-300"
              >
                {tFooter('faq')}
              </a>

              <a
                href="/contact"
                className="transition hover:text-cyan-300"
              >
                {tFooter('contact')}
              </a>
            </div>

            <p className="mt-4 text-center text-xs font-bold text-slate-600">
              © {new Date().getFullYear()} CrewCall. {tFooter('rights')}
            </p>
          </footer>

          <MobileBottomNav />
        </div>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}