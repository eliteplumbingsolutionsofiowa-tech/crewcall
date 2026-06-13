'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Application = {
  id: string
  job_id: string
  worker_id: string
  status: string | null
  created_at: string
  requested_pay_rate: string | null
  negotiation_message: string | null
  company_counter_offer: string | null
  negotiation_status: string | null
  job: Job | null
}

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  status: string | null
  company_id: string | null
  assigned_worker_id: string | null
}

type RawApplication = {
  id: string
  job_id: string
  worker_id: string
  status: string | null
  created_at: string
  requested_pay_rate: string | null
  negotiation_message: string | null
  company_counter_offer: string | null
  negotiation_status: string | null
}

type ExistingConversation = {
  id: string
}

type StatusFilter = 'all' | 'pending' | 'accepted' | 'rejected' | 'countered'

export default function MyApplicationsPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const [counterRates, setCounterRates] = useState<Record<string, string>>({})
  const [counterMessages, setCounterMessages] = useState<Record<string, string>>({})

  const startPage = useCallback(async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      setMessage('You must be logged in to view applications.')
      setApplications([])
      setLoading(false)
      return
    }

    setCurrentUserId(user.id)
    await loadApplications(user.id)
  }, [])

  useEffect(() => {
    let mounted = true

    async function boot() {
      if (!mounted) return
      await startPage()
    }

    boot()

    const refresh = async () => {
      if (!mounted) return
      await loadApplications(currentUserId || undefined)
      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    }

    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    const applicationsChannel = supabase
      .channel('my-applications-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
        },
        refresh
      )
      .subscribe()

    const jobsChannel = supabase
      .channel('my-applications-jobs-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
        },
        refresh
      )
      .subscribe()

    return () => {
      mounted = false
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(applicationsChannel)
      supabase.removeChannel(jobsChannel)
    }
  }, [currentUserId, startPage])

  async function loadApplications(userId?: string) {
    setLoading((current) => current && applications.length === 0)
    setRefreshing(true)
    setMessage('')

    const workerId = userId || currentUserId

    if (!workerId) {
      setApplications([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data: applicationsData, error: applicationsError } = await supabase
      .from('applications')
      .select(`
        id,
        job_id,
        worker_id,
        status,
        created_at,
        requested_pay_rate,
        negotiation_message,
        company_counter_offer,
        negotiation_status
      `)
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false })

    if (applicationsError) {
      setMessage(applicationsError.message)
      setApplications([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const rawApplications = (applicationsData || []) as RawApplication[]

    const jobIds = Array.from(
      new Set(rawApplications.map((application) => application.job_id).filter(Boolean))
    )

    let jobMap = new Map<string, Job>()

    if (jobIds.length > 0) {
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id,
          title,
          trade,
          location,
          pay_rate,
          status,
          company_id,
          assigned_worker_id
        `)
        .in('id', jobIds)

      if (jobsError) {
        setMessage(jobsError.message)
        setApplications([])
        setLoading(false)
        setRefreshing(false)
        return
      }

      jobMap = new Map(((jobsData || []) as Job[]).map((job) => [job.id, job]))
    }

    const cleaned: Application[] = rawApplications.map((application) => ({
      ...application,
      negotiation_status: application.negotiation_status || 'open',
      job: jobMap.get(application.job_id) || null,
    }))

    setCounterRates((prev) => {
      const next = { ...prev }

      cleaned.forEach((application) => {
        if (next[application.id] === undefined) {
          next[application.id] = application.requested_pay_rate || ''
        }
      })

      return next
    })

    setCounterMessages((prev) => {
      const next = { ...prev }

      cleaned.forEach((application) => {
        if (next[application.id] === undefined) {
          next[application.id] = application.negotiation_message || ''
        }
      })

      return next
    })

    setApplications(cleaned)
    setLoading(false)
    setRefreshing(false)
    window.dispatchEvent(new Event('crewcall-refresh-nav'))
  }

  const filteredApplications = useMemo(() => {
    const term = search.trim().toLowerCase()

    return applications.filter((application) => {
      const status = application.status || 'pending'
      const negotiation = application.negotiation_status || 'open'

      const matchesFilter =
        filter === 'all' ||
        status === filter ||
        negotiation === filter ||
        (filter === 'countered' && Boolean(application.company_counter_offer))

      const haystack = [
        application.job?.title,
        application.job?.trade,
        application.job?.location,
        application.job?.pay_rate,
        application.requested_pay_rate,
        application.company_counter_offer,
        application.negotiation_message,
        status,
        negotiation,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return matchesFilter && (!term || haystack.includes(term))
    })
  }, [applications, filter, search])

  const counts = useMemo(() => {
    return {
      all: applications.length,
      pending: applications.filter((app) => (app.status || 'pending') === 'pending').length,
      accepted: applications.filter((app) => app.status === 'accepted' || app.negotiation_status === 'hired').length,
      rejected: applications.filter((app) => app.status === 'rejected' || app.status === 'declined').length,
      countered: applications.filter((app) => Boolean(app.company_counter_offer)).length,
    }
  }, [applications])

  async function ensureConversation(application: Application) {
    if (!application.job?.company_id) return null

    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('job_id', application.job_id)
      .eq('company_id', application.job.company_id)
      .eq('worker_id', application.worker_id)
      .returns<ExistingConversation[]>()
      .maybeSingle()

    if (existingConversation?.id) {
      return existingConversation.id
    }

    const { data: newConversation } = await supabase
      .from('conversations')
      .insert({
        job_id: application.job_id,
        company_id: application.job.company_id,
        worker_id: application.worker_id,
      } as never)
      .select('id')
      .returns<ExistingConversation[]>()
      .maybeSingle()

    return newConversation?.id || null
  }

  async function acceptCounter(application: Application) {
    if (!application.company_counter_offer) {
      setMessage('No company counter offer to accept.')
      return
    }

    if (!application.job?.company_id) {
      setMessage('Company information missing.')
      return
    }

    const confirmed = window.confirm(
      `Accept ${application.company_counter_offer} and take this job?`
    )

    if (!confirmed) return

    setWorkingId(application.id)
    setMessage('')

    const { error: applicationError } = await supabase
      .from('applications')
      .update({
        requested_pay_rate: application.company_counter_offer,
        negotiation_status: 'hired',
        status: 'accepted',
      } as never)
      .eq('id', application.id)

    if (applicationError) {
      setMessage(applicationError.message)
      setWorkingId(null)
      return
    }

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        assigned_worker_id: application.worker_id,
        status: 'assigned',
      } as never)
      .eq('id', application.job_id)

    if (jobError) {
      setMessage(jobError.message)
      setWorkingId(null)
      return
    }

    await supabase
      .from('applications')
      .update({
        status: 'rejected',
        negotiation_status: 'declined',
      } as never)
      .eq('job_id', application.job_id)
      .neq('id', application.id)

    await supabase.from('notifications').insert({
      user_id: application.job.company_id,
      type: 'application',
      title: 'Worker accepted counter offer',
      body: `A worker accepted your counter offer for ${
        application.job?.title || 'a job'
      }.`,
      link_url: `/jobs/${application.job_id}`,
      is_read: false,
      read: false,
    } as never)

    await ensureConversation(application)

    setMessage('Offer accepted. You are now assigned to this job.')

    if (currentUserId) {
      await loadApplications(currentUserId)
    }

    setWorkingId(null)
    window.dispatchEvent(new Event('crewcall-refresh-nav'))
  }

  async function declineCounter(application: Application) {
    setWorkingId(application.id)
    setMessage('')

    const { error } = await supabase
      .from('applications')
      .update({
        negotiation_status: 'declined',
      } as never)
      .eq('id', application.id)

    if (error) {
      setMessage(error.message)
      setWorkingId(null)
      return
    }

    if (application.job?.company_id) {
      await supabase.from('notifications').insert({
        user_id: application.job.company_id,
        type: 'application',
        title: 'Worker declined counter offer',
        body: `A worker declined your counter offer for ${
          application.job?.title || 'a job'
        }.`,
        link_url: `/jobs/${application.job_id}`,
        is_read: false,
        read: false,
      } as never)
    }

    setMessage('Counter offer declined.')

    if (currentUserId) {
      await loadApplications(currentUserId)
    }

    setWorkingId(null)
    window.dispatchEvent(new Event('crewcall-refresh-nav'))
  }

  async function sendWorkerCounter(application: Application) {
    const rate = counterRates[application.id]?.trim()
    const note = counterMessages[application.id]?.trim()

    if (!rate) {
      setMessage('Enter your counter rate first.')
      return
    }

    setWorkingId(application.id)
    setMessage('')

    const { error } = await supabase
      .from('applications')
      .update({
        requested_pay_rate: rate,
        negotiation_message: note || null,
        negotiation_status: 'open',
      } as never)
      .eq('id', application.id)

    if (error) {
      setMessage(error.message)
      setWorkingId(null)
      return
    }

    if (application.job?.company_id) {
      await supabase.from('notifications').insert({
        user_id: application.job.company_id,
        type: 'application',
        title: 'Worker sent a counter offer',
        body: `A worker sent a counter offer for ${
          application.job?.title || 'a job'
        }.`,
        link_url: `/jobs/${application.job_id}`,
        is_read: false,
        read: false,
      } as never)
    }

    setMessage('Your counter offer was sent.')

    if (currentUserId) {
      await loadApplications(currentUserId)
    }

    setWorkingId(null)
    window.dispatchEvent(new Event('crewcall-refresh-nav'))
  }

  function messageHref(application: Application) {
    if (!application.job?.company_id) return '/messages'
    return `/messages?user=${application.job.company_id}&job=${application.job_id}`
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black">Loading applications...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  Worker Dashboard
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  My Applications
                </h1>

                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
                  Track applications, requested rates, company counter offers, and job assignments.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-5">
                <StatCard label="All" value={counts.all} />
                <StatCard label="Pending" value={counts.pending} />
                <StatCard label="Accepted" value={counts.accepted} />
                <StatCard label="Rejected" value={counts.rejected} />
                <StatCard label="Countered" value={counts.countered} />
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6 md:p-8">
            {message && (
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm font-bold text-cyan-100">
                {message}
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <div className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                    Search
                  </label>

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search job, trade, location, rate..."
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                    Status
                  </label>

                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value as StatusFilter)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                    <option value="countered">Countered</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => loadApplications(currentUserId || undefined)}
                  className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                >
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>

            {filteredApplications.length === 0 ? (
              <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-8 text-center shadow-2xl backdrop-blur">
                <p className="text-xl font-black text-white">
                  No applications found.
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-400">
                  Apply to jobs and your activity will show up here.
                </p>

                <Link
                  href="/jobs"
                  className="mt-5 inline-block rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
                >
                  Browse Jobs
                </Link>
              </div>
            ) : (
              <div className="space-y-5">
                {filteredApplications.map((application) => {
                  const isAssignedToMe =
                    application.job?.assigned_worker_id === application.worker_id

                  const isLocked =
                    application.negotiation_status === 'hired' ||
                    application.status === 'accepted' ||
                    isAssignedToMe

                  return (
                    <article
                      key={application.id}
                      className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl backdrop-blur transition hover:border-cyan-300/30"
                    >
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-5 flex flex-wrap items-center gap-3">
                            <h2 className="text-3xl font-black text-white">
                              {application.job?.title || 'Untitled Job'}
                            </h2>

                            <StatusBadge value={application.status || 'pending'} />
                            <StatusBadge value={`Negotiation: ${application.negotiation_status || 'open'}`} />
                          </div>

                          <p className="text-sm font-bold text-slate-300">
                            {application.job?.trade || 'Trade not listed'} •{' '}
                            {application.job?.location || 'Location not listed'}
                          </p>

                          <p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-500">
                            Applied {new Date(application.created_at).toLocaleDateString()}
                          </p>

                          <div className="mt-5 grid gap-4 sm:grid-cols-3">
                            <InfoCard label="Posted Rate" value={application.job?.pay_rate || 'Not listed'} />
                            <InfoCard label="Your Rate" value={application.requested_pay_rate || 'Not provided'} />
                            <InfoCard label="Company Counter" value={application.company_counter_offer || 'No counter yet'} />
                          </div>

                          {!isLocked && application.company_counter_offer && (
                            <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">
                              <p className="text-sm font-black uppercase tracking-wide text-cyan-200">
                                Respond To Company Counter
                              </p>

                              <div className="mt-4 flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  onClick={() => acceptCounter(application)}
                                  disabled={workingId === application.id}
                                  className="rounded-xl bg-green-600 px-5 py-3 text-sm font-black text-white hover:bg-green-700 disabled:opacity-60"
                                >
                                  {workingId === application.id ? 'Accepting...' : 'Accept Offer'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => declineCounter(application)}
                                  disabled={workingId === application.id}
                                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60"
                                >
                                  {workingId === application.id ? 'Declining...' : 'Decline'}
                                </button>
                              </div>

                              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                                <input
                                  value={counterRates[application.id] ?? application.requested_pay_rate ?? ''}
                                  onChange={(event) =>
                                    setCounterRates((prev) => ({
                                      ...prev,
                                      [application.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Example: 90/hr"
                                  className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 font-bold text-white outline-none"
                                />

                                <textarea
                                  value={counterMessages[application.id] ?? application.negotiation_message ?? ''}
                                  onChange={(event) =>
                                    setCounterMessages((prev) => ({
                                      ...prev,
                                      [application.id]: event.target.value,
                                    }))
                                  }
                                  rows={4}
                                  placeholder="Explain your counter offer..."
                                  className="mt-3 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none"
                                />

                                <button
                                  type="button"
                                  onClick={() => sendWorkerCounter(application)}
                                  disabled={workingId === application.id}
                                  className="mt-3 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
                                >
                                  {workingId === application.id ? 'Sending...' : 'Send Counter Again'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex w-full flex-col gap-3 lg:w-[220px]">
                          <Link
                            href={`/jobs/${application.job_id}`}
                            className="rounded-2xl border border-cyan-400 px-4 py-3 text-center text-sm font-black text-cyan-300 hover:bg-cyan-400/10"
                          >
                            View Job
                          </Link>

                          <Link
                            href={messageHref(application)}
                            className="rounded-2xl bg-blue-500 px-4 py-3 text-center text-sm font-black text-white hover:bg-blue-400"
                          >
                            Message Company
                          </Link>

                          <Link
                            href="/jobs"
                            className="rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-black text-slate-200 hover:bg-white/10"
                          >
                            Browse Jobs
                          </Link>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function StatusBadge({ value }: { value: string }) {
  const clean = value.toLowerCase()

  let classes = 'border-yellow-300/20 bg-yellow-400/15 text-yellow-100'

  if (clean.includes('accepted') || clean.includes('hired')) {
    classes = 'border-emerald-300/20 bg-emerald-400/15 text-emerald-100'
  }

  if (clean.includes('rejected') || clean.includes('declined')) {
    classes = 'border-red-300/20 bg-red-400/15 text-red-100'
  }

  if (clean.includes('counter')) {
    classes = 'border-blue-300/20 bg-blue-400/15 text-blue-100'
  }

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${classes}`}>
      {value}
    </span>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-sm font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 text-center">
      <p className="text-3xl font-black text-cyan-100">{value}</p>
      <p className="text-xs font-black uppercase tracking-wide text-cyan-300">
        {label}
      </p>
    </div>
  )
}