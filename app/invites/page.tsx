'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CrewCard } from '@/app/components/CrewCard'
import { CrewButton } from '@/app/components/CrewButton'

type Profile = {
  id: string
  role: 'company' | 'worker' | null
}

type Invite = {
  id: string
  status: string
  job_id: string
  worker_id: string
  company_id: string
  created_at: string
  jobs: {
    id: string
    title: string | null
    trade: string | null
    location: string | null
    pay_rate: string | null
    status: string | null
  } | null
  company: {
    full_name: string | null
    company_name: string | null
  } | null
  worker: {
    full_name: string | null
  } | null
}

export default function InvitesPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadInvites()
  }, [])

  async function loadInvites() {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('You must be logged in to view invites.')
      setLoading(false)
      return
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    const currentProfile = profileData as Profile | null
    setProfile(currentProfile)

    if (!currentProfile?.role) {
      setMessage('Profile role missing.')
      setLoading(false)
      return
    }

    const filterColumn =
      currentProfile.role === 'company' ? 'company_id' : 'worker_id'

    const { data, error } = await supabase
      .from('job_invites')
      .select(`
        id,
        status,
        job_id,
        worker_id,
        company_id,
        created_at,
        jobs:job_id (
          id,
          title,
          trade,
          location,
          pay_rate,
          status
        ),
        company:profiles!job_invites_company_id_fkey (
          full_name,
          company_name
        ),
        worker:profiles!job_invites_worker_id_fkey (
          full_name
        )
      `)
      .eq(filterColumn, user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    const cleaned = (data || []).map((invite: any) => ({
      ...invite,
      jobs: Array.isArray(invite.jobs) ? invite.jobs[0] : invite.jobs,
      company: Array.isArray(invite.company)
        ? invite.company[0]
        : invite.company,
      worker: Array.isArray(invite.worker) ? invite.worker[0] : invite.worker,
    }))

    setInvites(cleaned)
    setLoading(false)
  }

  async function acceptInvite(invite: Invite) {
    setMessage('')

    const { error: inviteError } = await supabase
      .from('job_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id)

    if (inviteError) {
      setMessage(inviteError.message)
      return
    }

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        status: 'assigned',
        assigned_worker_id: invite.worker_id,
      })
      .eq('id', invite.job_id)

    if (jobError) {
      setMessage(jobError.message)
      return
    }

    await supabase
      .from('job_invites')
      .update({ status: 'declined' })
      .eq('job_id', invite.job_id)
      .neq('id', invite.id)

    loadInvites()
  }

  async function declineInvite(inviteId: string) {
    setMessage('')

    const { error } = await supabase
      .from('job_invites')
      .update({ status: 'declined' })
      .eq('id', inviteId)

    if (error) {
      setMessage(error.message)
      return
    }

    loadInvites()
  }

  function statusBadge(status: string) {
    const styles =
      status === 'accepted'
        ? 'bg-green-100 text-green-700'
        : status === 'declined'
        ? 'bg-red-100 text-red-700'
        : 'bg-yellow-100 text-yellow-800'

    return (
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>
        {status}
      </span>
    )
  }

  function otherParty(invite: Invite) {
    if (profile?.role === 'worker') {
      return (
        invite.company?.company_name ||
        invite.company?.full_name ||
        'Company'
      )
    }

    return invite.worker?.full_name || 'Worker'
  }

  function messageHref(invite: Invite) {
    if (profile?.role === 'worker') {
      return `/messages?user=${invite.company_id}&job=${invite.job_id}`
    }

    return `/messages?user=${invite.worker_id}&job=${invite.job_id}`
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invites</h1>
          <p className="mt-2 text-gray-600">
            {profile?.role === 'worker'
              ? 'Review job invites from companies.'
              : 'Track invites you sent to workers.'}
          </p>
        </div>

        {message && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        {loading ? (
          <CrewCard>
            <p className="text-gray-600">Loading invites...</p>
          </CrewCard>
        ) : invites.length === 0 ? (
          <CrewCard>
            <p className="text-gray-600">No invites yet.</p>
          </CrewCard>
        ) : (
          <div className="space-y-4">
            {invites.map((invite) => (
              <CrewCard key={invite.id} className="space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="mb-2">{statusBadge(invite.status)}</div>

                    <h2 className="text-xl font-bold text-gray-900">
                      {invite.jobs?.title || 'Untitled Job'}
                    </h2>

                    <p className="mt-1 text-sm text-gray-600">
                      {profile?.role === 'worker' ? 'From' : 'To'}:{' '}
                      <b>{otherParty(invite)}</b>
                    </p>

                    <p className="mt-2 text-sm text-gray-600">
                      {invite.jobs?.trade || 'Trade not listed'} •{' '}
                      {invite.jobs?.location || 'Location not listed'}
                    </p>

                    <p className="mt-1 text-sm text-gray-600">
                      Pay: {invite.jobs?.pay_rate || 'Not listed'}
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      Sent {new Date(invite.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <CrewButton href={`/jobs/${invite.job_id}`} variant="ghost">
                      View Job
                    </CrewButton>

                    {profile?.role === 'worker' ? (
                      <CrewButton
                        href={`/profile/${invite.company_id}`}
                        variant="ghost"
                      >
                        View Company
                      </CrewButton>
                    ) : (
                      <CrewButton
                        href={`/profile/${invite.worker_id}`}
                        variant="ghost"
                      >
                        View Worker
                      </CrewButton>
                    )}

                    <CrewButton href={messageHref(invite)} variant="ghost">
                      Message
                    </CrewButton>

                    {profile?.role === 'worker' &&
                      invite.status === 'pending' && (
                        <>
                          <CrewButton onClick={() => acceptInvite(invite)}>
                            Accept
                          </CrewButton>

                          <CrewButton
                            variant="danger"
                            onClick={() => declineInvite(invite.id)}
                          >
                            Decline
                          </CrewButton>
                        </>
                      )}
                  </div>
                </div>
              </CrewCard>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}