'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string
  trade: string
  location: string
  pay_rate: string | null
  status: string
  payment_status: string | null
  assigned_worker_id: string | null
}

type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
}

type Applicant = {
  id: string
  worker_id: string
  status: string
  profile: Profile | null
}

export default function JobDetailPage() {
  const params = useParams()
  const jobId = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [assignedWorker, setAssignedWorker] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    // JOB
    const { data: jobData } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    setJob(jobData)

    // APPS
    const { data: apps } = await supabase
      .from('applications')
      .select('*')
      .eq('job_id', jobId)

    const workerIds = apps?.map((a) => a.worker_id) || []

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, company_name')
      .in('id', workerIds)

    const merged =
      apps?.map((a) => ({
        ...a,
        profile: profiles?.find((p) => p.id === a.worker_id) || null,
      })) || []

    setApplicants(merged)

    // ASSIGNED WORKER
    if (jobData?.assigned_worker_id) {
      const { data: worker } = await supabase
        .from('profiles')
        .select('id, full_name, company_name')
        .eq('id', jobData.assigned_worker_id)
        .single()

      setAssignedWorker(worker)
    }

    setLoading(false)
  }

  async function hire(app: Applicant) {
    if (!job) return

    // update job
    await supabase
      .from('jobs')
      .update({
        status: 'assigned',
        assigned_worker_id: app.worker_id,
      })
      .eq('id', job.id)

    // update application
    await supabase
      .from('applications')
      .update({ status: 'hired' })
      .eq('id', app.id)

    load()
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (!job) return <div className="p-6">Job not found</div>

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold">{job.title}</h1>
        <p className="text-gray-600">
          {job.trade} · {job.location}
        </p>
      </div>

      {/* ASSIGNED WORKER */}
      {assignedWorker && (
        <div className="bg-white border rounded-2xl p-5">
          <h2 className="text-lg font-bold mb-3">Assigned Worker</h2>

          <p className="font-semibold">
            {assignedWorker.company_name || assignedWorker.full_name}
          </p>

          <div className="flex gap-2 mt-3 flex-wrap">

            <Link href={`/messages?start=${assignedWorker.id}`} className="btn-primary">
              Message
            </Link>

            <Link href={`/profile/${assignedWorker.id}`} className="btn">
              View Profile
            </Link>

            {job.payment_status !== 'paid' && (
              <Link
                href={`/jobs/${job.id}/pay`}
                className="btn-secondary"
              >
                Pay Worker
              </Link>
            )}

            {job.status === 'completed' && (
              <Link
                href={`/reviews/new?jobId=${job.id}&revieweeId=${assignedWorker.id}`}
                className="btn-warning"
              >
                Leave Review
              </Link>
            )}
          </div>
        </div>
      )}

      {/* APPLICANTS */}
      {!assignedWorker && (
        <div>
          <h2 className="text-xl font-bold mb-4">
            Applicants ({applicants.length})
          </h2>

          {applicants.length === 0 ? (
            <p>No applicants yet.</p>
          ) : (
            <div className="space-y-3">
              {applicants.map((app) => (
                <div
                  key={app.id}
                  className="bg-white border rounded-2xl p-4"
                >
                  <p className="font-semibold">
                    {app.profile?.company_name ||
                      app.profile?.full_name ||
                      'Worker'}
                  </p>

                  <div className="flex gap-2 mt-3 flex-wrap">

                    <button
                      onClick={() => hire(app)}
                      className="btn-secondary"
                    >
                      Hire
                    </button>

                    <Link
                      href={`/messages?start=${app.worker_id}`}
                      className="btn-primary"
                    >
                      Message
                    </Link>

                    <Link
                      href={`/profile/${app.worker_id}`}
                      className="btn"
                    >
                      Profile
                    </Link>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}