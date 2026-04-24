'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ApplicationRow = {
  id: string
  status: string
  created_at: string
  worker_id: string
  company_id: string
  job_id: string
  jobs: {
    id: string
    title: string
    trade: string
    location: string
    pay_rate: string | null
  } | null
  worker: {
    id: string
    full_name: string | null
    city: string | null
    state: string | null
  } | null
}

type Profile = {
  id: string
  role: 'worker' | 'company'
  full_name: string | null
  company_name: string | null
}

const STATUS_OPTIONS = ['all', 'pending', 'accepted', 'rejected']

export default function CompanyApplicationsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    loadPage()
  }, [])

  async function loadPage() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, role, full_name, company_name')
      .eq('id', user.id)
      .single()

    if (profileData) {
      setProfile(profileData as Profile)
    }

    const { data, error } = await supabase
      .from('applications')
      .select(
        `
        id,
        status,
        created_at,
        worker_id,
        company_id,
        job_id,
        jobs:job_id (
          id,
          title,
          trade,
          location,
          pay_rate
        ),
        worker:worker_id (
          id,
          full_name,
          city,
          state
        )
      `
      )
      .eq('company_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading applications:', error)
      setApplications([])
    } else {
      setApplications((data as ApplicationRow[]) ?? [])
    }

    setLoading(false)
  }

  async function updateStatus(applicationId: string, nextStatus: 'accepted' | 'rejected') {
    setUpdatingId(applicationId)

    const { error } = await supabase
      .from('applications')
      .update({ status: nextStatus })
      .eq('id', applicationId)

    if (error) {
      console.error('Error updating application:', error)
      setUpdatingId(null)
      return
    }

    setApplications((current) =>
      current.map((application) =>
        application.id === applicationId
          ? { ...application, status: nextStatus }
          : application
      )
    )

    setUpdatingId(null)
  }

  async function openMessage(application: ApplicationRow) {
    if (!profile || !application.worker_id || !application.company_id) return

    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('worker_id', application.worker_id)
      .eq('company_id', application.company_id)
      .maybeSingle()

    if (existingConversation?.id) {
      window.location.href = `/messages?conversation=${existingConversation.id}`
      return
    }

    const { data: newConversation, error } = await supabase
      .from('conversations')
      .insert({
        worker_id: application.worker_id,
        company_id: application.company_id,
        job_id: application.job_id,
      })
      .select('id')
      .single()

    if (error || !newConversation) {
      console.error('Error creating conversation:', error)
      return
    }

    window.location.href = `/messages?conversation=${newConversation.id}`
  }

  const filteredApplications = useMemo(() => {
    return applications.filter((application) => {
      const matchesStatus =
        statusFilter === 'all' || application.status === statusFilter

      const haystack = [
        application.jobs?.title ?? '',
        application.jobs?.trade ?? '',
        application.jobs?.location ?? '',
        application.worker?.full_name ?? '',
        application.worker?.city ?? '',
        application.worker?.state ?? '',
      ]
        .join(' ')
        .toLowerCase()

      const matchesSearch =
        search.trim() === '' || haystack.includes(search.toLowerCase())

      return matchesStatus && matchesSearch
    })
  }, [applications, search, statusFilter])

  const pendingCount = applications.filter((a) => a.status === 'pending').length
  const acceptedCount = applications.filter((a) => a.status === 'accepted').length
  const rejectedCount = applications.filter((a) => a.status === 'rejected').length

  if (loading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          backgroundColor: '#f4f7fb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <p style={{ fontSize: '18px', color: '#374151' }}>Loading applicants...</p>
      </main>
    )
  }

  if (!profile) {
    return (
      <main
        style={{
          minHeight: '100vh',
          backgroundColor: '#f4f7fb',
          padding: '32px 20px',
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            padding: '28px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb',
          }}
        >
          <h1
            style={{
              marginTop: 0,
              marginBottom: '12px',
              fontSize: '30px',
              color: '#111827',
            }}
          >
            Login Required
          </h1>

          <p
            style={{
              marginTop: 0,
              marginBottom: '18px',
              color: '#6b7280',
              lineHeight: 1.6,
            }}
          >
            You need to be signed in as a company to review applicants.
          </p>

          <Link href="/login" style={primaryLinkStyle}>
            Login
          </Link>
        </div>
      </main>
    )
  }

  if (profile.role !== 'company') {
    return (
      <main
        style={{
          minHeight: '100vh',
          backgroundColor: '#f4f7fb',
          padding: '32px 20px',
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            padding: '28px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb',
          }}
        >
          <h1
            style={{
              marginTop: 0,
              marginBottom: '12px',
              fontSize: '30px',
              color: '#111827',
            }}
          >
            Company Access Only
          </h1>

          <p
            style={{
              marginTop: 0,
              marginBottom: '18px',
              color: '#6b7280',
              lineHeight: 1.6,
            }}
          >
            This page is only for company accounts reviewing job applicants.
          </p>

          <Link href="/" style={primaryLinkStyle}>
            Back Home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#f4f7fb',
        padding: '32px 20px 48px',
      }}
    >
      <div
        style={{
          maxWidth: 1150,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
            color: '#ffffff',
            borderRadius: '24px',
            padding: '32px',
            marginBottom: '22px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
          }}
        >
          <p
            style={{
              margin: 0,
              marginBottom: '10px',
              color: '#93c5fd',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontSize: '13px',
            }}
          >
            Hiring Dashboard
          </p>

          <h1
            style={{
              margin: 0,
              marginBottom: '12px',
              fontSize: '40px',
              lineHeight: 1.1,
            }}
          >
            Review Applicants
          </h1>

          <p
            style={{
              margin: 0,
              maxWidth: 760,
              color: '#d1d5db',
              fontSize: '18px',
              lineHeight: 1.6,
            }}
          >
            Sort through applicants, update statuses, and message workers without
            bouncing around the app.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              marginTop: '22px',
            }}
          >
            <Link href="/" style={lightLinkStyle}>
              Back Home
            </Link>
            <Link href="/post-job" style={blueLinkStyle}>
              Post a Job
            </Link>
            <Link href="/messages" style={outlineLightLinkStyle}>
              Open Messages
            </Link>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '22px',
          }}
        >
          <StatCard label="Total Applicants" value={applications.length} />
          <StatCard label="Pending" value={pendingCount} />
          <StatCard label="Accepted" value={acceptedCount} />
          <StatCard label="Rejected" value={rejectedCount} />
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            padding: '20px',
            marginBottom: '22px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb',
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: '16px',
              fontSize: '22px',
              color: '#111827',
            }}
          >
            Filter Applicants
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
            }}
          >
            <div>
              <label style={labelStyle}>Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Worker, job title, trade, location..."
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={inputStyle}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status === 'all'
                      ? 'All Statuses'
                      : status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredApplications.length === 0 ? (
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '18px',
              padding: '28px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              border: '1px solid #e5e7eb',
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: '10px',
                fontSize: '24px',
                color: '#111827',
              }}
            >
              No applicants found
            </h3>

            <p
              style={{
                margin: 0,
                color: '#6b7280',
                lineHeight: 1.6,
              }}
            >
              Try adjusting your filters, or post more jobs to start getting
              applicants.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: '16px',
            }}
          >
            {filteredApplications.map((application) => {
              const workerName = application.worker?.full_name || 'Unnamed Worker'
              const location = [application.worker?.city, application.worker?.state]
                .filter(Boolean)
                .join(', ')

              return (
                <div
                  key={application.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '18px',
                    padding: '22px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '16px',
                      flexWrap: 'wrap',
                      marginBottom: '14px',
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          marginBottom: '8px',
                          fontSize: '26px',
                          color: '#111827',
                        }}
                      >
                        {workerName}
                      </h3>

                      <div
                        style={{
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <Badge text={application.jobs?.title || 'Untitled Job'} />
                        {application.jobs?.trade && <Badge text={application.jobs.trade} />}
                        {application.jobs?.location && (
                          <Badge text={application.jobs.location} />
                        )}
                        {location && <Badge text={location} subtle />}
                      </div>
                    </div>

                    <StatusBadge status={application.status} />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '14px',
                      marginBottom: '18px',
                    }}
                  >
                    <InfoBox
                      label="Applied"
                      value={new Date(application.created_at).toLocaleDateString()}
                    />
                    <InfoBox
                      label="Pay"
                      value={application.jobs?.pay_rate || 'Not listed'}
                    />
                    <InfoBox
                      label="Worker Location"
                      value={location || 'Not listed'}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      onClick={() => openMessage(application)}
                      style={primaryButtonStyle}
                    >
                      Message Worker
                    </button>

                    <button
                      onClick={() => updateStatus(application.id, 'accepted')}
                      disabled={updatingId === application.id}
                      style={{
                        ...successButtonStyle,
                        opacity: updatingId === application.id ? 0.7 : 1,
                        cursor: updatingId === application.id ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {updatingId === application.id ? 'Saving...' : 'Accept'}
                    </button>

                    <button
                      onClick={() => updateStatus(application.id, 'rejected')}
                      disabled={updatingId === application.id}
                      style={{
                        ...dangerButtonStyle,
                        opacity: updatingId === application.id ? 0.7 : 1,
                        cursor: updatingId === application.id ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {updatingId === application.id ? 'Saving...' : 'Reject'}
                    </button>

                    {application.jobs?.id && (
                      <Link href={`/jobs/${application.jobs.id}`} style={secondaryLinkStyle}>
                        View Job
                      </Link>
                    )}
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '18px',
        padding: '20px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb',
      }}
    >
      <p
        style={{
          marginTop: 0,
          marginBottom: '8px',
          color: '#6b7280',
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <h3
        style={{
          margin: 0,
          fontSize: '30px',
          color: '#111827',
        }}
      >
        {value}
      </h3>
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '14px',
        padding: '14px',
      }}
    >
      <p
        style={{
          marginTop: 0,
          marginBottom: '6px',
          fontSize: '13px',
          color: '#6b7280',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          color: '#111827',
          fontWeight: 700,
          lineHeight: 1.5,
        }}
      >
        {value}
      </p>
    </div>
  )
}

function Badge({
  text,
  subtle = false,
}: {
  text: string
  subtle?: boolean
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: subtle ? '#f3f4f6' : '#eff6ff',
        color: subtle ? '#374151' : '#1d4ed8',
        padding: '7px 10px',
        borderRadius: '999px',
        fontSize: '13px',
        fontWeight: 700,
      }}
    >
      {text}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    pending: {
      backgroundColor: '#fef3c7',
      color: '#92400e',
    },
    accepted: {
      backgroundColor: '#dcfce7',
      color: '#166534',
    },
    rejected: {
      backgroundColor: '#fee2e2',
      color: '#991b1b',
    },
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '8px 10px',
        borderRadius: '999px',
        fontWeight: 700,
        fontSize: '13px',
        textTransform: 'uppercase',
        ...(styles[status] || {
          backgroundColor: '#e5e7eb',
          color: '#111827',
        }),
      }}
    >
      {status}
    </span>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  fontWeight: 600,
  color: '#374151',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid #d1d5db',
  fontSize: '15px',
  outline: 'none',
  backgroundColor: '#ffffff',
  color: '#111827',
}

const primaryLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  textAlign: 'center',
  backgroundColor: '#111827',
  color: '#ffffff',
  padding: '12px 14px',
  borderRadius: '10px',
  textDecoration: 'none',
  fontWeight: 700,
}

const secondaryLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  textAlign: 'center',
  backgroundColor: '#e5e7eb',
  color: '#111827',
  padding: '12px 14px',
  borderRadius: '10px',
  textDecoration: 'none',
  fontWeight: 700,
}

const lightLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  textAlign: 'center',
  backgroundColor: '#ffffff',
  color: '#111827',
  padding: '11px 16px',
  borderRadius: '10px',
  textDecoration: 'none',
  fontWeight: 700,
}

const blueLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  textAlign: 'center',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  padding: '11px 16px',
  borderRadius: '10px',
  textDecoration: 'none',
  fontWeight: 700,
}

const outlineLightLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  textAlign: 'center',
  backgroundColor: 'transparent',
  color: '#ffffff',
  padding: '11px 16px',
  borderRadius: '10px',
  textDecoration: 'none',
  fontWeight: 700,
  border: '1px solid #4b5563',
}

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: '#111827',
  color: '#ffffff',
  border: 'none',
  borderRadius: '10px',
  padding: '12px 14px',
  fontWeight: 700,
  cursor: 'pointer',
}

const successButtonStyle: React.CSSProperties = {
  backgroundColor: '#16a34a',
  color: '#ffffff',
  border: 'none',
  borderRadius: '10px',
  padding: '12px 14px',
  fontWeight: 700,
}

const dangerButtonStyle: React.CSSProperties = {
  backgroundColor: '#dc2626',
  color: '#ffffff',
  border: 'none',
  borderRadius: '10px',
  padding: '12px 14px',
  fontWeight: 700,
}