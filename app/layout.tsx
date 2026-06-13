import './globals.css'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import CrewCallNav from './components/CrewCallNav'
import CrewCallPresence from './components/CrewCallPresence'
import ToastProvider from './components/ToastProvider'
import LiveNotificationSound from './components/LiveNotificationSound'
import MobileBottomNav from './components/MobileBottomNav'

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-screen bg-slate-950 text-white antialiased">
        <CrewCallPresence />
        <ToastProvider />
        <LiveNotificationSound />

        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_32%),linear-gradient(135deg,#020617,#0f172a_45%,#111827)]" />

        <div className="fixed inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] opacity-30" />

        <div className="flex min-h-screen flex-col pb-28 md:pb-0">
          <CrewCallNav />

          <main className="flex-1">{children}</main>

          <MobileBottomNav />
        </div>
      </body>
    </html>
  )
}