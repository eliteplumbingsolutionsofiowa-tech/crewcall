'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type WorkerApplication = {
  id: string
  status: string | null
  created_at: string
  jobs: {
    id: string
    title: string | null
    location: string | null
    pay_rate: string | null
    status: string | null
    assigned_to: string | null
  } | null
}

type CompanyJob = {
  id: string
  title: string | null
  location: string | null
  status: string | null
}

type CompanyApplicant = {
  id: string
  status: string | null
  worker_id: string | null
  job_id: string | null
  created_at: string
  profiles: {
    full_name: string | null
  } | null
}

type Profile = {
  role: string | null
}

function formatPay(payRate: string | null) {
  if (!payRate) return 'Not set'

  const value = String(payRate).trim()

  if (
    value.toLowerCase().includes('/hr') ||
    value.toLowerCase().includes('/hour')
  ) {
    return value.startsWith('$') ? value : `$${value}`
  }

  const cleaned = value.replace(/[^0-9.]/g, '')
  if (!cleaned) return value

  const num = Number(cleaned)
  if (!Number.isFinite(num)) return value

  return `$${num.toFixed(2)}`
}

function formatStatus(status: string | null) {
  if (!status) return 'Pending'
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

function getStatusClasses(status: string | null, hired: boolean) {
  if (hired) return 'bg-green-100 text-green-700 border-green-200'

  const value = String(status || 'pending').toLowerCase()

  if (value === 'accepted') {
    return 'bg-green-100 text-green-700 border-green-200'
  }

  if (value === 'rejected') {
    return 'bg-red-100 text-red-700 border-red-200'
  }

  if (value === 'assigned') {
    return 'bg-green-100 text-green-700 border-green-200'
  }

  if (value === 'completed') {
    return 'bg-blue-100 text-blue-700 border-blue-200'
  }

  return 'bg-yellow-100 text-yellow-700 border-yellow-200'
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return date.toLocaleDateString()
}

export default function ApplicationsPage() {
  const [loading, setLoading] = useState(true)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [workerApps, setWorkerApps] = useState<WorkerApplication[]>([])
  const [companyJobs, setCompanyJobs] = useState<CompanyJob[]>([])
  const [companyApplicants, setCompanyApplicants] = useState<CompanyApplicant[]>([])

  useEffect(() => {
    async function loadPage() {
      setLoading(true)
      setErrorMessage(null)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      const user = session?.user

      if (sessionError) {
        setErrorMessage(sessionError.message)
        setLoading(false)
        return
      }

      if (!user) {
        setNeedsLogin(true)
        setLoading(false)
        return
      }

      setCurrentUserId(user.id)

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        setErrorMessage(profileError.message)
        setLoading(false)
        return
      }

      const resolvedRole = (profileData as Profile | null)?.role || null
      setRole(resolvedRole)

      if (resolvedRole === 'company') {
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('id, title, location, status')
          .eq('company_id', user.id)
          .order('created_at', { ascending: false })

        if (jobsError) {
          setErrorMessage(jobsError.message)
          setLoading(false)
          return
        }

        const jobs = (jobsData || []) as CompanyJob[]
        setCompanyJobs(jobs)

        if (jobs.length > 0) {
          const jobIds = jobs.map((job) => job.id)

          const { data: applicantsData, error: applicantsError } = await supabase
            .from('applications')
            .select(
              `
              id,
              status,
              worker_id,
              job_id,
              created_at,
              profiles:worker_id (
                full_name
              )
            `
            )
            .in('job_id', jobIds)
            .order('created_at', { ascending: false })

          if (applicantsError) {
            setErrorMessage(applicantsError.message)
            setLoading(false)
            return
          }

          const cleanedApplicants = (applicantsData || []).map((app: any) => ({
            ...app,
            profiles: Array.isArray(app.profiles)
              ? app.profiles[0]
              : app.profiles,
          }))

          setCompanyApplicants(cleanedApplicants as CompanyApplicant[])
        } else {
          setCompanyApplicants([])
        }

        setLoading(false)
        return
      }

      const { data: applicationsData, error: applicationsError } = await supabase
        .from('applications')
        .select(
          `
          id,
          status,
          created_at,
          jobs (
            id,
            title,
            location,
            pay_rate,
            status,
            assigned_to
          )
        `
        )
        .eq('worker_id', user.id)
        .order('created_at', { ascending: false })

      if (applicationsError) {
        setErrorMessage(applicationsError.message)
        setLoading(false)
        return
      }

      const cleanedWorkerApps = (applicationsData || []).map((app: any) => ({
        ...app,
        jobs: Array.isArray(app.jobs) ? app.jobs[0] : app.jobs,
      }))

      setWorkerApps(cleanedWorkerApps as unknown as WorkerApplication[])
      setLoading(false)
    }

    loadPage()
  }, [])

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-4xl font-bold">Applications</h1>
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          Loading...
        </div>
      </main>
    )
  }

  if (needsLogin) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-4xl font-bold">Applications</h1>
        <div className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
          You must be logged in to view this page.
        </div>
      </main>
    )
  }

  if (errorMessage) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-4xl font-bold">Applications</h1>
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {errorMessage}
        </div>
      </main>
    )
  }

  if (role === 'company') {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-4xl font-bold">Applicants</h1>

        <div className="mt-8 grid gap-6">
          {companyJobs.length === 0 ? (
            <div className="rounded-3xl border bg-white p-8 shadow-sm">
              <h2 className="text-xl font-semibold">No jobs posted yet</h2>
              <p className="mt-2 text-gray-600">
                Once you post jobs, applicants will show up here.
              </p>
              <div className="mt-5">
                <Link
                  href="/jobs/new"
                  className="rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white"
                >
                  Post Job
                </Link>
              </div>
            </div>
          ) : (
            companyJobs.map((job) => {
              const applicantsForJob = companyApplicants.filter(
                (app) => app.job_id === job.id
              )

              return (
                <div
                  key={job.id}
                  className="rounded-3xl border bg-white p-8 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold">
                        {job.title || 'Untitled Job'}
                      </h2>

                      <div className="mt-3 space-y-2 text-gray-700">
                        <div>
                          <span className="font-semibold text-gray-900">
                            Location:
                          </span>{' '}
                          {job.location || 'Unknown'}
                        </div>

                        <div>
                          <span className="font-semibold text-gray-900">
                            Status:
                          </span>{' '}
                          {formatStatus(job.status)}
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/jobs/${job.id}`}
                      className="rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white"
                    >
                      View Job
                    </Link>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-lg font-semibold">Applicants</h3>

                    {applicantsForJob.length === 0 ? (
                      <div className="mt-3 rounded-2xl border bg-gray-50 p-4 text-gray-600">
                        No applicants yet.
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3">
                        {applicantsForJob.map((app) => (
                          <div
                            key={app.id}
                            className="rounded-2xl border bg-gray-50 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-gray-900">
                                  {app.profiles?.full_name || 'Worker'}
                                </div>
                                <div className="mt-1 text-sm text-gray-500">
                                  Applied: {formatDate(app.created_at)}
                                </div>
                              </div>

                              <div className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-sm font-semibold text-yellow-700">
                                {formatStatus(app.status)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-4xl font-bold">My Applications</h1>

      <div className="mt-8 grid gap-6">
        {workerApps.length === 0 ? (
          <div className="rounded-3xl border bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold">No applications yet</h2>
            <p className="mt-2 text-gray-600">
              Once you apply to a job, it will show up here.
            </p>
            <div className="mt-5">
              <Link
                href="/jobs"
                className="rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white"
              >
                Browse Jobs
              </Link>
            </div>
          </div>
        ) : (
          workerApps.map((app) => {
            const hired =
              !!currentUserId && app.jobs?.assigned_to === currentUserId

            return (
              <div
                key={app.id}
                className="rounded-3xl border bg-white p-8 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {app.jobs?.title || 'Job'}
                    </h2>

                    <div className="mt-3 space-y-2 text-gray-700">
                      <div>
                        <span className="font-semibold text-gray-900">
                          Location:
                        </span>{' '}
                        {app.jobs?.location || 'Unknown'}
                      </div>

                      <div>
                        <span className="font-semibold text-gray-900">
                          Pay:
                        </span>{' '}
{formatPay(app.jobs?.pay_rate ?? null)}                      </div>

                      <div>
                        <span className="font-semibold text-gray-900">
                          Applied:
                        </span>{' '}
                        {formatDate(app.created_at)}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`rounded-full border px-4 py-2 text-sm font-semibold ${getStatusClasses(
                      app.status,
                      hired
                    )}`}
                  >
                    {hired ? 'Hired' : formatStatus(app.status)}
                  </div>
                </div>

                {hired && (
                  <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800">
                    You’ve been hired for this job.
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  {app.jobs?.id && (
                    <Link
                      href={`/jobs/${app.jobs.id}`}
                      className="rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white"
                    >
                      View Job
                    </Link>
                  )}

                  <Link
                    href="/jobs"
                    className="rounded-2xl border px-5 py-3 text-sm font-medium hover:bg-gray-50"
                  >
                    Browse More Jobs
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}