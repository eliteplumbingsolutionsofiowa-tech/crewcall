import './globals.css'
import CrewCallNav from './components/CrewCallNav'
import Link from 'next/link'

export const metadata = {
  title: 'CrewCall',
  description: 'Blue-collar hiring made simple',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <div className="min-h-screen">
          <CrewCallNav />

          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>

          <footer className="mt-10 border-t bg-white">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 text-sm text-slate-600 sm:flex-row sm:justify-between">
              <p>© {new Date().getFullYear()} CrewCall</p>

              <div className="flex gap-4">
                <Link href="/terms" className="hover:underline">
                  Terms
                </Link>

                <Link href="/privacy" className="hover:underline">
                  Privacy
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}