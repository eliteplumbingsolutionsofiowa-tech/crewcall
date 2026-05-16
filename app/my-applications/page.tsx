'use client'

import { useEffect, useState } from 'react'
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

function statusClass(status: string | null | undefined) {
  const clean = status || 'pending'

  if (clean === 'accepted' || clean === 'hired') {
    return 'bg-green-100 text-green-700'
  }

  if (clean === 'rejected' || clean === 'declined') {
    return 'bg-red-100 text-red-700'
  }

  if (clean === 'countered') {
    return 'bg-blue-100 text-blue-700'
  }

  return 'bg-yellow-100 text-yellow-700'
}

export default function MyApplicationsPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState('')

  const [counterRates, setCounterRates] = useState<Record<string, string>>({})
  const [counterMessages, setCounterMessages] = useState<Record<string, string>>({})

  useEffect(() => {
    let activeChannel: ReturnType<typeof supabase.channel> | null = null
    let isMounted = true

    async function startPage() {
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

      if (!isMounted) return

      setCurrentUserId(user.id)
      await loadApplications(user.id)

      const channelName = `worker-applications-${user.id}-${Date.now()}`

      activeChannel = supabase.channel(channelName)

      activeChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
          filter: `worker_id=eq.${user.id}`,
        },
        async () => {
          setLiveMessage('Negotiation updated live.')
          await loadApplications(user.id)
        }
      )

      activeChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
        },
        async () => {
          await loadApplications(user.id)
        }
      )

      activeChannel.subscribe()
    }

    startPage()

    return () => {
      isMounted = false
      if (activeChannel) {
        supabase.removeChannel(activeChannel)
      }
    }
  }, [])

  async function loadApplications(userId?: string) {
    setLoading(true)
    setMessage('')

    const workerId = userId || currentUserId

    if (!workerId) {
      setApplications([])
      setLoading(false)
      return
    }

    const { data: applicationsData, error: applicationsError } = await supabase
      .from('applications')
      .select(
        `
        id,
        job_id,
        worker_id,
        status,
        created_at,
        requested_pay_rate,
        negotiation_message,
        company_counter_offer,
        negotiation_status
      `
      )
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false })

    if (applicationsError) {
      setMessage(applicationsError.message)
      setApplications([])
      setLoading(false)
      return
    }

    const rawApplications = (applicationsData || []) as RawApplication[]

    const jobIds = Array.from(
      new Set(
        rawApplications
          .map((application) => application.job_id)
          .filter(Boolean)
      )
    )

    let jobMap = new Map<string, Job>()

    if (jobIds.length > 0) {
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select(
          `
          id,
          title,
          trade,
          location,
          pay_rate,
          status,
          company_id,
          assigned_worker_id
        `
        )
        .in('id', jobIds)

      if (jobsError) {
        setMessage(jobsError.message)
        setApplications([])
        setLoading(false)
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
  }

  async function ensureConversation(application: Application) {
    if (!application.job?.company_id) return null

    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('job_id', application.job_id)
      .eq('company_id', application.job.company_id)
      .eq('worker_id', application.worker_id)
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
      })
      .select('id')
      .maybeSingle()

    return newConversation?.id || null
  }

  async function acceptCounter(application: Application) {
    if (!application.company_counter_offer) {
      setMessage('No company counter offer to accept.')
      return
    }

    if (!application.job) {
      setMessage('Job information missing.')
      return
    }

    if (!application.job.company_id) {
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
      })
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
      })
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
      })
      .eq('job_id', application.job_id)
      .neq('id', application.id)

    await ensureConversation(application)

    await supabase.from('notifications').insert({
      user_id: application.job.company_id,
      title: 'Counter offer accepted',
      content: `Your counter offer was accepted for ${application.job.title || 'a job'}.`,
      type: 'counter_offer_accepted',
    })

    setMessage('Offer accepted. You are now assigned to this job.')

    if (currentUserId) {
      await loadApplications(currentUserId)
    }

    setWorkingId(null)
  }

  async function declineCounter(application: Application) {
    setWorkingId(application.id)
    setMessage('')

    const { error } = await supabase
      .from('applications')
      .update({
        negotiation_status: 'declined',
      })
      .eq('id', application.id)

    if (error) {
      setMessage(error.message)
      setWorkingId(null)
      return
    }

    if (application.job?.company_id) {
      await supabase.from('notifications').insert({
        user_id: application.job.company_id,
        title: 'Counter offer declined',
        content: `Your counter offer was declined for ${application.job?.title || 'a job'}.`,
        type: 'counter_offer_declined',
      })
    }

    setMessage('Counter offer declined.')

    if (currentUserId) {
      await loadApplications(currentUserId)
    }

    setWorkingId(null)
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
      })
      .eq('id', application.id)

    if (error) {
      setMessage(error.message)
      setWorkingId(null)
      return
    }

    if (application.job?.company_id) {
      await supabase.from('notifications').insert({
        user_id: application.job.company_id,
        title: 'Worker counter offer',
        content: `A worker sent a counter offer for ${application.job?.title || 'a job'}.`,
        type: 'worker_counter_offer',
      })
    }

    setMessage('Your counter offer was sent.')

    if (currentUserId) {
      await loadApplications(currentUserId)
    }

    setWorkingId(null)
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        Loading applications...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-100 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <section className="mb-8 rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-xl">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-600">
            Worker Dashboard
          </p>

          <h1 className="mt-3 text-5xl font-black text-slate-950">
            My Applications
          </h1>

          <p className="mt-3 text-lg text-slate-600">
            Track your applications, requested rates, company counter offers,
            and negotiation status.
          </p>

          <div className="mt-4 inline-flex rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-green-700">
            Live updates on
          </div>
        </section>

        {liveMessage && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
            {liveMessage}
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
            {message}
          </div>
        )}

        {applications.length === 0 ? (
          <div className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-xl">
            <p className="font-bold text-slate-700">
              You have not applied to any jobs yet.
            </p>

            <Link
              href="/jobs"
              className="mt-5 inline-block rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700"
            >
              Browse Jobs
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {applications.map((application) => {
              const isAssignedToMe =
                application.job?.assigned_worker_id === application.worker_id

              const isLocked =
                application.negotiation_status === 'hired' ||
                application.status === 'accepted' ||
                isAssignedToMe

              return (
                <div
                  key={application.id}
                  className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-xl"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <div className="mb-5 flex flex-wrap items-center gap-3">
                        <h2 className="text-3xl font-black text-slate-950">
                          {application.job?.title || 'Untitled Job'}
                        </h2>

                        <span
                          className={`rounded-full px-3 py-1 text-sm font-black uppercase ${statusClass(
                            application.status
                          )}`}
                        >
                          {application.status || 'pending'}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-sm font-black uppercase ${statusClass(
                            application.negotiation_status
                          )}`}
                        >
                          Negotiation: {application.negotiation_status || 'open'}
                        </span>

                        {isAssignedToMe && (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-black uppercase text-green-700">
                            Assigned To You
                          </span>
                        )}
                      </div>

                      <p className="text-slate-600">
                        {application.job?.trade || 'Trade not listed'} ·{' '}
                        {application.job?.location || 'Location not listed'}
                      </p>

                      <div className="mt-5 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                            Posted Rate
                          </p>
                          <p className="mt-2 text-xl font-black text-slate-900">
                            {application.job?.pay_rate || 'Not listed'}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                          <p className="text-sm font-black uppercase tracking-wide text-cyan-700">
                            Your Requested Rate
                          </p>
                          <p className="mt-2 text-xl font-black text-cyan-900">
                            {application.requested_pay_rate || 'Not provided'}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                          <p className="text-sm font-black uppercase tracking-wide text-blue-700">
                            Company Counter
                          </p>
                          <p className="mt-2 text-xl font-black text-blue-900">
                            {application.company_counter_offer || 'No counter yet'}
                          </p>
                        </div>
                      </div>

                      {application.negotiation_message && (
                        <div className="mt-5 rounded-2xl border border-orange-100 bg-orange-50 p-5">
                          <p className="text-sm font-black uppercase tracking-wide text-orange-700">
                            Your Negotiation Message
                          </p>

                          <p className="mt-3 whitespace-pre-wrap text-orange-950">
                            {application.negotiation_message}
                          </p>
                        </div>
                      )}

                      {isLocked ? (
                        <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-5">
                          <p className="text-sm font-black uppercase tracking-wide text-green-700">
                            Deal Locked
                          </p>

                          <p className="mt-2 text-green-900">
                            This negotiation is complete and you are assigned to
                            the job.
                          </p>
                        </div>
                      ) : (
                        application.company_counter_offer && (
                          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                            <p className="text-sm font-black uppercase tracking-wide text-blue-700">
                              Respond To Company Counter
                            </p>

                            <p className="mt-2 text-sm font-semibold text-blue-900">
                              Company offered:{' '}
                              <span className="text-lg font-black">
                                {application.company_counter_offer}
                              </span>
                            </p>

                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                onClick={() => acceptCounter(application)}
                                disabled={workingId === application.id}
                                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-black text-white hover:bg-green-700 disabled:opacity-60"
                              >
                                {workingId === application.id
                                  ? 'Accepting...'
                                  : 'Accept Offer'}
                              </button>

                              <button
                                onClick={() => declineCounter(application)}
                                disabled={workingId === application.id}
                                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60"
                              >
                                Decline
                              </button>
                            </div>

                            <div className="mt-5 rounded-2xl border border-white bg-white/80 p-4">
                              <p className="text-sm font-black uppercase tracking-wide text-slate-600">
                                Counter Again
                              </p>

                              <input
                                value={
                                  counterRates[application.id] ??
                                  application.requested_pay_rate ??
                                  ''
                                }
                                onChange={(event) =>
                                  setCounterRates((prev) => ({
                                    ...prev,
                                    [application.id]: event.target.value,
                                  }))
                                }
                                placeholder="Example: 90/hr"
                                className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-blue-500"
                              />

                              <textarea
                                value={
                                  counterMessages[application.id] ??
                                  application.negotiation_message ??
                                  ''
                                }
                                onChange={(event) =>
                                  setCounterMessages((prev) => ({
                                    ...prev,
                                    [application.id]: event.target.value,
                                  }))
                                }
                                rows={4}
                                placeholder="Explain your counter offer..."
                                className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                              />

                              <button
                                onClick={() => sendWorkerCounter(application)}
                                disabled={workingId === application.id}
                                className="mt-3 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60"
                              >
                                Send Counter Again
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    <div className="flex w-full flex-col gap-3 lg:w-[220px]">
                      <Link
                        href={`/jobs/${application.job_id}`}
                        className="rounded-2xl border border-blue-600 px-4 py-3 text-center text-sm font-black text-blue-600 hover:bg-blue-50"
                      >
                        View Job
                      </Link>

                      <Link
                        href="/jobs"
                        className="rounded-2xl border border-slate-300 px-4 py-3 text-center text-sm font-black text-slate-700 hover:bg-slate-50"
                      >
                        Browse Jobs
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}