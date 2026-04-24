'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Applicant = {
  id: string
  worker_id: string
  status: string | null
  created_at: string
  profiles: {
    full_name: string | null
    primary_trade: string | null
    years_experience: number | null
  } | null
}

export default function ApplicantsList({ jobId }: { jobId: string }) {
  const router = useRouter()

  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [workingId, setWorkingId] = useState<string | null>(null)

  useEffect(() => {
    let activeChannel: ReturnType<typeof supabase.channel> | null = null
    let isMounted = true

    async function loadApplicants() {
      const { data, error } = await supabase
        .from('job_applications')
        .select(
          `
          id,
          worker_id,
          status,
          created_at,
          profiles:worker_id (
            full_name,
            primary_trade,
            years_experience
          )
        `
        )
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (error) {
        if (isMounted) {
          setErrorMessage(error.message)
          setLoading(false)
        }
        return
      }

      if (isMounted) {
        const cleanedApplicants = (data || []).map((app: any) => ({
  ...app,
  profiles: Array.isArray(app.profiles) ? app.profiles[0] : app.profiles,
}))

setApplicants(cleanedApplicants as unknown as Applicant[])
        setLoading(false)
      }
    }

    async function init() {
      setLoading(true)
      setErrorMessage(null)

      await loadApplicants()

      const channelName = `applicants-${jobId}-${Date.now()}`
      activeChannel = supabase.channel(channelName)

      activeChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications',
          filter: `job_id=eq.${jobId}`,
        },
        async () => {
          await loadApplicants()
        }
      )

      activeChannel.subscribe()
    }

    init()

    return () => {
      isMounted = false
      if (activeChannel) {
        supabase.removeChannel(activeChannel)
      }
    }
  }, [jobId])

  async function handleAccept(applicationId: string, workerId: string) {
    setWorkingId(applicationId)
    setErrorMessage(null)

    const { error: acceptError } = await supabase
      .from('job_applications')
      .update({ status: 'accepted' })
      .eq('id', applicationId)

    if (acceptError) {
      setErrorMessage(acceptError.message)
      setWorkingId(null)
      return
    }

    await supabase
      .from('job_applications')
      .update({ status: 'rejected' })
      .eq('job_id', jobId)
      .neq('id', applicationId)

    const { error: jobError } = await supabase
      .from('jobs')
      .update({ status: 'assigned' })
      .eq('id', jobId)

    if (jobError) {
      setErrorMessage(jobError.message)
      setWorkingId(null)
      return
    }

    await supabase.from('notifications').insert({
      user_id: workerId,
      title: 'Job Assigned',
      body: 'You were selected for a job.',
      read: false,
    })

    setWorkingId(null)
  }

  async function handleReject(applicationId: string, workerId: string) {
    setWorkingId(applicationId)
    setErrorMessage(null)

    const { error } = await supabase
      .from('job_applications')
      .update({ status: 'rejected' })
      .eq('id', applicationId)

    if (error) {
      setErrorMessage(error.message)
      setWorkingId(null)
      return
    }

    await supabase.from('notifications').insert({
      user_id: workerId,
      title: 'Application Update',
      body: 'Your application was not selected.',
      read: false,
    })

    setWorkingId(null)
  }

  async function handleMessage(workerId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('worker_id', workerId)
      .eq('company_id', user.id)
      .eq('job_id', jobId)
      .maybeSingle()

    let conversationId = existing?.id

    if (!conversationId) {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          worker_id: workerId,
          company_id: user.id,
          job_id: jobId,
        })
        .select('id')
        .single()

      if (error || !data?.id) {
        setErrorMessage(error?.message || 'Error creating conversation.')
        return
      }

      conversationId = data.id
    }

    router.push(`/messages/${conversationId}`)
  }

  function statusClasses(status: string | null) {
    if (status === 'accepted') return 'bg-green-100 text-green-700'
    if (status === 'rejected') return 'bg-red-100 text-red-700'
    return 'bg-yellow-100 text-yellow-700'
  }

  if (loading) {
    return (
      <div className="mt-4 rounded-2xl border bg-white p-6 shadow-sm">
        Loading applicants...
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
        {errorMessage}
      </div>
    )
  }

  if (applicants.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border bg-white p-6 text-gray-500 shadow-sm">
        No applicants yet.
      </div>
    )
  }

  return (
    <div className="mt-4 grid gap-4">
      {applicants.map((applicant) => (
        <div
          key={applicant.id}
          className="rounded-2xl border bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xl font-bold text-gray-900">
                {applicant.profiles?.full_name || 'Worker'}
              </div>

              <div className="mt-2 text-sm text-gray-600">
                {applicant.profiles?.primary_trade || 'Trade not set'}
                {applicant.profiles?.years_experience
                  ? ` • ${applicant.profiles.years_experience} years experience`
                  : ''}
              </div>

              <div className="mt-3">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(
                    applicant.status
                  )}`}
                >
                  {(applicant.status || 'pending').toUpperCase()}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/profiles/${applicant.worker_id}`}
                className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                View Profile
              </Link>

              <button
                onClick={() => handleMessage(applicant.worker_id)}
                className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Message
              </button>

              {applicant.status !== 'accepted' && (
                <button
                  onClick={() =>
                    handleAccept(applicant.id, applicant.worker_id)
                  }
                  disabled={workingId === applicant.id}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {workingId === applicant.id ? 'Working...' : 'Accept'}
                </button>
              )}

              {applicant.status === 'pending' && (
                <button
                  onClick={() =>
                    handleReject(applicant.id, applicant.worker_id)
                  }
                  disabled={workingId === applicant.id}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {workingId === applicant.id ? 'Working...' : 'Reject'}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}