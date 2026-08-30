'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Role = 'company' | 'worker' | null
type JobStatus = 'open' | 'active' | 'completed' | 'cancelled'

type Profile = {
  id: string
  role: Role
}

type Job = {
  id: string
  title: string | null
  description: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  start_date: string | null
  status: string | null
  payment_status: string | null
  created_at: string | null
  company_id: string | null
  assigned_worker_id: string | null
}

export default function CompanyJobsPage() {
  const router = useRouter()
  const t = useTranslations('CompanyJobs')

  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.replace('/login')
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle<Profile>()

    if (profileError) {
      setMessage(profileError.message)
      setJobs([])
      setLoading(false)
      return
    }

    if (!profileData) {
      router.replace('/profile')
      return
    }

    if (profileData.role !== 'company') {
      router.replace('/worker/dashboard')
      return
    }

    const { data, error } = await supabase
      .from('jobs')
      .select(
        `
        id,
        title,
        description,
        trade,
        location,
        pay_rate,
        start_date,
        status,
        payment_status,
        created_at,
        company_id,
        assigned_worker_id
      `
      )
      .eq('company_id', user.id)
      .order('created_at', { ascending: false })
      .returns<Job[]>()

    if (error) {
      setMessage(error.message)
      setJobs([])
      setLoading(false)
      return
    }

    setJobs(data ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  const groupedJobs = useMemo(() => {
    return {
      open: jobs.filter((job) => job.status === 'open' || !job.status),
      active: jobs.filter((job) => job.status === 'active'),
      completed: jobs.filter((job) => job.status === 'completed'),
      cancelled: jobs.filter((job) => job.status === 'cancelled'),
    }
  }, [jobs])

  const totals = useMemo(() => {
    return {
      all: jobs.length,
      open: groupedJobs.open.length,
      active: groupedJobs.active.length,
      completed: groupedJobs.completed.length,
    }
  }, [groupedJobs, jobs.length])

  async function updateJobStatus(jobId: string, status: JobStatus) {
    setUpdatingId(jobId)
    setMessage(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setMessage(t('sessionExpired'))
        return
      }

      const response = await fetch('/api/company/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          jobId,
          status,
        }),
      })

      const responseText = await response.text()
      const data = responseText ? JSON.parse(responseText) : {}

      if (!response.ok) {
        setMessage(data.error || t('statusUpdateFailed'))
        return
      }

      setJobs((current) =>
        current.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status,
              }
            : job
        )
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t('statusUpdateFailed')
      )
    } finally {
      setUpdatingId(null)
    }
  }

  async function deleteJob(jobId: string) {
    const confirmed = window.confirm(
      t('deleteConfirm')
    )

    if (!confirmed) {
      return
    }

    setUpdatingId(jobId)
    setMessage(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setMessage(t('sessionExpired'))
        return
      }

      const response = await fetch('/api/jobs/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          jobId,
        }),
      })

      const responseText = await response.text()
      const data = responseText ? JSON.parse(responseText) : {}

      if (!response.ok) {
        setMessage(data.error || t('deleteFailed'))
        return
      }

      setJobs((current) =>
        current.filter((job) => job.id !== jobId)
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t('deleteFailed')
      )
    } finally {
      setUpdatingId(null)
    }
  }

  function formatDate(value: string | null) {
    if (!value) {
      return t('noStartDate')
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return value
    }

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function getSafeStatus(job: Job): JobStatus {
    if (
      job.status === 'open' ||
      job.status === 'active' ||
      job.status === 'completed' ||
      job.status === 'cancelled'
    ) {
      return job.status
    }

    return 'open'
  }

  function JobCard({ job }: { job: Job }) {
    const status = getSafeStatus(job)
    const isUpdating = updatingId === job.id
    const fundsSecured = job.payment_status === 'paid'
    const hasPaymentActivity =
      fundsSecured || job.payment_status === 'pending'

    return (
      <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-cyan-200">
                {job.trade || t('tradeNotSet')}
              </span>

              <span className={statusBadgeClass(status)}>{t(status)}</span>

              <span className={paymentBadgeClass(job.payment_status)}>
                {job.payment_status === 'paid' ? t('paid') : job.payment_status === 'pending' ? t('pending') : t('paymentPending')}
              </span>
            </div>

            <h2 className="mt-4 text-2xl font-black text-white">
              {job.title || t('untitledJob')}
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              {job.description || t('noDescription')}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Info label={t('location')} value={job.location || t('noLocation')} />
              <Info label={t('pay')} value={job.pay_rate || t('noPayRate')} />
              <Info label={t('start')} value={formatDate(job.start_date)} />
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 lg:w-48">
            <Link
              href={`/jobs/${job.id}`}
              className="rounded-2xl bg-cyan-400 px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-cyan-300"
            >
              {t('viewJob')}
            </Link>

            <Link
              href={`/my-jobs/${job.id}/applicants`}
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white/20"
            >
              {t('applicants')}
            </Link>
          </div>
        </div>

        {fundsSecured ? (
          <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
            <p className="font-black text-emerald-200">
              🔒 {t('fundsSecured')}
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-emerald-100/80">
              {t('fundedJobLocked')}
            </p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          {!hasPaymentActivity ? (
            <>
              {status !== 'open' && (
            <button
              type="button"
              onClick={() => void updateJobStatus(job.id, 'open')}
              disabled={isUpdating}
              className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('markOpen')}
            </button>
          )}

          {status !== 'active' && (
            <button
              type="button"
              onClick={() => void updateJobStatus(job.id, 'active')}
              disabled={isUpdating}
              className="rounded-2xl border border-orange-300/30 bg-orange-400/10 px-4 py-2 text-sm font-black text-orange-100 transition hover:bg-orange-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('markActive')}
            </button>
          )}

          {status !== 'completed' && (
            <button
              type="button"
              onClick={() => void updateJobStatus(job.id, 'completed')}
              disabled={isUpdating}
              className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('complete')}
            </button>
          )}

          {status !== 'cancelled' && (
            <button
              type="button"
              onClick={() => void updateJobStatus(job.id, 'cancelled')}
              disabled={isUpdating}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-slate-200 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('cancel')}
            </button>
          )}

              <button
                type="button"
                onClick={() => void deleteJob(job.id)}
                disabled={isUpdating}
                className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-black text-red-200 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUpdating ? t('updating') : t('delete')}
              </button>
            </>
          ) : (
            <span className="inline-flex items-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-black text-emerald-200">
              🔒 {fundsSecured ? t('securedWorkflowOnly') : t('paymentInProgress')}
            </span>
          )}
        </div>
      </article>
    )
  }

  function JobSection({
    title,
    description,
    jobs,
  }: {
    title: string
    description: string
    jobs: Job[]
  }) {
    return (
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          </div>

          <span className="w-fit rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-slate-200">
            {jobs.length}
          </span>
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-sm font-bold text-slate-400">
            {t('noJobsSection')}
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
                {t('crewCallCompany')}
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">
                {t('title')}
              </h1>

              <p className="mt-3 max-w-2xl text-slate-300">
                {t('description')}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void loadJobs()}
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
              >
                {t('refresh')}
              </button>

              <Link
                href="/post-job"
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-cyan-300"
              >
                {t('postNewJob')}
              </Link>
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm font-bold text-red-100">
              {message}
            </div>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t('allJobs')} value={totals.all} />
          <StatCard label={t('open')} value={totals.open} />
          <StatCard label={t('active')} value={totals.active} />
          <StatCard label={t('completed')} value={totals.completed} />
        </section>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm font-black text-slate-300 shadow-xl">
            {t('loading')}
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-xl">
            <h2 className="text-2xl font-black text-white">
              {t('noJobsYet')}
            </h2>

            <p className="mt-2 text-slate-300">
              {t('noJobsYetDescription')}
            </p>

            <Link
              href="/post-job"
              className="mt-6 inline-flex rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
            >
              {t('postJob')}
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
            <JobSection
              title={t('openJobs')}
              description={t('openJobsDescription')}
              jobs={groupedJobs.open}
            />

            <JobSection
              title={t('activeJobs')}
              description={t('activeJobsDescription')}
              jobs={groupedJobs.active}
            />

            <JobSection
              title={t('completedJobs')}
              description={t('completedJobsDescription')}
              jobs={groupedJobs.completed}
            />

            <JobSection
              title={t('cancelledJobs')}
              description={t('cancelledJobsDescription')}
              jobs={groupedJobs.cancelled}
            />
          </div>
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl">
      <p className="text-sm font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-4xl font-black text-white">{value}</p>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  )
}

function statusBadgeClass(status: JobStatus) {
  const base =
    'rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider '

  if (status === 'completed') {
    return base + 'bg-emerald-400/15 text-emerald-200'
  }

  if (status === 'active') {
    return base + 'bg-orange-400/15 text-orange-200'
  }

  if (status === 'cancelled') {
    return base + 'bg-white/10 text-slate-300'
  }

  return base + 'bg-cyan-400/15 text-cyan-200'
}

function paymentBadgeClass(status: string | null) {
  const normalized = String(status || '').toLowerCase().trim()
  const base =
    'rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider '

  if (normalized === 'paid') {
    return base + 'bg-emerald-400/15 text-emerald-200'
  }

  if (normalized === 'pending') {
    return base + 'bg-amber-400/15 text-amber-200'
  }

  return base + 'bg-white/10 text-slate-300'
}