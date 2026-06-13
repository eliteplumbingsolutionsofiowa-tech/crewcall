'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type ApplicantProfile = {
  id: string
  full_name: string | null
  company_name: string | null
  role: string | null
  trade: string | null
  city: string | null
  state: string | null
  phone: string | null
  years_experience: string | null
  insurance_provider: string | null
  job_experience: string | null
  liability_form_signed: boolean | null
  insurance_verified: boolean | null
  liability_form_verified: boolean | null
  company_verified: boolean | null
}

type Application = {
  id: string
  job_id: string | null
  worker_id: string | null
  status: string | null
  created_at: string | null
  message?: string | null
  profiles?: ApplicantProfile | ApplicantProfile[] | null
}

type Conversation = {
  id: string
}

type ApplicationUpdate = {
  status: 'pending' | 'accepted' | 'rejected'
}

type JobUpdate = {
  status: 'active'
  assigned_worker_id: string | null
  assigned_application_id: string
}

type ConversationInsert = {
  job_id: string
  company_id: string
  worker_id: string
}

type ApplicantsListProps = {
  jobId: string
  companyId?: string | null
  onApplicantAccepted?: () => void
}

type QueryError = {
  message: string
}

type OrderedQuery<T> = {
  order: (
    column: string,
    options?: { ascending?: boolean }
  ) => Promise<{ data: T[] | null; error: QueryError | null }>
}

type EqOrderQuery<T> = {
  eq: (column: string, value: string) => OrderedQuery<T>
}

type SelectOrderTable<T> = {
  select: (columns: string) => EqOrderQuery<T>
}

type UpdateEqQuery = {
  eq: (
    column: string,
    value: string
  ) => Promise<{ data: null; error: QueryError | null }>
}

type UpdateEqNeqQuery = {
  neq: (
    column: string,
    value: string
  ) => Promise<{ data: null; error: QueryError | null }>
}

type UpdateEqThenNeqQuery = {
  eq: (column: string, value: string) => UpdateEqNeqQuery
}

type UpdateTable<TUpdate> = {
  update: (value: TUpdate) => UpdateEqQuery
}

type UpdateWithNeqTable<TUpdate> = {
  update: (value: TUpdate) => UpdateEqThenNeqQuery
}

type ConversationQuery<T> = {
  eq: (column: string, value: string) => ConversationQuery<T>
  maybeSingle: () => Promise<{ data: T | null; error: QueryError | null }>
}

type ConversationSelectTable<T> = {
  select: (columns: string) => ConversationQuery<T>
}

type SingleQuery<T> = {
  single: () => Promise<{ data: T | null; error: QueryError | null }>
}

type SelectIdQuery<T> = {
  select: (columns: string) => SingleQuery<T>
}

type InsertSelectTable<TInsert, TReturn> = {
  insert: (value: TInsert) => SelectIdQuery<TReturn>
}

function applicationsSelectTable() {
  return supabase.from('applications') as unknown as SelectOrderTable<Application>
}

function applicationsUpdateTable() {
  return supabase
    .from('applications') as unknown as UpdateTable<ApplicationUpdate>
}

function applicationsUpdateWithNeqTable() {
  return supabase
    .from('applications') as unknown as UpdateWithNeqTable<ApplicationUpdate>
}

function jobsUpdateTable() {
  return supabase.from('jobs') as unknown as UpdateTable<JobUpdate>
}

function conversationsSelectTable() {
  return supabase
    .from('conversations') as unknown as ConversationSelectTable<Conversation>
}

function conversationsInsertTable() {
  return supabase
    .from('conversations') as unknown as InsertSelectTable<
      ConversationInsert,
      Conversation
    >
}

export default function ApplicantsList({
  jobId,
  companyId = null,
  onApplicantAccepted,
}: ApplicantsListProps) {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadApplications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  async function loadApplications() {
    setLoading(true)
    setMessage(null)

    const { data: rawApplications, error } = await applicationsSelectTable()
      .select(
        `
        id,
        job_id,
        worker_id,
        status,
        created_at,
        message,
        profiles:worker_id (
          id,
          full_name,
          company_name,
          role,
          trade,
          city,
          state,
          phone,
          years_experience,
          insurance_provider,
          job_experience,
          liability_form_signed,
          insurance_verified,
          liability_form_verified,
          company_verified
        )
      `
      )
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setApplications([])
      setLoading(false)
      return
    }

    const seenWorkers = new Set<string>()

    const applicationData = (rawApplications ?? []).filter((app) => {
      if (!app.worker_id) return false
      if (seenWorkers.has(app.worker_id)) return false

      seenWorkers.add(app.worker_id)
      return true
    })

    setApplications(applicationData)
    setLoading(false)
  }

  function getProfile(app: Application): ApplicantProfile | null {
    if (!app.profiles) return null
    if (Array.isArray(app.profiles)) return app.profiles[0] ?? null
    return app.profiles
  }

  async function updateApplicationStatus(
    application: Application,
    nextStatus: 'pending' | 'accepted' | 'rejected'
  ) {
    setUpdatingId(application.id)
    setMessage(null)

    const { error: applicationError } = await applicationsUpdateTable()
      .update({ status: nextStatus })
      .eq('id', application.id)

    if (applicationError) {
      setMessage(applicationError.message)
      setUpdatingId(null)
      return
    }

    if (nextStatus === 'accepted') {
      const { error: jobError } = await jobsUpdateTable()
        .update({
          status: 'active',
          assigned_worker_id: application.worker_id,
          assigned_application_id: application.id,
        })
        .eq('id', jobId)

      if (jobError) {
        setMessage(jobError.message)
        setUpdatingId(null)
        return
      }

      await applicationsUpdateWithNeqTable()
        .update({ status: 'rejected' })
        .eq('job_id', jobId)
        .neq('id', application.id)
    }

    setApplications((current) =>
      current.map((app) =>
        app.id === application.id ? { ...app, status: nextStatus } : app
      )
    )

    setUpdatingId(null)

    if (nextStatus === 'accepted') {
      setMessage('Applicant accepted and job moved to active.')
      onApplicantAccepted?.()
    } else if (nextStatus === 'rejected') {
      setMessage('Applicant rejected.')
    } else {
      setMessage('Application moved back to pending.')
    }
  }

  async function startConversation(application: Application) {
    if (!companyId || !application.worker_id) {
      setMessage('Missing company or worker information for messaging.')
      return
    }

    setUpdatingId(application.id)
    setMessage(null)

    const { data: existingConversation, error: existingError } =
      await conversationsSelectTable()
        .select('id')
        .eq('job_id', jobId)
        .eq('company_id', companyId)
        .eq('worker_id', application.worker_id)
        .maybeSingle()

    if (existingError) {
      setMessage(existingError.message)
      setUpdatingId(null)
      return
    }

    if (existingConversation?.id) {
      window.location.href = `/messages/${existingConversation.id}`
      return
    }

    const { data: newConversation, error: createError } =
      await conversationsInsertTable()
        .insert({
          job_id: jobId,
          company_id: companyId,
          worker_id: application.worker_id,
        })
        .select('id')
        .single()

    if (createError) {
      setMessage(createError.message)
      setUpdatingId(null)
      return
    }

    if (newConversation?.id) {
      window.location.href = `/messages/${newConversation.id}`
      return
    }

    setMessage('Conversation could not be created.')
    setUpdatingId(null)
  }

  function formatDate(value: string | null) {
    if (!value) return 'Unknown date'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return value

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function statusBadgeClass(status: string | null) {
    if (status === 'accepted') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }

    if (status === 'rejected') {
      return 'bg-red-50 text-red-700 border-red-200'
    }

    return 'bg-blue-50 text-blue-700 border-blue-200'
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm font-black text-slate-500 shadow-sm">
        Loading applicants...
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {message && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
          {message}
        </div>
      )}

      {applications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-black text-slate-950">
            No applicants yet.
          </h2>
          <p className="mt-2 text-sm font-bold text-slate-500">
            When workers apply for this job, they will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((application) => {
            const profile = getProfile(application)
            const displayName =
              profile?.full_name ||
              profile?.company_name ||
              'Unnamed applicant'
            const location = [profile?.city, profile?.state]
              .filter(Boolean)
              .join(', ')

            return (
              <div
                key={application.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${statusBadgeClass(
                          application.status
                        )}`}
                      >
                        {application.status || 'pending'}
                      </span>

                      {profile?.trade && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                          {profile.trade}
                        </span>
                      )}

                      {profile?.insurance_verified && (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
                          Insurance Verified
                        </span>
                      )}

                      {profile?.liability_form_verified && (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
                          Liability Verified
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xl font-black text-slate-950">
                        {displayName}
                      </h3>

                      <p className="mt-1 text-sm font-bold text-slate-500">
                        Applied {formatDate(application.created_at)}
                        {location ? ` • ${location}` : ''}
                      </p>
                    </div>

                    {application.message && (
                      <p className="max-w-3xl rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
                        {application.message}
                      </p>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-2xl border border-slate-200 p-3">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                          Phone
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-950">
                          {profile?.phone || 'Not provided'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 p-3">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                          Experience
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-950">
                          {profile?.years_experience || 'Not provided'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 p-3">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                          Insurance
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-950">
                          {profile?.insurance_provider || 'Not provided'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 p-3">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                          Liability Form
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-950">
                          {profile?.liability_form_signed
                            ? 'Signed'
                            : 'Not signed'}
                        </p>
                      </div>
                    </div>

                    {profile?.job_experience && (
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                          Job Experience
                        </p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                          {profile.job_experience}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-48 flex-col gap-2">
                    <button
                      onClick={() => startConversation(application)}
                      disabled={updatingId === application.id}
                      className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
                    >
                      Message
                    </button>

                    {application.status !== 'accepted' && (
                      <button
                        onClick={() =>
                          updateApplicationStatus(application, 'accepted')
                        }
                        disabled={updatingId === application.id}
                        className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
                      >
                        Accept
                      </button>
                    )}

                    {application.status !== 'rejected' && (
                      <button
                        onClick={() =>
                          updateApplicationStatus(application, 'rejected')
                        }
                        disabled={updatingId === application.id}
                        className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-500 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    )}

                    {application.status !== 'pending' && (
                      <button
                        onClick={() =>
                          updateApplicationStatus(application, 'pending')
                        }
                        disabled={updatingId === application.id}
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-900 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Mark Pending
                      </button>
                    )}

                    {application.worker_id && (
                      <Link
                        href={`/profile/${application.worker_id}`}
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-black text-slate-900 transition hover:bg-slate-50"
                      >
                        View Profile
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}