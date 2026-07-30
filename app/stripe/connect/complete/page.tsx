'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function StripeConnectCompletePage() {
  const router = useRouter()
  const [message, setMessage] = useState(
    'Updating Stripe connection...'
  )

  useEffect(() => {
    async function refreshStripe() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user?.id) {
          throw new Error('No user session')
        }

        const response = await fetch(
          '/api/stripe/connect/refresh',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: session.user.id,
            }),
          }
        )

        if (!response.ok) {
          throw new Error('Unable to refresh Stripe status')
        }

        setMessage(
          'Stripe connected successfully. Returning to profile...'
        )

        setTimeout(() => {
          router.push('/profile')
        }, 2000)

      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Stripe update failed'
        )
      }
    }

    refreshStripe()
  }, [router])

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="rounded-2xl bg-white/10 p-8 text-center">
        {message}
      </div>
    </main>
  )
}
