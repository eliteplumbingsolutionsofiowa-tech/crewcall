'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string
  description: string | null
  trade: string
  location: string
  pay_rate: string | null
  start_date: string | null
  status: string
  company_id: string
  hired_worker_id: string | null
}

type Applicant = {
  id: string
  worker_id: string
  status: string
  created_at: string
  profiles: {
    id: string
    full_name: string | null
    city: string | null
    state: string | null
    phone: string | null
  } | null
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [hireLoadingId, setHireLoadingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadPage() {
      setLoading(true)
      setErrorMessage(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const currentUserId = user?.id ?? null
      setUserId(currentUserId)

      if (currentUserId) {
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUserId)
          .single()

        setUserRole(myProfile?.role ?? null)
      }

      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (jobError || !jobData) {
        setErrorMessage('Could not load job.')
        setLoading(false)
        return
      }

      setJob(jobData)

      const { data: applicantsData, error: applicantsError } = await supabase
        .from('applications')
        .select(`
          id,
          worker_id,
          status,
          created_at,
          profiles:worker_id (
            id,
            full_name,
            city,
            state,
            phone
          )
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: true })

      if (applicantsError) {
        setErrorMessage('Could not load applicants.')
        setApplicants([])
      } else {
        const cleanedApplicants = (applicantsData || []).map((app: any) => ({
  ...app,
  profiles: Array.isArray(app.profiles) ? app.profiles[0] : app.profiles,
}))

setApplicants(cleanedApplicants as unknown as Applicant[])
      }

      setLoading(false)
    }

    loadPage()
  }, [jobId])

  async function handleHireWorker(applicant: Applicant) {
    if (!job) return

    setHireLoadingId(applicant.id)
    setErrorMessage(null)

    try {
      const { error: jobUpdateError } = await supabase
        .from('jobs')
        .update({
          status: 'assigned',
          hired_worker_id: applicant.worker_id,
        })
        .eq('id', job.id)

      if (jobUpdateError) throw jobUpdateError

      const { error: hireAppError } = await supabase
        .from('applications')
        .update({ status: 'hired' })
        .eq('id', applicant.id)

      if (hireAppError) throw hireAppError

      const otherApplicantIds = applicants
        .filter((a) => a.id !== applicant.id)
        .map((a) => a.id)

      if (otherApplicantIds.length > 0) {
        const { error: rejectOthersError } = await supabase
          .from('applications')
          .update({ status: 'rejected' })
          .in('id', otherApplicantIds)

        if (rejectOthersError) throw rejectOthersError
      }

      setJob({
        ...job,
        status: 'assigned',
        hired_worker_id: applicant.worker_id,
      })

      setApplicants((prev) =>
        prev.map((a) => {
          if (a.id === applicant.id) {
            return { ...a, status: 'hired' }
          }
          return { ...a, status: 'rejected' }
        })
      )
    } catch (error) {
      console.error(error)
      setErrorMessage('Could not hire worker.')
    } finally {
      setHireLoadingId(null)
    }
  }

  if (loading) {
    return <div className="p-6">Loading job...</div>
  }

  if (!job) {
    return <div className="p-6">Job not found.</div>
  }

  const isCompanyOwner = userId && job.company_id === userId
  const alreadyHired = !!job.hired_worker_id

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{job.title}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {job.trade} • {job.location}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              job.status === 'open'
                ? 'bg-green-100 text-green-700'
                : job.status === 'assigned'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {job.status}
          </span>
        </div>

        {job.description && (
          <p className="mb-4 whitespace-pre-wrap text-gray-700">{job.description}</p>
        )}

        <div className="grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
          <div>
            <span className="font-semibold text-gray-900">Pay:</span>{' '}
            {job.pay_rate || 'Not listed'}
          </div>
          <div>
            <span className="font-semibold text-gray-900">Start Date:</span>{' '}
            {job.start_date || 'Not listed'}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {isCompanyOwner ? (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Applicants</h2>
            <span className="text-sm text-gray-500">
              {applicants.length} applicant{applicants.length === 1 ? '' : 's'}
            </span>
          </div>

          {applicants.length === 0 ? (
            <p className="text-gray-500">No applicants yet.</p>
          ) : (
            <div className="space-y-4">
              {applicants.map((applicant) => {
                const fullName =
                  applicant.profiles?.full_name?.trim() || 'Worker'
                const location = [applicant.profiles?.city, applicant.profiles?.state]
                  .filter(Boolean)
                  .join(', ')

                const isHired = applicant.status === 'hired'
                const isRejected = applicant.status === 'rejected'
                const disableHire = alreadyHired || hireLoadingId !== null

                return (
                  <div
                    key={applicant.id}
                    className="rounded-2xl border border-gray-200 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {fullName}
                        </h3>

                        {location && (
                          <p className="text-sm text-gray-500">{location}</p>
                        )}

                        {applicant.profiles?.phone && (
                          <p className="text-sm text-gray-500">
                            {applicant.profiles.phone}
                          </p>
                        )}

                        <p className="mt-2 text-sm">
                          <span className="font-medium text-gray-900">Status:</span>{' '}
                          <span
                            className={
                              isHired
                                ? 'font-semibold text-green-700'
                                : isRejected
                                ? 'font-semibold text-red-600'
                                : 'text-gray-600'
                            }
                          >
                            {applicant.status}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/messages?worker=${applicant.worker_id}&job=${job.id}`}
                          className="rounded-xl border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Message
                        </Link>

                        {isHired ? (
                          <button
                            disabled
                            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white opacity-90"
                          >
                            Hired
                          </button>
                        ) : (
                          <button
                            onClick={() => handleHireWorker(applicant)}
                            disabled={disableHire}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {hireLoadingId === applicant.id ? 'Hiring...' : 'Hire Worker'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-xl font-bold">Job Status</h2>
          <p className="text-gray-600">
            This job is currently <span className="font-semibold">{job.status}</span>.
          </p>
        </section>
      )}
    </main>
  )
}