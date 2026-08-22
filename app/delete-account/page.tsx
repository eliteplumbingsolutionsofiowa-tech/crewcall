'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DeleteAccountPage() {
  const t = useTranslations('DeleteAccount')
  const router = useRouter()

  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')

  async function requestDeletion() {
    const confirmed = window.confirm(
      t('confirmDelete')
    )

    if (!confirmed) return

    const secondConfirmation = window.confirm(
      t('confirmDeleteAgain')
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
          t('sessionExpired')
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
            t('deletionRequestFailed')
        )
      }

      setMessage(
        data?.message ||
          t('accountDeleted')
      )

      await supabase.auth.signOut()

      setTimeout(() => {
        router.replace('/login')
      }, 2500)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t('deletionRequestFailed')
      )
      setDeleting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-red-400/20 bg-white/5 p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-red-300">
          {t('accountSettings')}
        </p>

        <h1 className="mt-3 text-4xl font-black">
          {t('title')}
        </h1>

        <p className="mt-5 text-slate-300">
          {t('description')}
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-lg font-black">
            {t('informationDeleted')}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            {t('informationDeletedText')}
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-lg font-black">
            {t('informationRetained')}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            {t('informationRetainedText')}
          </p>
        </div>

        <p className="mt-5 text-sm font-semibold text-slate-300">
          {t('deletionNotice')}
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
            ? t('deleting')
            : t('deletePermanently')}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          disabled={deleting}
          className="mt-3 w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-sm font-black text-white"
        >
          {t('cancel')}
        </button>
      </div>
    </main>
  )
}
