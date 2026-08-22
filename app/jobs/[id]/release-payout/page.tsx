'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { resolveCompanyContext } from '@/lib/company-context'

type JobRow = {
  id: string
  title: string | null
  status: string | null
  payment_status: string | null
  payout_status: string | null
  completion_status: string | null
  company_id: string | null
}

export default function ReleasePayoutPage() {
  const t = useTranslations('ReleasePayout')
  const params = useParams()
  const router = useRouter()

  const jobId = String(params?.id || '')

  const [job, setJob] =
    useState<JobRow | null>(null)

  const [checking, setChecking] =
    useState(true)

  const [loading, setLoading] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const [success, setSuccess] =
    useState(false)

  useEffect(() => {
    void loadJob()
  }, [jobId])

  async function loadJob() {
    if (!jobId) {
      setMessage('Missing job ID.')
      setChecking(false)
      return
    }

    setChecking(true)
    setMessage('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error(
          userError?.message ||
            'You must be logged in.'
        )
      }

      const {
        data,
        error,
      } = await supabase
        .from('jobs')
        .select(
          `
          id,
          title,
          status,
          payment_status,
          payout_status,
          completion_status,
          company_id
        `
        )
        .eq('id', jobId)
        .maybeSingle<JobRow>()

      if (error) {
        throw error
      }

      if (!data) {
        throw new Error(
          t('jobNotFound')
        )
      }

      const companyContext =
        await resolveCompanyContext(
          supabase,
          user.id
        )

      if (
        !companyContext.companyId ||
        data.company_id !==
          companyContext.companyId
      ) {
        throw new Error(
          'You do not have permission to release payout for this job.'
        )
      }

      setJob(data)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load payout information.'
      )
    } finally {
      setChecking(false)
    }
  }

  async function handleRelease() {
    if (!jobId || !job) {
      setMessage('Missing job information.')
      return
    }

    if (
      job.completion_status !==
      'approved'
    ) {
      setMessage(
        'The worker completion package must be approved before payout can be released.'
      )
      return
    }

    if (job.status !== 'completed') {
      setMessage(
        'The job must be completed before payout can be released.'
      )
      return
    }

    if (
      job.payment_status !== 'paid'
    ) {
      setMessage(
        'Funds must be secured before payout can be released.'
      )
      return
    }

    if (
      job.payout_status === 'released'
    ) {
      setSuccess(true)
      setMessage(
        t('alreadyReleased')
      )
      return
    }

    const confirmed = window.confirm(
      t('confirmRelease')
    )

    if (!confirmed) return

    setLoading(true)
    setMessage('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error(
          'Authorization token required.'
        )
      }

      const res = await fetch(
        '/api/stripe/release-payment',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            jobId,
          }),
        }
      )

      const data =
        await res.json()

      if (!res.ok) {
        throw new Error(
          data.error ||
            t('releaseFailed')
        )
      }

      setSuccess(true)

      setMessage(
        data.alreadyReleased
          ? t('alreadyReleased')
          : t('releasedSuccessfully')
      )

      setTimeout(() => {
        router.push(
          `/my-jobs/${jobId}`
        )
      }, 3000)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong.'
      )
    } finally {
      setLoading(false)
    }
  }

  const approved =
    job?.completion_status ===
    'approved'

  const completed =
    job?.status === 'completed'

  const funded =
    job?.payment_status === 'paid'

  const alreadyReleased =
    job?.payout_status ===
    'released'

  const canRelease =
    Boolean(
      approved &&
        completed &&
        funded &&
        !alreadyReleased
    )

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="font-black text-cyan-200">
            Checking payout status...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl sm:p-10">
        <div className="text-center">
          {success ||
          alreadyReleased ? (
            <>
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-500/20 text-5xl">
                ✓
              </div>

              <h1 className="mb-4 text-4xl font-black">
                {t('paymentReleased')}
              </h1>

              <p className="text-lg text-slate-300">
                {t('paymentReleasedDescription')}
              </p>
            </>
          ) : (
            <>
              <h1 className="mb-4 text-4xl font-black">
                {t('title')}
              </h1>

              <p className="mb-8 text-slate-300">
                Review the completion status before releasing secured funds to the worker.
              </p>
            </>
          )}
        </div>

        {job ? (
          <div className="mb-8 space-y-3 rounded-2xl border border-white/10 bg-black/30 p-5">
            <div>
              <div className="mb-1 text-xs font-black uppercase tracking-wide text-slate-500">
                {t('job')}
              </div>

              <div className="font-black text-white">
                {job.title ||
                  t('crewCallJob')}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <StatusRow
                label="Funds"
                value={
                  funded
                    ? '🔒 Secured'
                    : 'Not Secured'
                }
                ready={funded}
              />

              <StatusRow
                label="Work Approval"
                value={
                  approved
                    ? 'Approved'
                    : job.completion_status ===
                        'submitted'
                      ? 'Awaiting Review'
                      : 'Not Submitted'
                }
                ready={approved}
              />

              <StatusRow
                label={t('jobStatus')}
                value={
                  completed
                    ? t('completed')
                    : job.status ||
                      'Unknown'
                }
                ready={completed}
              />

              <StatusRow
                label={t('payout')}
                value={
                  alreadyReleased
                    ? t('released')
                    : 'Held'
                }
                ready={
                  alreadyReleased
                }
              />
            </div>
          </div>
        ) : null}

        {!success &&
        !alreadyReleased ? (
          canRelease ? (
            <button
              type="button"
              onClick={handleRelease}
              disabled={loading}
              className="w-full rounded-2xl bg-green-500 px-6 py-5 text-xl font-black text-black transition hover:bg-green-400 disabled:opacity-50"
            >
              {loading
                ? t('processingPayment')
                : t('releasePayout')}
            </button>
          ) : (
            <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 p-5 text-center">
              <p className="font-black text-orange-200">
                {t('payoutLocked')}
              </p>

              <p className="mt-2 text-sm font-semibold leading-6 text-orange-100/70">
                Funds can only be released after the worker submits completion proof, the company approves the work, the job is completed, and CrewCall confirms the funds are secured.
              </p>
            </div>
          )
        ) : null}

        {message ? (
          <div
            className={`mt-6 rounded-2xl p-5 text-center font-semibold ${
              success ||
              alreadyReleased
                ? 'bg-green-500/20 text-green-300'
                : 'bg-white/10 text-white'
            }`}
          >
            {message}
          </div>
        ) : null}
      </div>
    </main>
  )
}

function StatusRow({
  label,
  value,
  ready,
}: {
  label: string
  value: string
  ready: boolean
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 text-sm font-black ${
          ready
            ? 'text-emerald-300'
            : 'text-orange-200'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
