'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Applicant = {
  id: string
  worker_id: string
  status: string | null
  created_at: string

  requested_pay_rate: string | null
  negotiation_message: string | null
  company_counter_offer: string | null
  negotiation_status: string | null

  worker: {
    id: string
    full_name: string | null
    trade: string | null
    years_experience: string | null
    insurance_provider: string | null
    liability_form_signed: boolean | null
    average_rating?: number
    review_count?: number
  } | null
}

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  status: string | null
  assigned_worker_id: string | null
  company_id: string | null
}

type ReviewRow = {
  reviewee_id: string
  rating: number
}

function renderStars(value: number) {
  const safe = Math.max(0, Math.min(5, Math.round(value)))
  return '★'.repeat(safe) + '☆'.repeat(5 - safe)
}

function statusClass(status: string | null | undefined) {
  const clean = status || 'open'

  if (clean === 'countered') return 'bg-blue-100 text-blue-700'
  if (clean === 'accepted' || clean === 'hired') return 'bg-green-100 text-green-700'
  if (clean === 'declined' || clean === 'rejected') return 'bg-red-100 text-red-700'

  return 'bg-yellow-100 text-yellow-700'
}

export default function ApplicantsPage() {
  const params = useParams()
  const jobId = params?.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [loading, setLoading] = useState(true)
  const [hiringWorkerId, setHiringWorkerId] = useState<string | null>(null)
  const [counteringId, setCounteringId] = useState<string | null>(null)
  const [counterOffers, setCounterOffers] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [liveMessage, setLiveMessage] = useState('')

  useEffect(() => {
    let activeChannel: ReturnType<typeof supabase.channel> | null = null
    let isMounted = true

    async function startRealtime() {
      await loadApplicants()

      if (!isMounted || !jobId) return

      const channelName = `company-applicants-${jobId}-${Date.now()}`
      activeChannel = supabase.channel(channelName)

      activeChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
          filter: `job_id=eq.${jobId}`,
        },
        async () => {
          setLiveMessage('Applicant negotiation updated live.')
          await loadApplicants()
        }
      )

      activeChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`,
        },
        async () => {
          setLiveMessage('Job assignment updated live.')
          await loadApplicants()
        }
      )

      activeChannel.subscribe()
    }

    startRealtime()

    return () => {
      isMounted = false

      if (activeChannel) {
        supabase.removeChannel(activeChannel)
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  async function loadApplicants() {
    setLoading(true)
    setMessage('')

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select(
        `
        id,
        title,
        trade,
        location,
        pay_rate,
        status,
        assigned_worker_id,
        company_id
      `
      )
      .eq('id', jobId)
      .maybeSingle()

    if (jobError || !jobData) {
      setMessage(jobError?.message || 'Job not found.')
      setApplicants([])
      setLoading(false)
      return
    }

    setJob(jobData as Job)

    const { data: applicationsData, error: applicationsError } = await supabase
      .from('applications')
      .select(
        `
        id,
        worker_id,
        status,
        created_at,
        requested_pay_rate,
        negotiation_message,
        company_counter_offer,
        negotiation_status
      `
      )
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (applicationsError) {
      setMessage(applicationsError.message)
      setApplicants([])
      setLoading(false)
      return
    }

    const workerIds =
      applicationsData?.map((application) => application.worker_id).filter(Boolean) || []

    let workersData: Applicant['worker'][] = []

    if (workerIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select(
          `
          id,
          full_name,
          trade,
          years_experience,
          insurance_provider,
          liability_form_signed
        `
        )
        .in('id', workerIds)

      workersData = (data || []) as Applicant['worker'][]
    }

    let reviewsData: ReviewRow[] = []

    if (workerIds.length > 0) {
      const { data } = await supabase
        .from('reviews')
        .select(
          `
          reviewee_id,
          rating
        `
        )
        .in('reviewee_id', workerIds)

      reviewsData = (data || []) as ReviewRow[]
    }

    const reviewMap = new Map<string, { average: number; count: number }>()

    workerIds.forEach((workerId) => {
      const workerReviews = reviewsData.filter(
        (review) => review.reviewee_id === workerId
      )

      const count = workerReviews.length

      const average =
        count > 0
          ? workerReviews.reduce((sum, review) => sum + review.rating, 0) / count
          : 0

      reviewMap.set(workerId, { average, count })
    })

    const workerMap = new Map<string, Applicant['worker']>()

    workersData?.forEach((worker) => {
      if (!worker) return

      const reviewStats = reviewMap.get(worker.id)

      workerMap.set(worker.id, {
        ...worker,
        average_rating: reviewStats?.average || 0,
        review_count: reviewStats?.count || 0,
      })
    })

    const mergedApplicants =
      applicationsData?.map((application) => ({
        ...application,
        company_counter_offer: application.company_counter_offer || null,
        negotiation_status: application.negotiation_status || 'open',
        worker: workerMap.get(application.worker_id) || null,
      })) || []

    setCounterOffers((prev) => {
      const next = { ...prev }

      mergedApplicants.forEach((application) => {
        if (next[application.id] === undefined) {
          next[application.id] = application.company_counter_offer || ''
        }
      })

      return next
    })

    setApplicants(mergedApplicants as Applicant[])
    setLoading(false)
  }

  async function sendCounterOffer(applicant: Applicant) {
    const counterOffer = counterOffers[applicant.id]?.trim()

    if (!counterOffer) {
      setMessage('Enter a counter offer first.')
      return
    }

    setCounteringId(applicant.id)
    setMessage('')

    const { error } = await supabase
      .from('applications')
      .update({
        company_counter_offer: counterOffer,
        negotiation_status: 'countered',
      })
      .eq('id', applicant.id)

    if (error) {
      setMessage(error.message)
      setCounteringId(null)
      return
    }

    await supabase.from('notifications').insert({
      user_id: applicant.worker_id,
      title: 'Counter offer received',
      content: `A company sent a counter offer for ${job?.title || 'your application'}.`,
      type: 'counter_offer',
    })

    setMessage('Counter offer sent.')
    await loadApplicants()
    setCounteringId(null)
  }

  async function hireWorker(applicant: Applicant) {
    if (!job) return

    const confirmed = window.confirm(
      `Assign ${applicant.worker?.full_name || 'this worker'} to this job?`
    )

    if (!confirmed) return

    setHiringWorkerId(applicant.worker_id)
    setMessage('')

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        assigned_worker_id: applicant.worker_id,
        status: 'assigned',
      })
      .eq('id', job.id)

    if (jobError) {
      setMessage(jobError.message)
      setHiringWorkerId(null)
      return
    }

    await supabase
      .from('applications')
      .update({
        status: 'accepted',
        negotiation_status: 'hired',
      })
      .eq('id', applicant.id)

    await supabase
      .from('applications')
      .update({
        status: 'rejected',
        negotiation_status: 'declined',
      })
      .eq('job_id', job.id)
      .neq('id', applicant.id)

    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('job_id', job.id)
      .eq('company_id', job.company_id)
      .eq('worker_id', applicant.worker_id)
      .maybeSingle()

    if (!existingConversation) {
      await supabase.from('conversations').insert({
        job_id: job.id,
        company_id: job.company_id,
        worker_id: applicant.worker_id,
      })
    }

    await supabase.from('notifications').insert({
      user_id: applicant.worker_id,
      title: 'You were hired',
      content: `You were assigned to ${job.title || 'a job'}.`,
      type: 'job_assigned',
    })

    setMessage('Worker successfully assigned.')
    await loadApplicants()
    setHiringWorkerId(null)
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        Loading applicants...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-100 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/my-jobs"
          className="mb-6 inline-block text-sm font-bold text-gray-600 hover:text-blue-600"
        >
          ← Back to My Jobs
        </Link>

        <div className="mb-8 rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-600">
                Hiring Pipeline
              </p>

              <h1 className="mt-3 text-5xl font-black text-slate-950">
                Applicants
              </h1>

              <p className="mt-3 text-lg text-slate-600">
                {job?.title} · {job?.trade} · {job?.location}
              </p>

              <p className="mt-2 text-sm font-bold text-slate-500">
                Posted Rate: {job?.pay_rate || 'Not listed'}
              </p>

              <div className="mt-4 inline-flex rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-green-700">
                Live updates on
              </div>
            </div>

            <div className="rounded-full border border-blue-100 bg-blue-50 px-5 py-3 text-sm font-black uppercase tracking-wide text-blue-700">
              Job Status: {job?.status}
            </div>
          </div>
        </div>

        {liveMessage && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
            {liveMessage}
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
            {message}
          </div>
        )}

        {applicants.length === 0 ? (
          <div className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-xl">
            <p className="font-bold text-slate-700">
              No applicants for this job yet.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {applicants.map((applicant) => {
              const hired = job?.assigned_worker_id === applicant.worker_id
              const workerAcceptedCounter =
                applicant.status === 'accepted' ||
                applicant.negotiation_status === 'accepted' ||
                applicant.negotiation_status === 'hired'

              return (
                <div
                  key={applicant.id}
                  className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-xl"
                >
                  <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <div className="mb-5 flex flex-wrap items-center gap-3">
                        <h2 className="text-3xl font-black text-slate-950">
                          {applicant.worker?.full_name || 'Unnamed Worker'}
                        </h2>

                        {applicant.status && (
                          <div className="rounded-full bg-green-100 px-3 py-1 text-sm font-black uppercase text-green-700">
                            {applicant.status}
                          </div>
                        )}

                        <div
                          className={`rounded-full px-3 py-1 text-sm font-black uppercase ${statusClass(
                            applicant.negotiation_status
                          )}`}
                        >
                          {applicant.negotiation_status || 'open'}
                        </div>

                        {workerAcceptedCounter && !hired && (
                          <div className="rounded-full bg-green-100 px-3 py-1 text-sm font-black uppercase text-green-700">
                            Worker Accepted Offer
                          </div>
                        )}

                        {hired && (
                          <div className="rounded-full bg-blue-100 px-3 py-1 text-sm font-black uppercase text-blue-700">
                            Worker Assigned
                          </div>
                        )}

                        {applicant.worker?.liability_form_signed && (
                          <div className="rounded-full bg-orange-100 px-3 py-1 text-sm font-black uppercase text-orange-700">
                            Verified
                          </div>
                        )}
                      </div>

                      {workerAcceptedCounter && !hired && (
                        <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 p-5">
                          <p className="text-sm font-black uppercase tracking-wide text-green-700">
                            Worker Accepted Your Counter Offer
                          </p>

                          <p className="mt-2 text-green-900">
                            The worker accepted the company counter offer. Click
                            <span className="font-black"> Finalize Hire </span>
                            to assign them to the job.
                          </p>
                        </div>
                      )}

                      <div className="mb-6 flex flex-wrap items-center gap-5">
                        <div>
                          <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                            Reputation
                          </p>

                          <p className="mt-1 text-lg font-black text-yellow-500">
                            {renderStars(applicant.worker?.average_rating || 0)}
                          </p>

                          <p className="text-sm font-semibold text-slate-600">
                            {(applicant.worker?.average_rating || 0).toFixed(1)}{' '}
                            ({applicant.worker?.review_count || 0} reviews)
                          </p>
                        </div>

                        <div className="h-14 w-px bg-slate-200" />

                        <div>
                          <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                            Applied
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-700">
                            {new Date(applicant.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                            Trade
                          </p>

                          <p className="mt-2 text-lg font-bold text-slate-900">
                            {applicant.worker?.trade || 'Not listed'}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                          <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                            Experience
                          </p>

                          <p className="mt-2 text-lg font-bold text-slate-900">
                            {applicant.worker?.years_experience || 'Not listed'}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                          <p className="text-sm font-black uppercase tracking-wide text-cyan-700">
                            Worker Requested Rate
                          </p>

                          <p className="mt-2 text-xl font-black text-cyan-900">
                            {applicant.requested_pay_rate ||
                              job?.pay_rate ||
                              'Not provided'}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                          <p className="text-sm font-black uppercase tracking-wide text-blue-700">
                            Company Counter Offer
                          </p>

                          <p className="mt-2 text-xl font-black text-blue-900">
                            {applicant.company_counter_offer || 'No counter sent'}
                          </p>
                        </div>

                        {applicant.negotiation_message && (
                          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5 sm:col-span-2">
                            <p className="text-sm font-black uppercase tracking-wide text-orange-700">
                              Worker Negotiation Message
                            </p>

                            <p className="mt-3 whitespace-pre-wrap text-base text-orange-950">
                              {applicant.negotiation_message}
                            </p>
                          </div>
                        )}

                        {!hired && !workerAcceptedCounter && (
                          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 sm:col-span-2">
                            <p className="text-sm font-black uppercase tracking-wide text-blue-700">
                              Send / Update Company Counter Offer
                            </p>

                            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                              <input
                                value={
                                  counterOffers[applicant.id] ??
                                  applicant.company_counter_offer ??
                                  ''
                                }
                                onChange={(event) =>
                                  setCounterOffers((prev) => ({
                                    ...prev,
                                    [applicant.id]: event.target.value,
                                  }))
                                }
                                placeholder="Example: 85/hr"
                                className="flex-1 rounded-xl border border-blue-200 bg-white px-4 py-3 font-bold text-slate-950 outline-none focus:border-blue-500"
                              />

                              <button
                                onClick={() => sendCounterOffer(applicant)}
                                disabled={counteringId === applicant.id}
                                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60"
                              >
                                {counteringId === applicant.id
                                  ? 'Sending...'
                                  : 'Send Counter'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex w-full flex-col gap-3 lg:w-[240px]">
                      <Link
                        href={`/profile?user=${applicant.worker_id}`}
                        className="rounded-2xl border border-blue-600 px-4 py-3 text-center text-sm font-black text-blue-600 hover:bg-blue-50"
                      >
                        View Profile
                      </Link>

                      <button className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                        Message Worker
                      </button>

                      {hired ? (
                        <button
                          disabled
                          className="cursor-not-allowed rounded-2xl bg-gray-300 px-4 py-3 text-sm font-black text-gray-600"
                        >
                          Worker Assigned
                        </button>
                      ) : workerAcceptedCounter ? (
                        <button
                          onClick={() => hireWorker(applicant)}
                          disabled={hiringWorkerId === applicant.worker_id}
                          className="rounded-2xl bg-green-600 px-4 py-3 text-sm font-black text-white hover:bg-green-700 disabled:opacity-60"
                        >
                          {hiringWorkerId === applicant.worker_id
                            ? 'Finalizing...'
                            : 'Finalize Hire'}
                        </button>
                      ) : (
                        <button
                          onClick={() => hireWorker(applicant)}
                          disabled={hiringWorkerId === applicant.worker_id}
                          className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {hiringWorkerId === applicant.worker_id
                            ? 'Assigning...'
                            : 'Hire Worker'}
                        </button>
                      )}
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