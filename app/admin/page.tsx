'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  company_name: string | null
  company_verified: boolean | null
  insurance_verified: boolean | null
  liability_form_verified: boolean | null
  created_at: string | null
}

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  status: string | null
  payment_status: string | null
  payout_status: string | null
  pay_rate: string | null
  company_id: string | null
  assigned_worker_id: string | null
  created_at: string | null
}

type Application = {
  id: string
  status: string | null
  job_id: string | null
  worker_id: string | null
  requested_pay_rate: string | null
  created_at: string | null
}

type Invite = {
  id: string
  status: string | null
  job_id: string | null
  worker_id: string | null
  company_id: string | null
  created_at: string | null
}

export default function AdminPage() {
  const db = supabase as any

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [invites, setInvites] = useState<Invite[]>([])

  useEffect(() => {
    loadAdminData()
  }, [])

  async function loadAdminData() {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be logged in.')
      setLoading(false)
      return
    }

    const { data: myProfile } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (myProfile?.role !== 'admin') {
      setMessage('Admin access only.')
      setLoading(false)
      return
    }

    const [profilesRes, jobsRes, applicationsRes, invitesRes] =
      await Promise.all([
        db
          .from('profiles')
          .select(
            'id, full_name, email, role, company_name, company_verified, insurance_verified, liability_form_verified, created_at'
          )
          .order('created_at', { ascending: false }),

        db
          .from('jobs')
          .select(
            'id, title, trade, location, status, payment_status, payout_status, pay_rate, company_id, assigned_worker_id, created_at'
          )
          .order('created_at', { ascending: false }),

        db
          .from('applications')
          .select(
            'id, status, job_id, worker_id, requested_pay_rate, created_at'
          )
          .order('created_at', { ascending: false }),

        db
          .from('job_invites')
          .select(
            'id, status, job_id, worker_id, company_id, created_at'
          )
          .order('created_at', { ascending: false }),
      ])

    if (profilesRes.error) setMessage(profilesRes.error.message)
    if (jobsRes.error) setMessage(jobsRes.error.message)
    if (applicationsRes.error) setMessage(applicationsRes.error.message)
    if (invitesRes.error) setMessage(invitesRes.error.message)

    setProfiles(profilesRes.data || [])
    setJobs(jobsRes.data || [])
    setApplications(applicationsRes.data || [])
    setInvites(invitesRes.data || [])
    setLoading(false)
  }

  const stats = useMemo(() => {
    return {
      users: profiles.length,
      workers: profiles.filter((p) => p.role === 'worker').length,
      companies: profiles.filter((p) => p.role === 'company').length,
      openJobs: jobs.filter((j) => j.status === 'open').length,
      assignedJobs: jobs.filter((j) => j.status === 'assigned').length,
      completedJobs: jobs.filter((j) => j.status === 'completed').length,
      paidJobs: jobs.filter((j) => j.payment_status === 'paid').length,
      unpaidJobs: jobs.filter((j) => j.payment_status !== 'paid').length,
      pendingApplications: applications.filter((a) => a.status === 'pending')
        .length,
      pendingInvites: invites.filter((i) => i.status === 'pending').length,
      verifiedCompanies: profiles.filter((p) => p.company_verified).length,
      verifiedInsurance: profiles.filter((p) => p.insurance_verified).length,
    }
  }, [profiles, jobs, applications, invites])

  async function toggleProfileFlag(
    profileId: string,
    field:
      | 'company_verified'
      | 'insurance_verified'
      | 'liability_form_verified',
    currentValue: boolean | null
  ) {
    const { error } = await db
      .from('profiles')
      .update({ [field]: !currentValue })
      .eq('id', profileId)

    if (error) {
      setMessage(error.message)
      return
    }

    await loadAdminData()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-slate-300">Loading admin dashboard...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                CrewCall Admin
              </p>
              <h1 className="mt-2 text-3xl font-black md:text-5xl">
                Control Center
              </h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                Monitor users, jobs, payments, payouts, applications, invites,
                and verification status.
              </p>
            </div>

            <button
              onClick={loadAdminData}
              className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
            >
              Refresh
            </button>
          </div>

          {message && (
            <div className="mt-5 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-100">
              {message}
            </div>
          )}
        </div>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total Users" value={stats.users} />
          <Stat label="Workers" value={stats.workers} />
          <Stat label="Companies" value={stats.companies} />
          <Stat label="Open Jobs" value={stats.openJobs} />
          <Stat label="Assigned Jobs" value={stats.assignedJobs} />
          <Stat label="Completed Jobs" value={stats.completedJobs} />
          <Stat label="Paid Jobs" value={stats.paidJobs} />
          <Stat label="Unpaid Jobs" value={stats.unpaidJobs} />
          <Stat label="Pending Applications" value={stats.pendingApplications} />
          <Stat label="Pending Invites" value={stats.pendingInvites} />
          <Stat label="Verified Companies" value={stats.verifiedCompanies} />
          <Stat label="Insurance Verified" value={stats.verifiedInsurance} />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-xl font-black">Recent Jobs</h2>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3">Job</th>
                  <th>Trade</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Payout</th>
                  <th>Pay</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {jobs.slice(0, 20).map((job) => (
                  <tr key={job.id} className="border-t border-white/10">
                    <td className="py-3 font-bold">{job.title || 'Untitled'}</td>
                    <td>{job.trade || '-'}</td>
                    <td>{job.location || '-'}</td>
                    <td>{job.status || '-'}</td>
                    <td>{job.payment_status || '-'}</td>
                    <td>{job.payout_status || '-'}</td>
                    <td>{job.pay_rate || '-'}</td>
                    <td>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="font-bold text-cyan-300 hover:text-cyan-200"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-xl font-black">Users / Verification</h2>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3">Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Company</th>
                  <th>Company Verified</th>
                  <th>Insurance Verified</th>
                  <th>Liability Verified</th>
                  <th>Profile</th>
                </tr>
              </thead>
              <tbody>
                {profiles.slice(0, 40).map((profile) => (
                  <tr key={profile.id} className="border-t border-white/10">
                    <td className="py-3 font-bold">
                      {profile.full_name || 'Unnamed'}
                    </td>
                    <td>{profile.email || '-'}</td>
                    <td>{profile.role || '-'}</td>
                    <td>{profile.company_name || '-'}</td>
                    <td>
                      <VerifyButton
                        active={profile.company_verified}
                        onClick={() =>
                          toggleProfileFlag(
                            profile.id,
                            'company_verified',
                            profile.company_verified
                          )
                        }
                      />
                    </td>
                    <td>
                      <VerifyButton
                        active={profile.insurance_verified}
                        onClick={() =>
                          toggleProfileFlag(
                            profile.id,
                            'insurance_verified',
                            profile.insurance_verified
                          )
                        }
                      />
                    </td>
                    <td>
                      <VerifyButton
                        active={profile.liability_form_verified}
                        onClick={() =>
                          toggleProfileFlag(
                            profile.id,
                            'liability_form_verified',
                            profile.liability_form_verified
                          )
                        }
                      />
                    </td>
                    <td>
                      <Link
                        href={`/profile/${profile.id}`}
                        className="font-bold text-cyan-300 hover:text-cyan-200"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-xl font-black">Recent Applications</h2>

            <div className="mt-4 space-y-3">
              {applications.slice(0, 12).map((app) => (
                <div
                  key={app.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">Application</p>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
                      {app.status || 'unknown'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    Requested Pay: {app.requested_pay_rate || '-'}
                  </p>
                  {app.job_id && (
                    <Link
                      href={`/jobs/${app.job_id}`}
                      className="mt-3 inline-block text-sm font-bold text-cyan-300"
                    >
                      Open Job
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-xl font-black">Recent Invites</h2>

            <div className="mt-4 space-y-3">
              {invites.slice(0, 12).map((invite) => (
                <div
                  key={invite.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">Invite</p>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
                      {invite.status || 'unknown'}
                    </span>
                  </div>
                  {invite.job_id && (
                    <Link
                      href={`/jobs/${invite.job_id}`}
                      className="mt-3 inline-block text-sm font-bold text-cyan-300"
                    >
                      Open Job
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-4xl font-black text-white">{value}</p>
    </div>
  )
}

function VerifyButton({
  active,
  onClick,
}: {
  active: boolean | null
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-green-400 px-3 py-1 text-xs font-black text-slate-950'
          : 'rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white hover:bg-white/20'
      }
    >
      {active ? 'Verified' : 'Verify'}
    </button>
  )
}