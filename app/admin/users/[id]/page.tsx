'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
  role: string | null
  phone: string | null
  city: string | null
  state: string | null
  trade: string | null
  years_experience: string | null
  insurance_provider: string | null
  job_experience: string | null
  license_number: string | null
  crewcall_score: number | null
  company_verified: boolean | null
  insurance_verified: boolean | null
  liability_form_verified: boolean | null
  background_verified: boolean | null
  drug_tested: boolean | null
  osha10: boolean | null
  osha30: boolean | null
  med_gas: boolean | null
  available_for_work: boolean | null
  currently_working: boolean | null
  is_online: boolean | null
  last_seen: string | null
  created_at: string | null
  is_suspended: boolean | null
  suspended_at: string | null
  suspension_reason: string | null
  suspended_by: string | null
}

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  status: string | null
  payment_status: string | null
  pay_rate: string | null
  created_at: string | null
}

type Review = {
  id: string
  rating: number | null
  comment: string | null
  created_at: string | null
}

type VerificationField =
  | 'company_verified'
  | 'insurance_verified'
  | 'liability_form_verified'
  | 'background_verified'
  | 'drug_tested'

type Tone = 'error' | 'success' | 'warning'

type SuspensionAction = 'suspend' | 'reactivate'

type SuspensionResponse = {
  success?: boolean
  error?: string
  message?: string
  action?: SuspensionAction
  profile?: Profile
}

function formatDate(value: string | null) {
  if (!value) return 'Unknown'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(value: string | null) {
  if (!value) return 'Unknown'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function titleCase(value: string | null) {
  if (!value) return 'Unknown'

  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    )
}

function nameOf(profile: Profile) {
  return (
    profile.company_name ||
    profile.full_name ||
    'CrewCall User'
  )
}

function isActuallyOnline(profile: Profile) {
  if (!profile.is_online || !profile.last_seen) {
    return false
  }

  const lastSeen = new Date(profile.last_seen).getTime()

  if (Number.isNaN(lastSeen)) {
    return false
  }

  return Date.now() - lastSeen < 90_000
}

export default function AdminUserDetailPage() {
  const db = supabase as any
  const params = useParams<{ id: string }>()
  const profileId = params?.id

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] =
    useState<Profile | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [reviews, setReviews] = useState<
    Review[]
  >([])
  const [working, setWorking] = useState<
    string | null
  >(null)
  const [message, setMessage] = useState('')
  const [tone, setTone] =
    useState<Tone>('warning')

  const [
    showNotificationForm,
    setShowNotificationForm,
  ] = useState(false)

  const [
    notificationTitle,
    setNotificationTitle,
  ] = useState('Message from CrewCall')

  const [
    notificationBody,
    setNotificationBody,
  ] = useState('')

  const [
    sendingNotification,
    setSendingNotification,
  ] = useState(false)

  const [
    showSuspensionForm,
    setShowSuspensionForm,
  ] = useState(false)

  const [
    suspensionReason,
    setSuspensionReason,
  ] = useState('')

  const [
    changingSuspension,
    setChangingSuspension,
  ] = useState(false)

  const loadData = useCallback(async () => {
    if (!profileId) return

    setLoading(true)
    setMessage('')

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new Error(
          authError?.message ||
            'You must be logged in.'
        )
      }

      const {
        data: adminProfile,
        error: adminError,
      } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (adminError) {
        throw adminError
      }

      if (adminProfile?.role !== 'admin') {
        throw new Error('Admin access only.')
      }

      const [
        profileResponse,
        companyJobs,
        workerJobs,
        reviewsResponse,
      ] = await Promise.all([
        db
          .from('profiles')
          .select(`
            id,
            full_name,
            company_name,
            role,
            phone,
            city,
            state,
            trade,
            years_experience,
            insurance_provider,
            job_experience,
            license_number,
            crewcall_score,
            company_verified,
            insurance_verified,
            liability_form_verified,
            background_verified,
            drug_tested,
            osha10,
            osha30,
            med_gas,
            available_for_work,
            currently_working,
            is_online,
            last_seen,
            created_at,
            is_suspended,
            suspended_at,
            suspension_reason,
            suspended_by
          `)
          .eq('id', profileId)
          .maybeSingle(),

        db
          .from('jobs')
          .select(`
            id,
            title,
            trade,
            location,
            status,
            payment_status,
            pay_rate,
            created_at
          `)
          .eq('company_id', profileId)
          .order('created_at', {
            ascending: false,
          }),

        db
          .from('jobs')
          .select(`
            id,
            title,
            trade,
            location,
            status,
            payment_status,
            pay_rate,
            created_at
          `)
          .eq(
            'assigned_worker_id',
            profileId
          )
          .order('created_at', {
            ascending: false,
          }),

        db
          .from('reviews')
          .select(`
            id,
            rating,
            comment,
            created_at
          `)
          .eq('reviewee_id', profileId)
          .order('created_at', {
            ascending: false,
          }),
      ])

      const firstError =
        profileResponse.error ||
        companyJobs.error ||
        workerJobs.error ||
        reviewsResponse.error

      if (firstError) {
        throw firstError
      }

      if (!profileResponse.data) {
        throw new Error(
          'User profile not found.'
        )
      }

      const mergedJobs = [
        ...((companyJobs.data as Job[]) ||
          []),
        ...((workerJobs.data as Job[]) ||
          []),
      ].filter(
        (job, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.id === job.id
          ) === index
      )

      setProfile(
        profileResponse.data as Profile
      )
      setJobs(mergedJobs)
      setReviews(
        (reviewsResponse.data as Review[]) ||
          []
      )
    } catch (error) {
      console.error(
        'Admin user details error:',
        error
      )

      setMessage(
        error instanceof Error
          ? error.message
          : JSON.stringify(error)
      )
      setTone('error')
    } finally {
      setLoading(false)
    }
  }, [db, profileId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const stats = useMemo(() => {
    const completed = jobs.filter(
      (job) => job.status === 'completed'
    ).length

    const paid = jobs.filter(
      (job) =>
        job.payment_status === 'paid'
    ).length

    const rating =
      reviews.length > 0
        ? reviews.reduce(
            (sum, review) =>
              sum +
              Number(review.rating || 0),
            0
          ) / reviews.length
        : 0

    return {
      completed,
      paid,
      rating,
    }
  }, [jobs, reviews])

  async function toggle(
    field: VerificationField
  ) {
    if (!profile) return

    const nextValue = !Boolean(
      profile[field]
    )

    setWorking(field)
    setMessage('')

    try {
      const { data, error } = await db
        .from('profiles')
        .update({
          [field]: nextValue,
        })
        .eq('id', profile.id)
        .select('*')
        .single()

      if (error) {
        throw error
      }

      setProfile(data as Profile)

      setMessage(
        nextValue
          ? 'Verification approved.'
          : 'Verification removed.'
      )
      setTone('success')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : JSON.stringify(error)
      )
      setTone('error')
    } finally {
      setWorking(null)
    }
  }

  async function sendNotification() {
    if (!profile) return

    const cleanTitle =
      notificationTitle.trim()

    const cleanMessage =
      notificationBody.trim()

    if (!cleanTitle) {
      setMessage(
        'Enter a notification title.'
      )
      setTone('error')
      return
    }

    if (!cleanMessage) {
      setMessage(
        'Enter a notification message.'
      )
      setTone('error')
      return
    }

    setSendingNotification(true)
    setMessage('')

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          sessionError?.message ||
            'Your login session could not be verified.'
        )
      }

      const response = await fetch(
        `/api/admin/users/${profile.id}/notify`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            title: cleanTitle,
            message: cleanMessage,
          }),
        }
      )

      const result = await response
        .json()
        .catch(() => null)

      if (!response.ok) {
        throw new Error(
          result?.error ||
            'The notification could not be sent.'
        )
      }

      setNotificationBody('')
      setShowNotificationForm(false)

      setMessage(
        `Notification sent to ${nameOf(
          profile
        )}.`
      )
      setTone('success')
    } catch (error) {
      console.error(
        'Admin notification error:',
        error
      )

      setMessage(
        error instanceof Error
          ? error.message
          : JSON.stringify(error)
      )
      setTone('error')
    } finally {
      setSendingNotification(false)
    }
  }

  async function changeSuspension(
    action: SuspensionAction
  ) {
    if (!profile) return

    const cleanReason =
      suspensionReason.trim()

    if (
      action === 'suspend' &&
      !cleanReason
    ) {
      setMessage(
        'Enter a reason before suspending this account.'
      )
      setTone('error')
      return
    }

    setChangingSuspension(true)
    setMessage('')

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          sessionError?.message ||
            'Your login session could not be verified.'
        )
      }

      const response = await fetch(
        `/api/admin/users/${profile.id}/suspend`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            action,
            reason:
              action === 'suspend'
                ? cleanReason
                : '',
          }),
        }
      )

      const result =
        (await response
          .json()
          .catch(() => null)) as
          | SuspensionResponse
          | null

      if (!response.ok) {
        throw new Error(
          result?.error ||
            `The account could not be ${
              action === 'suspend'
                ? 'suspended'
                : 'reactivated'
            }.`
        )
      }

      if (result?.profile) {
        setProfile(result.profile)
      } else {
        await loadData()
      }

      setSuspensionReason('')
      setShowSuspensionForm(false)

      setMessage(
        result?.message ||
          (action === 'suspend'
            ? 'User suspended successfully.'
            : 'User reactivated successfully.')
      )
      setTone('success')
    } catch (error) {
      console.error(
        'Admin suspension error:',
        error
      )

      setMessage(
        error instanceof Error
          ? error.message
          : JSON.stringify(error)
      )
      setTone('error')
    } finally {
      setChangingSuspension(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            CrewCall Admin
          </p>

          <h1 className="mt-3 text-3xl font-black">
            Loading User Details...
          </h1>
        </div>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
        <div className="mx-auto max-w-3xl space-y-5">
          {message ? (
            <Notice tone={tone}>
              {message}
            </Notice>
          ) : null}

          <Link
            href="/admin"
            className="inline-flex rounded-2xl bg-cyan-400 px-5 py-3 font-black text-slate-950"
          >
            Back to Admin
          </Link>
        </div>
      </main>
    )
  }

  const required =
    profile.role === 'company'
      ? [
          profile.company_verified,
          profile.insurance_verified,
          profile.liability_form_verified,
        ]
      : [
          profile.insurance_verified,
          profile.liability_form_verified,
        ]

  const verifiedCount =
    required.filter(Boolean).length

  const verifiedPercent =
    required.length > 0
      ? Math.round(
          (verifiedCount /
            required.length) *
            100
        )
      : 0

  const isAdmin =
    profile.role === 'admin'

  const isSuspended = Boolean(
    profile.is_suspended
  )

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-wrap justify-between gap-3">
          <Link
            href="/admin"
            className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-sm font-black"
          >
            ← Control Center
          </Link>

          <Link
            href={`/profile/${profile.id}`}
            className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950"
          >
            Public Profile
          </Link>
        </div>

        {message ? (
          <Notice tone={tone}>
            {message}
          </Notice>
        ) : null}

        {isSuspended ? (
          <section className="rounded-[2rem] border border-red-400/25 bg-red-500/10 p-5 shadow-xl sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
                  Account Suspended
                </p>

                <h2 className="mt-2 text-2xl font-black text-red-100">
                  This account is currently
                  suspended
                </h2>

                <p className="mt-3 text-sm font-semibold leading-6 text-red-100/80">
                  {profile.suspension_reason ||
                    'No suspension reason was provided.'}
                </p>

                <p className="mt-2 text-xs font-bold text-red-200/60">
                  Suspended:{' '}
                  {formatDateTime(
                    profile.suspended_at
                  )}
                </p>
              </div>

              <button
                type="button"
                disabled={
                  changingSuspension ||
                  isAdmin
                }
                onClick={() =>
                  void changeSuspension(
                    'reactivate'
                  )
                }
                className="rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {changingSuspension
                  ? 'Reactivating...'
                  : 'Reactivate Account'}
              </button>
            </div>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl">
          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/20 bg-cyan-500/10 text-2xl font-black text-cyan-300">
                    {nameOf(profile)
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-3xl font-black sm:text-4xl">
                        {nameOf(profile)}
                      </h1>

                      {isSuspended ? (
                        <span className="rounded-full border border-red-400/25 bg-red-500/15 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-red-300">
                          Suspended
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-300">
                          Active
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-sm font-bold text-slate-400">
                      {titleCase(profile.role)} ·
                      Joined{' '}
                      {formatDate(
                        profile.created_at
                      )}
                    </p>
                  </div>
                </div>

                <p className="mt-4 break-all text-xs font-semibold text-slate-600">
                  {profile.id}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                  label="CrewCall Score"
                  value={
                    profile.crewcall_score ??
                    80
                  }
                />

                <Stat
                  label="Rating"
                  value={
                    reviews.length
                      ? stats.rating.toFixed(
                          1
                        )
                      : '—'
                  }
                />

                <Stat
                  label="Completed"
                  value={stats.completed}
                />

                <Stat
                  label="Verified"
                  value={`${verifiedPercent}%`}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Panel title="Profile Information">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Info
                  label="Full Name"
                  value={profile.full_name}
                />

                <Info
                  label="Company"
                  value={
                    profile.company_name
                  }
                />

                <Info
                  label="Phone"
                  value={profile.phone}
                />

                <Info
                  label="Location"
                  value={
                    [
                      profile.city,
                      profile.state,
                    ]
                      .filter(Boolean)
                      .join(', ') || null
                  }
                />

                <Info
                  label="Trade"
                  value={profile.trade}
                />

                <Info
                  label="Experience"
                  value={
                    profile.years_experience
                  }
                />

                <Info
                  label="License"
                  value={
                    profile.license_number
                  }
                />

                <Info
                  label="Insurance"
                  value={
                    profile.insurance_provider
                  }
                />

                <Info
                  label="Last Seen"
                  value={formatDateTime(
                    profile.last_seen
                  )}
                />

                <Info
                  label="Account Status"
                  value={
                    isSuspended
                      ? 'Suspended'
                      : 'Active'
                  }
                />

                <Info
                  label="Suspended At"
                  value={
                    isSuspended
                      ? formatDateTime(
                          profile.suspended_at
                        )
                      : 'Not suspended'
                  }
                />

                <Info
                  label="Paid Jobs"
                  value={String(
                    stats.paid
                  )}
                />
              </div>

              {profile.job_experience ? (
                <div className="mt-4 rounded-3xl border border-white/10 bg-slate-950/55 p-4 text-sm font-semibold leading-6 text-slate-300">
                  {profile.job_experience}
                </div>
              ) : null}

              {isSuspended ? (
                <div className="mt-4 rounded-3xl border border-red-400/20 bg-red-500/10 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-300">
                    Suspension Reason
                  </p>

                  <p className="mt-2 text-sm font-bold leading-6 text-red-100">
                    {profile.suspension_reason ||
                      'No reason provided.'}
                  </p>
                </div>
              ) : null}
            </Panel>

            <Panel
              title={`Jobs (${jobs.length})`}
            >
              <div className="space-y-3">
                {jobs.length === 0 ? (
                  <Empty text="No job history found." />
                ) : (
                  jobs
                    .slice(0, 20)
                    .map((job) => (
                      <div
                        key={job.id}
                        className="rounded-3xl border border-white/10 bg-slate-950/55 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-black">
                              {job.title ||
                                'Untitled Job'}
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-400">
                              {[
                                job.trade,
                                job.location,
                                job.pay_rate,
                              ]
                                .filter(Boolean)
                                .join(' · ') ||
                                'No details'}
                            </p>

                            <p className="mt-2 text-xs font-bold text-slate-600">
                              {titleCase(
                                job.status
                              )}{' '}
                              ·{' '}
                              {titleCase(
                                job.payment_status
                              )}
                            </p>
                          </div>

                          <Link
                            href={`/jobs/${job.id}`}
                            className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-300"
                          >
                            View Job
                          </Link>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </Panel>

            <Panel
              title={`Reviews (${reviews.length})`}
            >
              <div className="space-y-3">
                {reviews.length === 0 ? (
                  <Empty text="No reviews found." />
                ) : (
                  reviews
                    .slice(0, 20)
                    .map((review) => (
                      <div
                        key={review.id}
                        className="rounded-3xl border border-white/10 bg-slate-950/55 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <p className="font-black text-amber-300">
                            {'★'.repeat(
                              Math.max(
                                0,
                                Math.min(
                                  5,
                                  Number(
                                    review.rating ||
                                      0
                                  )
                                )
                              )
                            )}
                          </p>

                          <p className="text-xs font-bold text-slate-600">
                            {formatDate(
                              review.created_at
                            )}
                          </p>
                        </div>

                        <p className="mt-2 text-sm font-semibold text-slate-300">
                          {review.comment ||
                            'No written review.'}
                        </p>
                      </div>
                    ))
                )}
              </div>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="Verification">
              <div className="mb-4 rounded-3xl border border-white/10 bg-slate-950/55 p-4">
                <div className="flex justify-between text-sm font-black">
                  <span>
                    {verifiedCount}/
                    {required.length}{' '}
                    complete
                  </span>

                  <span
                    className={
                      verifiedPercent === 100
                        ? 'text-emerald-300'
                        : 'text-amber-300'
                    }
                  >
                    {verifiedPercent}%
                  </span>
                </div>

                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={
                      verifiedPercent === 100
                        ? 'h-full bg-emerald-400'
                        : 'h-full bg-amber-400'
                    }
                    style={{
                      width: `${verifiedPercent}%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                {profile.role ===
                'company' ? (
                  <VerifyRow
                    label="Company"
                    active={
                      profile.company_verified
                    }
                    working={
                      working ===
                      'company_verified'
                    }
                    onClick={() =>
                      void toggle(
                        'company_verified'
                      )
                    }
                  />
                ) : null}

                <VerifyRow
                  label="Insurance"
                  active={
                    profile.insurance_verified
                  }
                  working={
                    working ===
                    'insurance_verified'
                  }
                  onClick={() =>
                    void toggle(
                      'insurance_verified'
                    )
                  }
                />

                <VerifyRow
                  label="Liability Form"
                  active={
                    profile.liability_form_verified
                  }
                  working={
                    working ===
                    'liability_form_verified'
                  }
                  onClick={() =>
                    void toggle(
                      'liability_form_verified'
                    )
                  }
                />

                <VerifyRow
                  label="Background Check"
                  active={
                    profile.background_verified
                  }
                  working={
                    working ===
                    'background_verified'
                  }
                  onClick={() =>
                    void toggle(
                      'background_verified'
                    )
                  }
                />

                <VerifyRow
                  label="Drug Tested"
                  active={
                    profile.drug_tested
                  }
                  working={
                    working ===
                    'drug_tested'
                  }
                  onClick={() =>
                    void toggle(
                      'drug_tested'
                    )
                  }
                />
              </div>
            </Panel>

            <Panel title="Credentials">
              <div className="grid gap-3 sm:grid-cols-2">
                <Credential
                  label="OSHA 10"
                  active={profile.osha10}
                />

                <Credential
                  label="OSHA 30"
                  active={profile.osha30}
                />

                <Credential
                  label="Medical Gas"
                  active={profile.med_gas}
                />

                <Credential
                  label="Available"
                  active={
                    profile.available_for_work
                  }
                />

                <Credential
                  label="Working"
                  active={
                    profile.currently_working
                  }
                />

                <Credential
                  label="Online"
                  active={isActuallyOnline(profile)}
                />
              </div>
            </Panel>

            <Panel title="Admin Actions">
              <p className="text-sm font-semibold leading-6 text-slate-400">
                Suspend or reactivate this
                account, or send a direct
                in-app notification. All
                requests are verified by
                secure server-side admin
                routes.
              </p>

              <div className="mt-4 space-y-3">
                {isAdmin ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm font-bold text-amber-200">
                    Administrator accounts
                    cannot be suspended from
                    this page.
                  </div>
                ) : isSuspended ? (
                  <button
                    type="button"
                    disabled={
                      changingSuspension
                    }
                    onClick={() =>
                      void changeSuspension(
                        'reactivate'
                      )
                    }
                    className="w-full rounded-2xl bg-emerald-400 px-4 py-3 font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {changingSuspension
                      ? 'Reactivating Account...'
                      : 'Reactivate Account'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={
                      changingSuspension
                    }
                    onClick={() => {
                      setShowSuspensionForm(
                        (current) =>
                          !current
                      )
                      setShowNotificationForm(
                        false
                      )
                      setMessage('')
                    }}
                    className="w-full rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 font-black text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {showSuspensionForm
                      ? 'Close Suspension Form'
                      : 'Suspend Account'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowNotificationForm(
                      (current) =>
                        !current
                    )
                    setShowSuspensionForm(
                      false
                    )
                    setMessage('')
                  }}
                  className="w-full rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 font-black text-cyan-300 transition hover:bg-cyan-500/20"
                >
                  {showNotificationForm
                    ? 'Close Notification Form'
                    : 'Send Notification'}
                </button>
              </div>

              {showSuspensionForm &&
              !isSuspended &&
              !isAdmin ? (
                <div className="mt-4 space-y-4 rounded-3xl border border-red-400/20 bg-red-500/[0.06] p-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-red-300">
                      Suspend Account
                    </p>

                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
                      Enter the reason this
                      account is being
                      suspended. The user will
                      receive an in-app
                      notification containing
                      this reason.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="suspension-reason"
                        className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
                      >
                        Suspension Reason
                      </label>

                      <span className="text-xs font-bold text-slate-600">
                        {
                          suspensionReason.length
                        }
                        /500
                      </span>
                    </div>

                    <textarea
                      id="suspension-reason"
                      value={
                        suspensionReason
                      }
                      onChange={(event) =>
                        setSuspensionReason(
                          event.target.value
                        )
                      }
                      maxLength={500}
                      rows={5}
                      placeholder={`Explain why ${nameOf(
                        profile
                      )}'s account is being suspended...`}
                      className="mt-2 w-full resize-none rounded-2xl border border-red-400/20 bg-slate-950 px-4 py-3 text-sm font-bold leading-6 text-white outline-none placeholder:text-slate-600 focus:border-red-400/50"
                    />
                  </div>

                  <div className="rounded-2xl border border-red-400/15 bg-red-500/10 p-3 text-xs font-bold leading-5 text-red-200">
                    This action changes the
                    user&apos;s account status
                    immediately. The account
                    can be reactivated later.
                  </div>

                  <button
                    type="button"
                    disabled={
                      changingSuspension ||
                      !suspensionReason.trim()
                    }
                    onClick={() =>
                      void changeSuspension(
                        'suspend'
                      )
                    }
                    className="w-full rounded-2xl bg-red-500 px-4 py-3 font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {changingSuspension
                      ? 'Suspending Account...'
                      : `Suspend ${nameOf(
                          profile
                        )}`}
                  </button>
                </div>
              ) : null}

              {showNotificationForm ? (
                <div className="mt-4 space-y-4 rounded-3xl border border-cyan-400/20 bg-slate-950/60 p-4">
                  <div>
                    <label
                      htmlFor="notification-title"
                      className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
                    >
                      Title
                    </label>

                    <input
                      id="notification-title"
                      value={
                        notificationTitle
                      }
                      onChange={(event) =>
                        setNotificationTitle(
                          event.target.value
                        )
                      }
                      maxLength={100}
                      placeholder="Message from CrewCall"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="notification-message"
                        className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
                      >
                        Message
                      </label>

                      <span className="text-xs font-bold text-slate-600">
                        {
                          notificationBody.length
                        }
                        /500
                      </span>
                    </div>

                    <textarea
                      id="notification-message"
                      value={
                        notificationBody
                      }
                      onChange={(event) =>
                        setNotificationBody(
                          event.target.value
                        )
                      }
                      maxLength={500}
                      rows={5}
                      placeholder={`Write a message to ${nameOf(
                        profile
                      )}...`}
                      className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={
                      sendingNotification ||
                      !notificationTitle.trim() ||
                      !notificationBody.trim()
                    }
                    onClick={() =>
                      void sendNotification()
                    }
                    className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingNotification
                      ? 'Sending Notification...'
                      : `Send to ${nameOf(
                          profile
                        )}`}
                  </button>
                </div>
              ) : null}
            </Panel>
          </div>
        </section>
      </div>
    </main>
  )
}

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl sm:p-6">
      <h2 className="text-2xl font-black">
        {title}
      </h2>

      <div className="mt-5">
        {children}
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-center">
      <p className="text-xl font-black">
        {value}
      </p>

      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.13em] text-slate-500">
        {label}
      </p>
    </div>
  )
}

function Info({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-black">
        {value || 'Not provided'}
      </p>
    </div>
  )
}

function VerifyRow({
  label,
  active,
  working,
  onClick,
}: {
  label: string
  active: boolean | null
  working: boolean
  onClick: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-3">
      <div>
        <p className="font-black">
          {label}
        </p>

        <p className="mt-1 text-xs font-semibold text-slate-500">
          {active
            ? 'Approved'
            : 'Needs review'}
        </p>
      </div>

      <button
        type="button"
        disabled={working}
        onClick={onClick}
        className={
          active
            ? 'rounded-full border border-emerald-400/20 bg-emerald-500/15 px-3 py-1.5 text-xs font-black text-emerald-300 disabled:opacity-50'
            : 'rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-xs font-black text-amber-300 disabled:opacity-50'
        }
      >
        {working
          ? 'Updating...'
          : active
            ? 'Verified'
            : 'Verify'}
      </button>
    </div>
  )
}

function Credential({
  label,
  active,
}: {
  label: string
  active: boolean | null
}) {
  return (
    <div
      className={
        active
          ? 'rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4'
          : 'rounded-2xl border border-white/10 bg-slate-950/55 p-4'
      }
    >
      <p
        className={
          active
            ? 'font-black text-emerald-300'
            : 'font-black text-slate-400'
        }
      >
        {active ? '✓ ' : '— '}
        {label}
      </p>
    </div>
  )
}

function Empty({
  text,
}: {
  text: string
}) {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 p-8 text-center text-sm font-semibold text-slate-500">
      {text}
    </div>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: Tone
  children: React.ReactNode
}) {
  const classes = {
    error:
      'border-red-400/20 bg-red-500/10 text-red-200',
    success:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    warning:
      'border-amber-400/20 bg-amber-500/10 text-amber-200',
  }

  return (
    <div
      className={`rounded-2xl border p-4 text-sm font-bold ${classes[tone]}`}
    >
      {children}
    </div>
  )
}