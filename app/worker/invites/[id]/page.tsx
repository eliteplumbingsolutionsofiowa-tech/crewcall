'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Invite = {
  id: string
  job_id: string
  worker_id: string
  status: string | null
  created_at: string
  job: {
    id: string
    title: string | null
    trade: string | null
    location: string | null
    pay_rate: string | null
    start_date: string | null
  } | null
  company: {
    company_name: string | null
    full_name: string | null
  } | null
}

export default function WorkerInviteDetailPage() {

  const t = useTranslations('WorkerInviteDetail')
  const params = useParams()
  const router = useRouter()

  const inviteId = String(params?.id || '')

  const [invite, setInvite] = useState<Invite | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')

  const loadInvite = useCallback(async () => {
    const { data, error } = await supabase
      .from('job_invites')
      .select(`
        id,
        job_id,
        worker_id,
        status,
        created_at,
        job:jobs!job_invites_job_id_fkey (
          id,
          title,
          trade,
          location,
          pay_rate,
          start_date
        ),
        company:profiles!job_invites_company_id_fkey (
          company_name,
          full_name
        )
      `)
      .eq('id', inviteId)
      .single()

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setInvite(data as unknown as Invite)
    setLoading(false)
  }, [inviteId])

  useEffect(() => {
    loadInvite()
  }, [loadInvite])

  async function updateInvite(status: 'accepted' | 'declined') {
    setWorking(true)
    setMessage('')

    if (!invite) {
      setMessage(t('inviteNotLoaded'))
      setWorking(false)
      return
    }

    if (status === 'accepted') {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setMessage(t('mustBeLoggedIn'))
        setWorking(false)
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setMessage(t('mustBeLoggedIn'))
        setWorking(false)
        return
      }

      const response = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          inviteId,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setMessage(result.error || t('unableToAccept'))
        setWorking(false)
        return
      }

    } else {
      const { error } = await supabase
        .from('job_invites')
        .update({
          status: 'declined',
          worker_seen: true,
          company_seen: false,
        })
        .eq('id', inviteId)

      if (error) {
        setMessage(error.message)
        setWorking(false)
        return
      }
    }

    setInvite((current) =>
      current
        ? {
            ...current,
            status,
          }
        : current
    )

    setWorking(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        {t('loadingInvite')}
      </main>
    )
  }

  if (!invite) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        {t('inviteNotFound')}
      </main>
    )
  }

  const job = invite.job
  const company = invite.company

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl space-y-6">

        <Link
          href="/worker/invites"
          className="text-cyan-300 font-bold"
        >
          ← {t('backToInvites')}
        </Link>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            {t('crewCallJobInvite')}
          </p>

          <h1 className="mt-3 text-4xl font-black">
            {job?.title || t('jobInvitation')}
          </h1>

          <p className="mt-3 text-slate-300">
            {t('from')}:{' '}
            <b>
              {company?.company_name ||
                company?.full_name ||
                t('company')}
            </b>
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">

            <div className="rounded-2xl bg-slate-900 p-5">
              <p className="text-xs text-slate-400">
                {t('trade')}
              </p>
              <p className="text-xl font-bold">
                {job?.trade || t('notListed')}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900 p-5">
              <p className="text-xs text-slate-400">
                {t('pay')}
              </p>
              <p className="text-xl font-bold text-cyan-300">
                {job?.pay_rate || t('notListed')}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900 p-5">
              <p className="text-xs text-slate-400">
                {t('location')}
              </p>
              <p className="text-xl font-bold">
                {job?.location || t('notListed')}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900 p-5">
              <p className="text-xs text-slate-400">
                {t('status')}
              </p>
              <p className="text-xl font-bold">
                {invite.status === 'accepted'
                  ? t('accepted')
                  : invite.status === 'declined'
                    ? t('declined')
                    : t('pending')}
              </p>
            </div>

          </div>

          {message && (
            <div className="mt-5 rounded-xl bg-red-500/20 p-4 text-red-200">
              {message}
            </div>
          )}

          {invite.status === 'pending' && (
            <div className="mt-8 flex gap-4">

              <button
                disabled={working}
                onClick={() => updateInvite('accepted')}
                className="rounded-2xl bg-green-500 px-6 py-3 font-black text-white"
              >
                {t('accept')}
              </button>

              <button
                disabled={working}
                onClick={() => updateInvite('declined')}
                className="rounded-2xl bg-red-500 px-6 py-3 font-black text-white"
              >
                {t('decline')}
              </button>

            </div>
          )}

        </div>

      </div>
    </main>
  )
}
