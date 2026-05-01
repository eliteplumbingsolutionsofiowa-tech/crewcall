import { Suspense } from 'react'
import StripePageClient from './StripePageClient'

export default function StripePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 px-4 py-10">
          <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <p className="text-slate-600">Loading payment details...</p>
          </div>
        </main>
      }
    >
      <StripePageClient />
    </Suspense>
  )
}