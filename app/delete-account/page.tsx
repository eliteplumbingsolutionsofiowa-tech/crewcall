'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DeleteAccountPage() {
  const router = useRouter()

  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')

  async function requestDeletion() {
    const confirmed = window.confirm(
      'Permanently delete your CrewCall account and associated data?'
    )

    if (!confirmed) return

    const secondConfirmation = window.confirm(
      'This action cannot be undone. Your account will be permanently deleted. Continue?'
    )

    if (!secondConfirmation) return

    setDeleting(true)
    setMessage('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error(
          'Your login session expired. Please log in again.'
        )
      }

      const response = await fetch(
        '/api/account/delete-request',
        {
          method: 'POST',
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Unable to submit deletion request.'
        )
      }

      setMessage(
        data?.message ||
          'Your CrewCall account has been permanently deleted.'
      )

      await supabase.auth.signOut()

      setTimeout(() => {
        router.replace('/login')
      }, 2500)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to submit deletion request.'
      )
      setDeleting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-red-400/20 bg-white/5 p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-red-300">
          Account Settings
        </p>

        <h1 className="mt-3 text-4xl font-black">
          Delete Your CrewCall Account
        </h1>

        <p className="mt-5 text-slate-300">
          You can permanently delete your CrewCall
          account directly from this screen. This action cannot be undone.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-lg font-black">
            Information deleted
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            CrewCall will delete your account information,
            profile information, uploaded files, applications,
            and other associated personal data.
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-lg font-black">
            Information that may be retained
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            Certain transaction, payment, fraud-prevention, or
            legal records may be retained when required by law.
          </p>
        </div>

        <p className="mt-5 text-sm font-semibold text-slate-300">
          Your account and associated personal data will be permanently deleted immediately.
        </p>

        {message ? (
          <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm font-bold text-cyan-100">
            {message}
          </div>
        ) : null}

        <button
          type="button"
          onClick={requestDeletion}
          disabled={deleting}
          className="mt-7 w-full rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white transition hover:bg-red-500 disabled:opacity-60"
        >
          {deleting
            ? 'Deleting Account...'
            : 'Permanently Delete Account'}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          disabled={deleting}
          className="mt-3 w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-sm font-black text-white"
        >
          Cancel
        </button>
      </div>
    </main>
  )
}
