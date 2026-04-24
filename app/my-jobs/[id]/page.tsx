'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Job = {
  id: string
  title: string
  description: string | null
  trade: string
  location: string
  pay_rate: string | null
  status: string
  company_id: string
}

type Application = {
  id: string
  worker_id: string
  status: string
  created_at: string
}

type Profile = {
  id: string
  full_name: string | null
  phone: string | null
  city: string | null
  state: string | null
  company_name: string | null
}

type Applicant = Application & {
  profile: Profile | null
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [applications, setApplications] = useState<Applicant[]>([])
  const [loading, setLoading] = useState(true)
  const [startingMessageFor, setStartingMessageFor] = useState<string | null>(null)
  const [updatingApplicationId, setUpdatingApplicationId] = useState<string | null>(null)

  useEffect(() => {
    if (jobId) {
      fetchJobAndApplicants()
    }
  }, [jobId])

  const fetchJobAndApplicants = async () => {
    setLoading(true)

    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError) {
      console.error('Error loading job:', jobError.message)
      setLoading(false)
      return
    }

    setJob(jobData)

    const { data: appData, error: appError } = await supabase
      .from('applications')
      .select('id, worker_id, status, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (appError) {
      console.error('Error loading applications:', appError.message)
      setApplications([])
      setLoading(false)
      return
    }

    const apps = appData || []

    if (apps.length === 0) {
      setApplications([])
      setLoading(false)
      return
    }

    const workerIds = apps.map((app) => app.worker_id)

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, phone, city, state, company_name')
      .in('id', workerIds)

    if (profileError) {
      console.error('Error loading profiles:', profileError.message)
    }

    const profiles = profileData || []

    const mergedApplicants: Applicant[] = apps.map((app) => ({
      ...app,
      profile: profiles.find((profile) => profile.id === app.worker_id) || null,
    }))

    setApplications(mergedApplicants)
    setLoading(false)
  }

  const messageWorker = async (workerId: string) => {
    if (!job) return

    setStartingMessageFor(workerId)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      alert('You must be logged in')
      setStartingMessageFor(null)
      return
    }

    const { data: existingConversation, error: existingError } = await supabase
      .from('conversations')
      .select('id')
      .eq('job_id', job.id)
      .eq('company_id', user.id)
      .eq('worker_id', workerId)
      .maybeSingle()

    if (existingError) {
      console.error(existingError.message)
    }

    if (existingConversation) {
      setStartingMessageFor(null)
      router.push(`/messages/${existingConversation.id}`)
      return
    }

    const { data: newConversation, error: createError } = await supabase
      .from('conversations')
      .insert([
        {
          job_id: job.id,
          company_id: user.id,
          worker_id: workerId,
        },
      ])
      .select('id')
      .single()

    setStartingMessageFor(null)

    if (createError) {
      alert(createError.message)
      return
    }

    router.push(`/messages/${newConversation.id}`)
  }

  const updateApplicationStatus = async (
    applicationId: string,
    newStatus: 'hired' | 'rejected'
  ) => {
    if (!job) return

    setUpdatingApplicationId(applicationId)

    const { error } = await supabase
      .from('applications')
      .update({ status: newStatus })
      .eq('id', applicationId)

    if (error) {
      alert(error.message)
      setUpdatingApplicationId(null)
      return
    }

    if (newStatus === 'hired') {
      const { error: jobError } = await supabase
        .from('jobs')
        .update({ status: 'assigned' })
        .eq('id', job.id)

      if (jobError) {
        console.error('Error updating job status:', jobError.message)
      } else {
        setJob((prev) => (prev ? { ...prev, status: 'assigned' } : prev))
      }
    }

    setApplications((prev) =>
      prev.map((app) =>
        app.id === applicationId ? { ...app, status: newStatus } : app
      )
    )

    setUpdatingApplicationId(null)
  }

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading...</div>
  }

  if (!job) {
    return <div style={{ padding: '24px' }}>Job not found</div>
  }

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>{job.title}</h1>

      <p><strong>Trade:</strong> {job.trade}</p>
      <p><strong>Location:</strong> {job.location}</p>
      <p><strong>Pay:</strong> {job.pay_rate || 'Not listed'}</p>
      <p><strong>Status:</strong> {job.status}</p>

      <p style={{ marginTop: '16px' }}>
        {job.description || 'No description'}
      </p>

      <hr style={{ margin: '24px 0' }} />

      <h2>Applicants ({applications.length})</h2>

      {applications.length === 0 ? (
        <p>No one has applied yet.</p>
      ) : (
        <div style={{ marginTop: '16px' }}>
          {applications.map((app) => (
            <div key={app.id} style={cardStyle}>
              <h3 style={{ margin: '0 0 10px 0' }}>
                {app.profile?.full_name || 'No name'}
              </h3>

              <p style={metaStyle}>
                <strong>Phone:</strong> {app.profile?.phone || 'Not provided'}
              </p>

              <p style={metaStyle}>
                <strong>Location:</strong>{' '}
                {app.profile?.city || app.profile?.state
                  ? [app.profile?.city, app.profile?.state].filter(Boolean).join(', ')
                  : 'Not provided'}
              </p>

              <p style={metaStyle}>
                <strong>Company:</strong> {app.profile?.company_name || 'Not provided'}
              </p>

              <p style={metaStyle}>
                <strong>Status:</strong> {app.status}
              </p>

              <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                Applied: {new Date(app.created_at).toLocaleString()}
              </p>

              <div style={actionsRowStyle}>
                <button
                  onClick={() => messageWorker(app.worker_id)}
                  style={messageButtonStyle}
                  disabled={startingMessageFor === app.worker_id}
                >
                  {startingMessageFor === app.worker_id ? 'Opening...' : 'Message Worker'}
                </button>

                <button
                  onClick={() => updateApplicationStatus(app.id, 'hired')}
                  style={hireButtonStyle}
                  disabled={updatingApplicationId === app.id || app.status === 'hired'}
                >
                  {updatingApplicationId === app.id ? 'Updating...' : 'Hire'}
                </button>

                <button
                  onClick={() => updateApplicationStatus(app.id, 'rejected')}
                  style={rejectButtonStyle}
                  disabled={updatingApplicationId === app.id || app.status === 'rejected'}
                >
                  {updatingApplicationId === app.id ? 'Updating...' : 'Reject'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: '10px',
  padding: '16px',
  marginBottom: '10px',
  backgroundColor: '#fff',
}

const metaStyle: React.CSSProperties = {
  margin: '4px 0',
}

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginTop: '14px',
}

const messageButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '8px',
  border: 'none',
  cursor: 'pointer',
}

const hireButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '8px',
  border: 'none',
  cursor: 'pointer',
  backgroundColor: '#dff5e1',
}

const rejectButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '8px',
  border: 'none',
  cursor: 'pointer',
  backgroundColor: '#f8d7da',
}