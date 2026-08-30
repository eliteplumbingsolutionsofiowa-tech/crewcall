'use client'

import { useTranslations } from 'next-intl'

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ProfileReviews from '@/app/components/ProfileReviews'
import ProfileFileUpload from '@/app/components/ProfileFileUpload'
import ProfileFileList from '@/app/components/ProfileFileList'
import ReportModal from '@/app/components/ReportModal'

type Role = 'company' | 'worker' | null

type Profile = {
  id: string
  role: Role
  full_name: string | null
  company_name: string | null
  phone: string | null
  city: string | null
  state: string | null
  trade: string | null
  years_experience: string | null
  insurance_provider: string | null
  job_experience: string | null
  liability_form_signed: boolean | null
  available_for_work: boolean | null
  currently_working: boolean | null
  booked_until: string | null
  is_online: boolean | null
  last_seen: string | null
  stripe_account_id?: string | null
  stripe_onboarding_complete?: boolean | null
  stripe_charges_enabled?: boolean | null
  stripe_payouts_enabled?: boolean | null
}

type ProfileFile = {
  id: string
  file_name: string | null
  file_url: string | null
  file_type: string | null
  category: string | null
  created_at: string
}

type CompanyJob = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  status: string | null
}

type NoticeTone = 'error' | 'success' | 'info'

const profileSelect = `
  id,
  role,
  full_name,
  company_name,
  phone,
  city,
  state,
  trade,
  years_experience,
  insurance_provider,
  job_experience,
  liability_form_signed,
  available_for_work,
  currently_working,
  booked_until,
  is_online,
  last_seen,
  stripe_account_id,
  stripe_onboarding_complete,
  stripe_charges_enabled,
  stripe_payouts_enabled
`

function emptyProfile(id: string): Profile {
  return {
    id,
    role: null,
    full_name: '',
    company_name: '',
    phone: '',
    city: '',
    state: '',
    trade: '',
    years_experience: '',
    insurance_provider: '',
    job_experience: '',
    liability_form_signed: false,
    available_for_work: true,
    currently_working: false,
    booked_until: null,
    is_online: true,
    last_seen: new Date().toISOString(),
    stripe_account_id: null,
    stripe_onboarding_complete: false,
    stripe_charges_enabled: false,
    stripe_payouts_enabled: false,
  }
}

function textValue(value: unknown) {
  if (typeof value !== 'string') {
    return 'Not added yet'
  }

  const trimmed = value.trim()

  return trimmed.length > 0
    ? trimmed
    : 'Not added yet'
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Not set'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Not set'
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Not available'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Not available'
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function isRecentlyOnline(value: string | null | undefined) {
  if (!value) {
    return false
  }

  const lastSeen = new Date(value).getTime()

  if (Number.isNaN(lastSeen)) {
    return false
  }

  return Date.now() - lastSeen < 90_000
}

function getInitial(value: string | null | undefined) {
  return String(value || 'C').charAt(0).toUpperCase()
}

function ProfilePageInner() {
  const t = useTranslations('PublicWorkerProfile')
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()

  const routeUserId = String(params.id || '')
  const viewedUserId =
    searchParams.get('user') || routeUserId || null

  const supabaseAny = supabase as any

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null)

  const [currentProfile, setCurrentProfile] =
    useState<Profile | null>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileFiles, setProfileFiles] = useState<ProfileFile[]>([])
  const [companyJobs, setCompanyJobs] = useState<CompanyJob[]>([])

  const [selectedInviteJobId, setSelectedInviteJobId] =
    useState('')

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [stripeLoading, setStripeLoading] = useState(false)

  const [message, setMessage] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [blockLoading, setBlockLoading] = useState(false)
  const [messageTone, setMessageTone] =
    useState<NoticeTone>('info')

  const isOwnProfile =
    !viewedUserId || viewedUserId === currentUserId

  const canInviteWorker =
    !isOwnProfile &&
    currentProfile?.role === 'company' &&
    profile?.role === 'worker'

  const isWorkerProfile = profile?.role === 'worker'

  const profilePhoto = useMemo(
    () =>
      profileFiles.find(
        (file) => file.category === 'profile_photo'
      ),
    [profileFiles]
  )

  const certificationFiles = useMemo(
    () =>
      profileFiles.filter(
        (file) => file.category === 'certification'
      ),
    [profileFiles]
  )

  const licenseFiles = useMemo(
    () =>
      profileFiles.filter(
        (file) => file.category === 'license'
      ),
    [profileFiles]
  )

  const insuranceFiles = useMemo(
    () =>
      profileFiles.filter(
        (file) => file.category === 'insurance'
      ),
    [profileFiles]
  )

  const completionScore = useMemo(() => {
    if (!profile) {
      return 0
    }

    const checks = [
      Boolean(profile.role),
      Boolean(profile.full_name || profile.company_name),
      Boolean(profile.phone),
      Boolean(profile.city),
      Boolean(profile.state),
      Boolean(profile.trade),
      Boolean(profile.years_experience),
      Boolean(profile.insurance_provider),
      Boolean(profile.job_experience),
      Boolean(profile.liability_form_signed),
      profileFiles.length > 0,
    ]

    return Math.round(
      (checks.filter(Boolean).length / checks.length) * 100
    )
  }, [profile, profileFiles.length])

  const onlineNow = useMemo(() => {
    return (
      Boolean(profile?.is_online) &&
      isRecentlyOnline(profile?.last_seen)
    )
  }, [profile?.is_online, profile?.last_seen])

  const trustBadges = useMemo(() => {
    return [
      {
        label: 'Profile',
        active: completionScore >= 80,
        detail: `${completionScore}% complete`,
      },
      {
        label: 'Insurance',
        active:
          Boolean(profile?.insurance_provider) ||
          insuranceFiles.length > 0,
        detail:
          profile?.insurance_provider ||
          insuranceFiles.length > 0
            ? 'Added'
            : 'Missing',
      },
      {
        label: 'Liability',
        active: Boolean(profile?.liability_form_signed),
        detail: profile?.liability_form_signed
          ? 'Signed'
          : 'Not signed',
      },
      {
        label: 'Files',
        active: profileFiles.length > 0,
        detail: `${profileFiles.length} uploaded`,
      },
    ]
  }, [
    completionScore,
    insuranceFiles.length,
    profile?.insurance_provider,
    profile?.liability_form_signed,
    profileFiles.length,
  ])

  const displayName =
    profile?.company_name ||
    profile?.full_name ||
    'CrewCall Profile'

  const profileLocation =
    [profile?.city, profile?.state].filter(Boolean).join(', ') ||
    'Location not added yet'

  const loadProfile = useCallback(
    async (backgroundRefresh = false) => {
      if (backgroundRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      if (!backgroundRefresh) {
        setMessage('')
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setCurrentUserId(null)
        setCurrentProfile(null)
        setProfile(null)
        setMessage('Please log in to view profiles.')
        setMessageTone('error')
        setLoading(false)
        setRefreshing(false)
        return
      }

      setCurrentUserId(user.id)

      await supabaseAny
        .from('profiles')
        .update({
          is_online: true,
          last_seen: new Date().toISOString(),
        })
        .eq('id', user.id)

      const { data: currentProfileData } = await supabaseAny
        .from('profiles')
        .select(profileSelect)
        .eq('id', user.id)
        .maybeSingle()

      const current =
        (currentProfileData as Profile | null) || null

      setCurrentProfile(current)

      const profileId = viewedUserId || user.id

      const { data, error } = await supabaseAny
        .from('profiles')
        .select(profileSelect)
        .eq('id', profileId)
        .maybeSingle()

      if (error) {
        setMessage(error.message)
        setMessageTone('error')
      }

      setProfile(
        (data as Profile | null) ||
          (profileId === user.id
            ? emptyProfile(user.id)
            : null)
      )

      const { data: files, error: fileError } =
        await supabaseAny
          .from('profile_files')
          .select(
            'id,file_name,file_url,file_type,category,created_at'
          )
          .eq('user_id', profileId)
          .order('created_at', {
            ascending: false,
          })

      if (fileError) {
        setMessage(fileError.message)
        setMessageTone('error')
      }

      setProfileFiles((files as ProfileFile[]) || [])

      if (current?.role === 'company') {
        const { data: jobs, error: jobError } =
          await supabaseAny
            .from('jobs')
            .select('id,title,trade,location,status')
            .eq('company_id', user.id)
            .in('status', ['open', 'assigned'])
            .order('created_at', {
              ascending: false,
            })

        if (jobError) {
          setMessage(jobError.message)
          setMessageTone('error')
        }

        const loadedJobs = (jobs as CompanyJob[]) || []

        setCompanyJobs(loadedJobs)

        setSelectedInviteJobId((previous) => {
          if (
            previous &&
            loadedJobs.some((job) => job.id === previous)
          ) {
            return previous
          }

          return loadedJobs[0]?.id || ''
        })
      } else {
        setCompanyJobs([])
        setSelectedInviteJobId('')
      }

      if (backgroundRefresh) {
        setMessage('Profile refreshed.')
        setMessageTone('success')
      }

      setLoading(false)
      setRefreshing(false)
    },
    [supabaseAny, viewedUserId]
  )

  const updateOnlineStatus = useCallback(
    async (isOnline: boolean) => {
      if (!currentUserId) {
        return
      }

      await supabaseAny
        .from('profiles')
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString(),
        })
        .eq('id', currentUserId)
    },
    [currentUserId, supabaseAny]
  )

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  useEffect(() => {
    if (!currentUserId) {
      return
    }

    void updateOnlineStatus(true)

    const interval = window.setInterval(() => {
      void updateOnlineStatus(true)
    }, 30000)

    const handleFocus = () => {
      void updateOnlineStatus(true)
      void loadProfile(true)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void updateOnlineStatus(true)
        void loadProfile(true)
      } else {
        void updateOnlineStatus(false)
      }
    }

    window.addEventListener('focus', handleFocus)

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    )

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      )

      void updateOnlineStatus(false)
    }
  }, [currentUserId, loadProfile, updateOnlineStatus])

  function updateField(
    field: keyof Profile,
    value: string | boolean | null
  ) {
    setProfile((previous) =>
      previous
        ? {
            ...previous,
            [field]: value,
          }
        : previous
    )
  }

  async function saveProfile() {
    if (!profile || !currentUserId || !isOwnProfile) {
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabaseAny
      .from('profiles')
      .upsert(
        {
          id: currentUserId,
          role: profile.role,
          full_name: profile.full_name || null,
          company_name: profile.company_name || null,
          phone: profile.phone || null,
          city: profile.city || null,
          state: profile.state || null,
          trade: profile.trade || null,
          years_experience:
            profile.years_experience || null,
          insurance_provider:
            profile.insurance_provider || null,
          job_experience: profile.job_experience || null,
          liability_form_signed: Boolean(
            profile.liability_form_signed
          ),
          available_for_work: Boolean(
            profile.available_for_work
          ),
          currently_working: Boolean(
            profile.currently_working
          ),
          booked_until: profile.booked_until || null,
          is_online: true,
          last_seen: new Date().toISOString(),
        },
        {
          onConflict: 'id',
        }
      )

    if (error) {
      setMessage(error.message)
      setMessageTone('error')
    } else {
      setMessage('Profile saved successfully.')
      setMessageTone('success')
      await loadProfile()
      window.dispatchEvent(
        new Event('crewcall-refresh-nav')
      )
    }

    setSaving(false)
  }

  async function inviteWorker() {
    if (
      !profile ||
      !currentUserId ||
      !selectedInviteJobId
    ) {
      return
    }

    setInviting(true)
    setMessage('')

    const { data: existingInvite, error: existingError } =
      await supabaseAny
        .from('job_invites')
        .select('id,status')
        .eq('company_id', currentUserId)
        .eq('worker_id', profile.id)
        .eq('job_id', selectedInviteJobId)
        .maybeSingle()

    if (existingError) {
      setMessage(existingError.message)
      setMessageTone('error')
      setInviting(false)
      return
    }

    if (existingInvite) {
      setMessage(
        'This worker already has an invite for that job.'
      )
      setMessageTone('info')
      setInviting(false)
      return
    }

    const { error } = await supabaseAny
      .from('job_invites')
      .insert({
        company_id: currentUserId,
        worker_id: profile.id,
        job_id: selectedInviteJobId,
        status: 'pending',
        company_seen: true,
        worker_seen: false,
      })

    if (error) {
      setMessage(error.message)
      setMessageTone('error')
    } else {
      const selectedJob = companyJobs.find(
        (job) => job.id === selectedInviteJobId
      )

      const { error: notificationError } =
        await supabaseAny.from('notifications').insert({
          user_id: profile.id,
          title: 'New job invite',
          body: `You were invited to ${
            selectedJob?.title || 'a job'
          }.`,
          link_url: '/invites',
          read: false,
          is_read: false,
        })

      if (notificationError) {
        console.error(notificationError)
      }

      setMessage('Invite sent successfully.')
      setMessageTone('success')

      window.dispatchEvent(
        new Event('crewcall-refresh-nav')
      )
    }

    setInviting(false)
  }

  async function startStripeOnboarding() {
    if (!currentUserId || !isOwnProfile) {
      return
    }

    setStripeLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = (await response.json()) as {
        url?: string
        error?: string
      }

      if (!response.ok) {
        setMessage(
          result.error ||
            'Stripe onboarding could not be started.'
        )
        setMessageTone('error')
        setStripeLoading(false)
        return
      }

      if (result.url) {
        window.location.href = result.url
        return
      }

      setMessage(
        'Stripe did not return an onboarding link.'
      )
      setMessageTone('error')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Stripe onboarding failed.'
      )
      setMessageTone('error')
    }

    setStripeLoading(false)
  }

  useEffect(() => {
    let active = true

    async function loadBlockStatus() {
      if (!profile?.id || isOwnProfile) {
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data } = await (supabase as any)
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', profile.id)
        .maybeSingle()

      if (active) {
        setBlocked(Boolean(data))
      }
    }

    void loadBlockStatus()

    return () => {
      active = false
    }
  }, [profile?.id, isOwnProfile])

  if (loading) {
    return <LoadingState />
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[2rem] border border-red-400/20 bg-red-500/10 p-8 text-red-200">
            <p className="text-lg font-black">
              {message || 'Profile not found.'}
            </p>

            <Link
              href="/jobs"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              Back to Jobs
            </Link>
          </div>
        </div>
      </main>
    )
  }

  async function toggleBlockUser() {
    if (!profile?.id || isOwnProfile) return

    setBlockLoading(true)
    setMessage('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('You must be logged in.')
      }

      if (blocked) {
        const { error } = await (supabase as any)
          .from('user_blocks')
          .delete()
          .eq('blocker_id', user.id)
          .eq('blocked_id', profile.id)

        if (error) throw error

        setBlocked(false)
        setMessage('User unblocked.')
      } else {
        const confirmed = window.confirm(
          `Block ${displayName}? They will remain blocked until you unblock them.`
        )

        if (!confirmed) {
          setBlockLoading(false)
          return
        }

        const { error } = await (supabase as any)
          .from('user_blocks')
          .insert({
            blocker_id: user.id,
            blocked_id: profile.id,
          })

        if (error) throw error

        setBlocked(true)
        setMessage('User blocked.')
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not update block status.'
      )
    } finally {
      setBlockLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8 lg:px-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-48 top-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />

        <div className="absolute -right-48 top-56 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />

        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-violet-500/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm font-black text-cyan-300 transition hover:text-cyan-200"
          >
            ← Back
          </button>

          <button
            type="button"
            onClick={() => void loadProfile(true)}
            disabled={refreshing}
            className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-sm font-black text-white transition hover:bg-white/[0.114] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing
              ? 'Refreshing...'
              : 'Refresh Profile'}
          </button>
        </div>

        {message ? (
          <Notice tone={messageTone}>{message}</Notice>
        ) : null}

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

          <div className="p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col justify-between gap-8 xl:flex-row xl:items-start">
              <div className="flex min-w-0 flex-1 flex-col gap-6 sm:flex-row sm:items-start">
                <div className="relative shrink-0">
                  <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-400/20 via-blue-500/15 to-violet-500/15 text-4xl font-black text-cyan-300 shadow-xl shadow-cyan-950/30 sm:h-36 sm:w-36">
                    {profilePhoto?.file_url ? (
                      <img
                        src={profilePhoto.file_url}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{getInitial(displayName)}</span>
                    )}
                  </div>

                  <span
                    className={[
                      'absolute -bottom-1 -right-1 h-7 w-7 rounded-full border-4 border-slate-950',
                      onlineNow
                        ? 'bg-emerald-400'
                        : 'bg-slate-600',
                    ].join(' ')}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={
                        onlineNow ? t('onlineNow') : t('offline')
                      }
                      tone={onlineNow ? 'green' : 'slate'}
                    />

                    <StatusBadge
                      label={
                        profile.role === 'company'
                          ? 'Company'
                          : profile.role === 'worker'
                            ? 'Worker'
                            : 'Role Not Set'
                      }
                      tone="cyan"
                    />

                    {profile.available_for_work ? (
                      <StatusBadge
                        label={t('availableForWork')}
                        tone="green"
                      />
                    ) : null}

                    {profile.currently_working ? (
                      <StatusBadge
                        label={t('currentlyWorking')}
                        tone="blue"
                      />
                    ) : null}
                  </div>

                  <h1 className="mt-4 break-words text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                    {displayName}
                  </h1>

                  <p className="mt-3 text-base font-semibold text-slate-300 sm:text-lg">
                    {profile.trade || t('tradeNotAddedYet')}
                  </p>

                  <p className="mt-2 text-sm font-semibold text-slate-400">
                    {profileLocation}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {profile.phone ? (
                      <a
                        href={`tel:${profile.phone}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-black text-cyan-200 transition hover:bg-cyan-500/15"
                      >
                        Call
                      </a>
                    ) : null}

                    {!isOwnProfile ? (
  <>
    <Link
      href={`/messages?user=${profile.id}`}
      className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-sm font-black text-white transition hover:bg-white/[0.1]"
    >
      Message
    </Link>

    <ReportModal
      targetType={
        profile.role === 'company'
          ? 'company'
          : 'user'
      }
      targetId={profile.id}
      targetName={displayName}
    />

    <button
      type="button"
      onClick={() => void toggleBlockUser()}
      disabled={blockLoading}
      className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-500/10 px-4 py-2 text-sm font-black text-orange-200 transition hover:bg-orange-500/20 disabled:opacity-50"
    >
      {blockLoading
        ? 'Updating...'
        : blocked
          ? 'Unblock User'
          : 'Block User'}
    </button>
  </>
) : null}
                  </div>
                </div>
              </div>

              <div className="grid w-full shrink-0 grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[470px]">
                <HeroStat
                  label={t('complete')}
                  value={`${completionScore}%`}
                  tone="cyan"
                />

                <HeroStat
                  label={t('files')}
                  value={String(profileFiles.length)}
                  tone="blue"
                />

                <HeroStat
                  label={t('certs')}
                  value={String(certificationFiles.length)}
                  tone="violet"
                />

                <HeroStat
                  label={t('licenses')}
                  value={String(licenseFiles.length)}
                  tone="green"
                />
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
          <div className="space-y-6">
            <SectionCard>
              <SectionHeader
                eyebrow={t('professionalProfile')}
                title={
                  isOwnProfile
                    ? 'Edit Profile'
                    : 'Profile Details'
                }
                description={
                  isOwnProfile
                    ? 'Keep your profile complete, professional, and ready for new CrewCall opportunities.'
                    : 'Review this user’s professional information, experience, and availability.'
                }
                action={
                  isOwnProfile ? (
                    <PrimaryButton
                      onClick={() => void saveProfile()}
                      disabled={saving}
                    >
                      {saving
                        ? 'Saving...'
                        : 'Save Profile'}
                    </PrimaryButton>
                  ) : undefined
                }
              />

              <div className="p-5 sm:p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldBlock label={t('role')}>
                    {isOwnProfile ? (
                      <select
                        value={profile.role || ''}
                        onChange={(event) =>
                          updateField(
                            'role',
                            event.target.value as Role
                          )
                        }
                        className="input-dark"
                      >
                        <option value="">{t('selectRole')}</option>
                        <option value="worker">{t('worker')}</option>
                        <option value="company">{t('company')}</option>
                      </select>
                    ) : (
                      <ReadOnlyValue
                        value={
                          profile.role || t('notAddedYet')
                        }
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('fullName')}>
                    {isOwnProfile ? (
                      <input
                        value={profile.full_name || ''}
                        onChange={(event) =>
                          updateField(
                            'full_name',
                            event.target.value
                          )
                        }
                        className="input-dark"
                        placeholder={t('yourName')}
                      />
                    ) : (
                      <ReadOnlyValue
                        value={textValue(profile.full_name)}
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('companyName')}>
                    {isOwnProfile ? (
                      <input
                        value={profile.company_name || ''}
                        onChange={(event) =>
                          updateField(
                            'company_name',
                            event.target.value
                          )
                        }
                        className="input-dark"
                        placeholder={t('companyNamePlaceholder')}
                      />
                    ) : (
                      <ReadOnlyValue
                        value={textValue(
                          profile.company_name
                        )}
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('phone')}>
                    {isOwnProfile ? (
                      <input
                        value={profile.phone || ''}
                        onChange={(event) =>
                          updateField(
                            'phone',
                            event.target.value
                          )
                        }
                        className="input-dark"
                        placeholder={t('phoneNumber')}
                      />
                    ) : (
                      <ReadOnlyValue
                        value={textValue(profile.phone)}
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('city')}>
                    {isOwnProfile ? (
                      <input
                        value={profile.city || ''}
                        onChange={(event) =>
                          updateField(
                            'city',
                            event.target.value
                          )
                        }
                        className="input-dark"
                        placeholder={t('city')}
                      />
                    ) : (
                      <ReadOnlyValue
                        value={textValue(profile.city)}
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('state')}>
                    {isOwnProfile ? (
                      <input
                        value={profile.state || ''}
                        onChange={(event) =>
                          updateField(
                            'state',
                            event.target.value
                          )
                        }
                        className="input-dark"
                        placeholder={t('state')}
                      />
                    ) : (
                      <ReadOnlyValue
                        value={textValue(profile.state)}
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('trade')}>
                    {isOwnProfile ? (
                      <input
                        value={profile.trade || ''}
                        onChange={(event) =>
                          updateField(
                            'trade',
                            event.target.value
                          )
                        }
                        className="input-dark"
                        placeholder={t('tradePlaceholder')}
                      />
                    ) : (
                      <ReadOnlyValue
                        value={textValue(profile.trade)}
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('yearsExperience')}>
                    {isOwnProfile ? (
                      <input
                        value={
                          profile.years_experience || ''
                        }
                        onChange={(event) =>
                          updateField(
                            'years_experience',
                            event.target.value
                          )
                        }
                        className="input-dark"
                        placeholder={t('yearsExperiencePlaceholder')}
                      />
                    ) : (
                      <ReadOnlyValue
                        value={textValue(
                          profile.years_experience
                        )}
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('insuranceProvider')}>
                    {isOwnProfile ? (
                      <input
                        value={
                          profile.insurance_provider || ''
                        }
                        onChange={(event) =>
                          updateField(
                            'insurance_provider',
                            event.target.value
                          )
                        }
                        className="input-dark"
                        placeholder={t('insuranceProvider')}
                      />
                    ) : (
                      <ReadOnlyValue
                        value={textValue(
                          profile.insurance_provider
                        )}
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('bookedUntilLabel')}>
                    {isOwnProfile ? (
                      <input
                        type="date"
                        value={profile.booked_until || ''}
                        onChange={(event) =>
                          updateField(
                            'booked_until',
                            event.target.value || null
                          )
                        }
                        className="input-dark"
                      />
                    ) : (
                      <ReadOnlyValue
                        value={formatDate(
                          profile.booked_until
                        )}
                      />
                    )}
                  </FieldBlock>
                </div>

                <div className="mt-4">
                  <FieldBlock label={t('jobExperience')}>
                    {isOwnProfile ? (
                      <textarea
                        value={profile.job_experience || ''}
                        onChange={(event) =>
                          updateField(
                            'job_experience',
                            event.target.value
                          )
                        }
                        className="input-dark min-h-36 resize-y"
                        placeholder={t('jobExperiencePlaceholder')}
                      />
                    ) : (
                      <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 text-sm font-semibold leading-7 text-slate-300">
                        {textValue(
                          profile.job_experience
                        )}
                      </div>
                    )}
                  </FieldBlock>
                </div>

                {isOwnProfile ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <ToggleCard
                      label={t('liabilitySigned')}
                      description={t('complianceFormCompleted')}
                      checked={Boolean(
                        profile.liability_form_signed
                      )}
                      onChange={(checked) =>
                        updateField(
                          'liability_form_signed',
                          checked
                        )
                      }
                    />

                    <ToggleCard
                      label={t('available')}
                      description={t('openToNewOffers')}
                      checked={Boolean(
                        profile.available_for_work
                      )}
                      onChange={(checked) =>
                        updateField(
                          'available_for_work',
                          checked
                        )
                      }
                    />

                    <ToggleCard
                      label={t('currentlyWorking')}
                      description={t('activelyAssigned')}
                      checked={Boolean(
                        profile.currently_working
                      )}
                      onChange={(checked) =>
                        updateField(
                          'currently_working',
                          checked
                        )
                      }
                    />
                  </div>
                ) : null}
              </div>
            </SectionCard>

            {isOwnProfile ? (
              <SectionCard>
                <SectionHeader
                  eyebrow={t('profileVerification')}
                  title={t('uploadProfileFiles')}
                  description={t('uploadProfileFilesDescription')}
                />

                <div className="grid gap-4 p-5 md:grid-cols-2 sm:p-6">
                  <UploadWrapper>
                    <ProfileFileUpload
                      userId={profile.id}
                      category="profile_photo"
                      label={t('profilePhoto')}
                      description={t('profilePhotoDescription')}
                      accept="image/*"
                      onUploadComplete={loadProfile}
                    />
                  </UploadWrapper>

                  <UploadWrapper>
                    <ProfileFileUpload
                      userId={profile.id}
                      category="license"
                      label={t('license')}
                      description={t('licenseDescription')}
                      accept="image/*,.pdf"
                      onUploadComplete={loadProfile}
                    />
                  </UploadWrapper>

                  <UploadWrapper>
                    <ProfileFileUpload
                      userId={profile.id}
                      category="certification"
                      label={t('certification')}
                      description={t('certificationDescription')}
                      accept="image/*,.pdf"
                      onUploadComplete={loadProfile}
                    />
                  </UploadWrapper>

                  <UploadWrapper>
                    <ProfileFileUpload
                      userId={profile.id}
                      category="insurance"
                      label={t('insurance')}
                      description={t('insuranceDescription')}
                      accept="image/*,.pdf"
                      onUploadComplete={loadProfile}
                    />
                  </UploadWrapper>
                </div>
              </SectionCard>
            ) : null}

            <SectionCard>
              <SectionHeader
                eyebrow={t('verificationDocuments')}
                title={t('uploadedDocuments')}
                description={t('uploadedDocumentsDescription')}
                badge={`${profileFiles.length} ${
                  profileFiles.length === 1
                    ? 'file'
                    : 'files'
                }`}
              />

              <div className="p-5 sm:p-6">
                <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-4 sm:p-5">
                  <ProfileFileList
                    files={profileFiles}
                    canDelete={isOwnProfile}
                    onDeleteComplete={loadProfile}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <SectionHeader
                eyebrow={t('crewCallReputation')}
                title={t('reviews')}
                description={t('reviewsDescriptionProfile')}
              />

              <div className="p-5 sm:p-6">
                <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-4 sm:p-5">
                  <ProfileReviews profileId={profile.id} />
                </div>
              </div>
            </SectionCard>
          </div>

          <aside className="space-y-6">
            {canInviteWorker ? (
              <SidebarCard
                eyebrow={t('companyAction')}
                title={t('inviteWorker')}
                description={t('inviteWorkerDescription')}
              >
                <div className="space-y-3">
                  <select
                    value={selectedInviteJobId}
                    onChange={(event) =>
                      setSelectedInviteJobId(
                        event.target.value
                      )
                    }
                    className="input-dark"
                  >
                    {companyJobs.length === 0 ? (
                      <option value="">
                        {t('noOpenJobsAvailable')}
                      </option>
                    ) : null}

                    {companyJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title || t('untitledJob')} ·{' '}
                        {job.location || t('noLocation')}
                      </option>
                    ))}
                  </select>

                  <PrimaryButton
                    onClick={() => void inviteWorker()}
                    disabled={
                      inviting || !selectedInviteJobId
                    }
                    fullWidth
                  >
                    {inviting
                      ? 'Sending Invite...'
                      : 'Send Invite'}
                  </PrimaryButton>
                </div>
              </SidebarCard>
            ) : null}

            {isOwnProfile && isWorkerProfile ? (
              <SidebarCard
                eyebrow={t('payments')}
                title={t('stripePayouts')}
                description={t('stripePayoutsDescription')}
              >
                <div className="space-y-3">
                  <StatusRow
                    label={t('onboarding')}
                    value={
                      profile.stripe_onboarding_complete
                        ? 'Complete'
                        : 'Not complete'
                    }
                    active={Boolean(
                      profile.stripe_onboarding_complete
                    )}
                  />

                  <StatusRow
                    label={t('charges')}
                    value={
                      profile.stripe_charges_enabled
                        ? 'Enabled'
                        : 'Disabled'
                    }
                    active={Boolean(
                      profile.stripe_charges_enabled
                    )}
                  />

                  <StatusRow
                    label={t('payouts')}
                    value={
                      profile.stripe_payouts_enabled
                        ? 'Enabled'
                        : 'Disabled'
                    }
                    active={Boolean(
                      profile.stripe_payouts_enabled
                    )}
                  />

                  <PrimaryButton
                    onClick={() =>
                      void startStripeOnboarding()
                    }
                    disabled={stripeLoading}
                    fullWidth
                  >
                    {stripeLoading
                      ? 'Opening Stripe...'
                      : profile.stripe_onboarding_complete
                        ? 'Open Stripe Setup'
                        : 'Set Up Stripe'}
                  </PrimaryButton>
                </div>
              </SidebarCard>
            ) : null}

            <SidebarCard
              eyebrow={t('crewCallTrust')}
              title={t('trustScore')}
              description={t('trustScoreDescription')}
            >
              <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-4xl font-black text-white">
                      {completionScore}%
                    </p>

                    <p className="mt-1 text-sm font-semibold text-cyan-100/60">
                      {t('profileCompletion')}
                    </p>
                  </div>

                  <StatusBadge
                    label={
                      completionScore >= 80
                        ? 'Strong'
                        : 'Needs Work'
                    }
                    tone={
                      completionScore >= 80
                        ? 'green'
                        : 'amber'
                    }
                  />
                </div>

                <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-950/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                    style={{
                      width: `${completionScore}%`,
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {trustBadges.map((badge) => (
                  <StatusRow
                    key={badge.label}
                    label={badge.label}
                    value={badge.detail}
                    active={badge.active}
                  />
                ))}
              </div>
            </SidebarCard>

            <SidebarCard
              eyebrow={t('availability')}
              title={t('workStatus')}
              description={t('workStatusDescription')}
            >
              <div className="space-y-3">
                <StatusRow
                  label={t('available')}
                  value={
                    profile.available_for_work
                      ? 'Yes'
                      : 'No'
                  }
                  active={Boolean(
                    profile.available_for_work
                  )}
                />

                <StatusRow
                  label={t('currentlyWorking')}
                  value={
                    profile.currently_working
                      ? 'Yes'
                      : 'No'
                  }
                  active={Boolean(
                    profile.currently_working
                  )}
                />

                <StatusRow
                  label={t('bookedUntilLabel')}
                  value={formatDate(profile.booked_until)}
                  active={Boolean(profile.booked_until)}
                />

                <StatusRow
                  label={t('lastSeenLabel')}
                  value={formatDateTime(profile.last_seen)}
                  active={onlineNow}
                />
              </div>
            </SidebarCard>

            <SidebarCard
              eyebrow={t('atAGlance')}
              title={t('quickDetails')}
              description={t('quickDetailsDescription')}
            >
              <div className="space-y-3">
                <InfoLine
                  label={t('name')}
                  value={profile.full_name}
                />

                <InfoLine
                  label={t('company')}
                  value={profile.company_name}
                />

                <InfoLine
                  label={t('phone')}
                  value={profile.phone}
                />

                <InfoLine
                  label={t('trade')}
                  value={profile.trade}
                />

                <InfoLine
                  label={t('location')}
                  value={
                    [profile.city, profile.state]
                      .filter(Boolean)
                      .join(', ')
                  }
                />

                <InfoLine
                  label={t('experience')}
                  value={profile.years_experience}
                />
              </div>
            </SidebarCard>
          </aside>
        </div>
      </div>

      <style jsx global>{`
        .input-dark {
          min-height: 48px;
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(2, 6, 23, 0.7);
          padding: 0.8rem 1rem;
          color: white;
          font-size: 0.875rem;
          font-weight: 700;
          outline: none;
          transition:
            border-color 150ms ease,
            background-color 150ms ease,
            box-shadow 150ms ease;
        }

        .input-dark::placeholder {
          color: rgb(100 116 139);
        }

        .input-dark:focus {
          border-color: rgba(34, 211, 238, 0.5);
          background: rgba(2, 6, 23, 0.9);
          box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.1);
        }

        .input-dark option {
          background: rgb(15 23 42);
          color: white;
        }
      `}</style>
    </main>
  )
}

function LoadingState() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14">
                <span className="absolute inset-0 animate-ping rounded-2xl bg-cyan-400/20" />

                <span className="absolute inset-0 animate-pulse rounded-2xl bg-cyan-400/15" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                  CrewCall Profile
                </p>

                <p className="mt-1 text-lg font-bold text-white">
                  Loading profile...
                </p>
              </div>
            </div>

            <div className="mt-8 h-80 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.45fr_0.75fr]">
              <div className="h-96 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />

              <div className="h-96 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function SectionCard({
  children,
}: {
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-xl shadow-black/20 backdrop-blur-xl">
      {children}
    </section>
  )
}

function SectionHeader({
  eyebrow,
  title,
  description,
  badge,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  badge?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col justify-between gap-5 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:p-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          {eyebrow}
        </p>

        <h2 className="mt-2 text-2xl font-black text-white">
          {title}
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          {description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {badge ? (
          <span className="rounded-full border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-black text-slate-300">
            {badge}
          </span>
        ) : null}

        {action}
      </div>
    </div>
  )
}

function SidebarCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/20 backdrop-blur-xl sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-2xl font-black text-white">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        {description}
      </p>

      <div className="mt-5">{children}</div>
    </section>
  )
}

function UploadWrapper({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-4">
      {children}
    </div>
  )
}

function HeroStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'cyan' | 'blue' | 'violet' | 'green'
}) {
  const classes = {
    cyan:
      'border-cyan-400/20 bg-cyan-500/10 text-cyan-300',
    blue:
      'border-blue-400/20 bg-blue-500/10 text-blue-300',
    violet:
      'border-violet-400/20 bg-violet-500/10 text-violet-300',
    green:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
  }

  return (
    <div
      className={[
        'rounded-3xl border p-4',
        classes[tone],
      ].join(' ')}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black text-white">
        {value}
      </p>
    </div>
  )
}

function FieldBlock({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-300">
        {label}
      </span>

      {children}
    </label>
  )
}

function ReadOnlyValue({
  value,
}: {
  value: string
}) {
  return (
    <div className="min-h-[48px] rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm font-bold text-slate-300">
      {value}
    </div>
  )
}

function ToggleCard({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/55 p-4 transition hover:border-cyan-400/20">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(event.target.checked)
        }
        className="mt-1 h-4 w-4 accent-cyan-400"
      />

      <span>
        <span className="block text-sm font-black text-white">
          {label}
        </span>

        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>
    </label>
  )
}

function StatusRow({
  label,
  value,
  active,
}: {
  label: string
  value: string
  active: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <div>
        <p className="text-sm font-black text-white">
          {label}
        </p>

        <p className="mt-1 text-xs font-bold text-slate-500">
          {value}
        </p>
      </div>

      <span
        className={[
          'h-3 w-3 shrink-0 rounded-full',
          active ? 'bg-emerald-400' : 'bg-slate-600',
        ].join(' ')}
      />
    </div>
  )
}

function InfoLine({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-black text-white">
        {textValue(value)}
      </p>
    </div>
  )
}

function StatusBadge({
  label,
  tone,
}: {
  label: string
  tone:
    | 'cyan'
    | 'green'
    | 'blue'
    | 'amber'
    | 'slate'
}) {
  const classes = {
    cyan:
      'border-cyan-400/20 bg-cyan-500/10 text-cyan-300',
    green:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
    blue:
      'border-blue-400/20 bg-blue-500/10 text-blue-300',
    amber:
      'border-amber-400/20 bg-amber-500/10 text-amber-300',
    slate:
      'border-white/10 bg-white/[0.055] text-slate-300',
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wider',
        classes[tone],
      ].join(' ')}
    >
      <span
        className={[
          'h-2 w-2 rounded-full',
          tone === 'cyan'
            ? 'bg-cyan-400'
            : tone === 'green'
              ? 'bg-emerald-400'
              : tone === 'blue'
                ? 'bg-blue-400'
                : tone === 'amber'
                  ? 'bg-amber-400'
                  : 'bg-slate-400',
        ].join(' ')}
      />

      {label}
    </span>
  )
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  fullWidth = false,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  fullWidth?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex min-h-11 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50',
        fullWidth ? 'w-full' : '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: NoticeTone
  children: ReactNode
}) {
  const classes = {
    error:
      'border-red-400/20 bg-red-500/10 text-red-200',
    success:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    info:
      'border-blue-400/20 bg-blue-500/10 text-blue-200',
  }

  return (
    <div
      className={[
        'rounded-2xl border p-4 text-sm font-bold',
        classes[tone],
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ProfilePageInner />
    </Suspense>
  )
}