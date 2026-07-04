'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CrewCard } from '@/app/components/CrewCard'
import { CrewButton } from '@/app/components/CrewButton'
import ProfileReviews from '@/app/components/ProfileReviews'
import ProfileFileUpload from '@/app/components/ProfileFileUpload'
import ProfileFileList from '@/app/components/ProfileFileList'

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

  bio: string | null
  availability_status: string | null
  travel_radius: number | null
  expected_pay_min: number | null
  expected_pay_max: number | null
  crewcall_score: number | null
  skills: string[] | null
  osha10: boolean | null
  osha30: boolean | null
  med_gas: boolean | null
  background_verified: boolean | null
  drug_tested: boolean | null
  license_number: string | null
  preferred_work: string[] | null
  willing_to_travel: boolean | null
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
  stripe_payouts_enabled,
  bio,
  availability_status,
  travel_radius,
  expected_pay_min,
  expected_pay_max,
  crewcall_score,
  skills,
  osha10,
  osha30,
  med_gas,
  background_verified,
  drug_tested,
  license_number,
  preferred_work,
  willing_to_travel
`

const DEFAULT_SCORE = 80

const availabilityOptions = [
  'available',
  'available_today',
  'available_tomorrow',
  'weekends_only',
  'busy',
  'not_available',
]

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
    bio: '',
    availability_status: 'available',
    travel_radius: 25,
    expected_pay_min: null,
    expected_pay_max: null,
    crewcall_score: DEFAULT_SCORE,
    skills: [],
    osha10: false,
    osha30: false,
    med_gas: false,
    background_verified: false,
    drug_tested: false,
    license_number: '',
    preferred_work: [],
    willing_to_travel: false,
  }
}

function safeString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  if (Array.isArray(value)) {
    return value.map((item) => safeString(item)).filter(Boolean).join(', ')
  }

  return ''
}

function inputValue(value: unknown) {
  return safeString(value)
}

function textValue(value: unknown) {
  const clean = safeString(value).trim()
  return clean.length > 0 ? clean : 'Not added yet'
}

function numberInputValue(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value)
}

function parseNumber(value: string) {
  const clean = value.trim()

  if (!clean) return null

  const parsed = Number(clean)

  if (Number.isNaN(parsed)) return null

  return parsed
}

function arrayToInput(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.join(', ') : ''
}

function inputToArray(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function cleanStatus(value: string | null | undefined) {
  return safeString(value || 'available').replaceAll('_', ' ')
}

function formatDate(value: unknown) {
  const clean = safeString(value).trim()

  if (!clean) return 'Not set'

  const date = new Date(clean)

  if (Number.isNaN(date.getTime())) return 'Not set'

  return date.toLocaleDateString()
}

function isRecentlyOnline(value: unknown) {
  const clean = safeString(value).trim()

  if (!clean) return false

  const lastSeen = new Date(clean).getTime()

  if (Number.isNaN(lastSeen)) return false

  return Date.now() - lastSeen < 1000 * 60 * 2
}

function ProfilePageInner() {
  const searchParams = useSearchParams()
  const viewedUserId = searchParams.get('user')
  const supabaseAny = supabase as any

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileFiles, setProfileFiles] = useState<ProfileFile[]>([])
  const [companyJobs, setCompanyJobs] = useState<CompanyJob[]>([])
  const [selectedInviteJobId, setSelectedInviteJobId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [message, setMessage] = useState('')

  const isOwnProfile = !viewedUserId || viewedUserId === currentUserId
  const isWorkerProfile = profile?.role === 'worker'

  const canInviteWorker =
    !isOwnProfile &&
    currentProfile?.role === 'company' &&
    profile?.role === 'worker'

  const stripeConnected = Boolean(
    profile?.stripe_charges_enabled && profile?.stripe_payouts_enabled
  )

  const stripeOnboardingComplete = Boolean(
    profile?.stripe_onboarding_complete || stripeConnected
  )

  const profilePhoto = useMemo(
    () => profileFiles.find((file) => file.category === 'profile_photo'),
    [profileFiles]
  )

  const certificationFiles = useMemo(
    () => profileFiles.filter((file) => file.category === 'certification'),
    [profileFiles]
  )

  const licenseFiles = useMemo(
    () => profileFiles.filter((file) => file.category === 'license'),
    [profileFiles]
  )

  const insuranceFiles = useMemo(
    () => profileFiles.filter((file) => file.category === 'insurance'),
    [profileFiles]
  )

  const completionScore = useMemo(() => {
    if (!profile) return 0

    const checks = [
      Boolean(profile.role),
      Boolean(profile.full_name || profile.company_name),
      Boolean(profile.phone),
      Boolean(profile.city),
      Boolean(profile.state),
      Boolean(profile.trade),
      Boolean(profile.years_experience),
      Boolean(profile.bio || profile.job_experience),
      Boolean(profile.skills?.length),
      Boolean(profile.availability_status),
      Boolean(profile.travel_radius),
      Boolean(profile.expected_pay_min || profile.expected_pay_max),
      Boolean(profile.insurance_provider || insuranceFiles.length > 0),
      Boolean(profile.liability_form_signed),
      profileFiles.length > 0,
    ]

    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [profile, profileFiles.length, insuranceFiles.length])

  const crewcallScore = useMemo(() => {
    const base = profile?.crewcall_score || DEFAULT_SCORE
    const profileBonus = Math.round(completionScore * 0.12)
    const fileBonus = Math.min(profileFiles.length * 2, 8)
    const verifiedBonus =
      Number(Boolean(profile?.osha10)) +
      Number(Boolean(profile?.osha30)) +
      Number(Boolean(profile?.med_gas)) +
      Number(Boolean(profile?.background_verified)) +
      Number(Boolean(profile?.drug_tested)) +
      Number(Boolean(profile?.liability_form_signed))

    return Math.min(100, Math.max(0, base + profileBonus + fileBonus + verifiedBonus))
  }, [
    completionScore,
    profile?.background_verified,
    profile?.crewcall_score,
    profile?.drug_tested,
    profile?.liability_form_signed,
    profile?.med_gas,
    profile?.osha10,
    profile?.osha30,
    profileFiles.length,
  ])

  const onlineNow = useMemo(() => {
    return Boolean(profile?.is_online) || isRecentlyOnline(profile?.last_seen)
  }, [profile?.is_online, profile?.last_seen])

  const verificationBadges = useMemo(() => {
    return [
      {
        label: 'Licensed',
        active: Boolean(profile?.license_number) || licenseFiles.length > 0,
      },
      {
        label: 'Insured',
        active: Boolean(profile?.insurance_provider) || insuranceFiles.length > 0,
      },
      {
        label: 'OSHA 10',
        active: Boolean(profile?.osha10),
      },
      {
        label: 'OSHA 30',
        active: Boolean(profile?.osha30),
      },
      {
        label: 'Med Gas',
        active: Boolean(profile?.med_gas),
      },
      {
        label: 'Background',
        active: Boolean(profile?.background_verified),
      },
      {
        label: 'Drug Tested',
        active: Boolean(profile?.drug_tested),
      },
      {
        label: 'Liability',
        active: Boolean(profile?.liability_form_signed),
      },
    ]
  }, [
    insuranceFiles.length,
    licenseFiles.length,
    profile?.background_verified,
    profile?.drug_tested,
    profile?.insurance_provider,
    profile?.liability_form_signed,
    profile?.license_number,
    profile?.med_gas,
    profile?.osha10,
    profile?.osha30,
  ])

  const displayName = textValue(profile?.company_name || profile?.full_name)
  const displayBio = textValue(profile?.bio || profile?.job_experience)
  const skills = profile?.skills || []
  const preferredWork = profile?.preferred_work || []

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setCurrentUserId(null)
      setCurrentProfile(null)
      setProfile(null)
      setMessage('Please log in to view profiles.')
      setLoading(false)
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

    const current = (currentProfileData as Profile | null) || null
    setCurrentProfile(current)

    const profileId = viewedUserId || user.id

    const { data, error } = await supabaseAny
      .from('profiles')
      .select(profileSelect)
      .eq('id', profileId)
      .maybeSingle()

    if (error) setMessage(error.message)

    setProfile(
      (data as Profile | null) ||
        (profileId === user.id ? emptyProfile(user.id) : null)
    )

    const { data: files } = await supabaseAny
      .from('profile_files')
      .select('id,file_name,file_url,file_type,category,created_at')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })

    setProfileFiles((files as ProfileFile[]) || [])

    if (current?.role === 'company') {
      const { data: jobs } = await supabaseAny
        .from('jobs')
        .select('id,title,trade,location,status')
        .eq('company_id', user.id)
        .in('status', ['open', 'assigned'])
        .order('created_at', { ascending: false })

      const loadedJobs = (jobs as CompanyJob[]) || []

      setCompanyJobs(loadedJobs)
      setSelectedInviteJobId((previous) => previous || loadedJobs[0]?.id || '')
    } else {
      setCompanyJobs([])
      setSelectedInviteJobId('')
    }

    setLoading(false)
  }, [supabaseAny, viewedUserId])

  const updateOnlineStatus = useCallback(
    async (isOnline: boolean) => {
      if (!currentUserId) return

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
    loadProfile()
  }, [loadProfile])

  useEffect(() => {
    if (!currentUserId) return

    updateOnlineStatus(true)

    const interval = window.setInterval(() => {
      updateOnlineStatus(true)
    }, 30000)

    const handleFocus = () => {
      updateOnlineStatus(true)
      loadProfile()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateOnlineStatus(true)
        loadProfile()
      } else {
        updateOnlineStatus(false)
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      updateOnlineStatus(false)
    }
  }, [currentUserId, loadProfile, updateOnlineStatus])

  function updateField(
    field: keyof Profile,
    value: string | boolean | null | number | string[]
  ) {
    setProfile((previous) =>
      previous ? { ...previous, [field]: value } : previous
    )
  }

  async function saveProfile() {
    if (!profile || !currentUserId || !isOwnProfile) return

    setSaving(true)
    setMessage('')

    const { error } = await supabaseAny.from('profiles').upsert(
      {
        id: currentUserId,
        role: profile.role,
        full_name: inputValue(profile.full_name).trim() || null,
        company_name: inputValue(profile.company_name).trim() || null,
        phone: inputValue(profile.phone).trim() || null,
        city: inputValue(profile.city).trim() || null,
        state: inputValue(profile.state).trim() || null,
        trade: inputValue(profile.trade).trim() || null,
        years_experience: inputValue(profile.years_experience).trim() || null,
        insurance_provider:
          inputValue(profile.insurance_provider).trim() || null,
        job_experience: inputValue(profile.job_experience).trim() || null,
        liability_form_signed: Boolean(profile.liability_form_signed),
        available_for_work: Boolean(profile.available_for_work),
        currently_working: Boolean(profile.currently_working),
        booked_until: inputValue(profile.booked_until).trim() || null,
        is_online: true,
        last_seen: new Date().toISOString(),

        bio: inputValue(profile.bio).trim() || null,
        availability_status: inputValue(profile.availability_status).trim() || 'available',
        travel_radius: profile.travel_radius || null,
        expected_pay_min: profile.expected_pay_min || null,
        expected_pay_max: profile.expected_pay_max || null,
        crewcall_score: profile.crewcall_score || DEFAULT_SCORE,
        skills: profile.skills || [],
        osha10: Boolean(profile.osha10),
        osha30: Boolean(profile.osha30),
        med_gas: Boolean(profile.med_gas),
        background_verified: Boolean(profile.background_verified),
        drug_tested: Boolean(profile.drug_tested),
        license_number: inputValue(profile.license_number).trim() || null,
        preferred_work: profile.preferred_work || [],
        willing_to_travel: Boolean(profile.willing_to_travel),
      },
      { onConflict: 'id' }
    )

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Profile saved successfully.')
      await loadProfile()
      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    }

    setSaving(false)
  }

  async function inviteWorker() {
    if (!profile || !currentUserId || !selectedInviteJobId) return

    setInviting(true)
    setMessage('')

    const { data: existingInvite } = await supabaseAny
      .from('job_invites')
      .select('id,status')
      .eq('company_id', currentUserId)
      .eq('worker_id', profile.id)
      .eq('job_id', selectedInviteJobId)
      .maybeSingle()

    if (existingInvite) {
      setMessage('This worker already has an invite for that job.')
      setInviting(false)
      return
    }

    const { error } = await supabaseAny.from('job_invites').insert({
      company_id: currentUserId,
      worker_id: profile.id,
      job_id: selectedInviteJobId,
      status: 'pending',
      company_seen: true,
      worker_seen: false,
    })

    if (error) {
      setMessage(error.message)
    } else {
      const selectedJob = companyJobs.find(
        (job) => job.id === selectedInviteJobId
      )

      await supabaseAny.from('notifications').insert({
        user_id: profile.id,
        title: 'New job invite',
        body: `You were invited to ${selectedJob?.title || 'a job'}.`,
        link_url: '/invites',
        read: false,
        is_read: false,
      })

      setMessage('Invite sent successfully.')
      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    }

    setInviting(false)
  }

  async function startStripeOnboarding() {
    if (!currentUserId || !isOwnProfile) return

    setStripeLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        setMessage(result?.error || 'Stripe onboarding could not be started.')
        setStripeLoading(false)
        return
      }

      if (result?.url) {
        window.location.href = result.url
        return
      }

      setMessage('Stripe did not return an onboarding link.')
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Stripe onboarding failed.'
      )
    }

    setStripeLoading(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl">
          <p className="text-lg font-black text-slate-700">
            Loading profile...
          </p>
        </div>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-red-200 bg-red-50 p-8 text-sm font-bold text-red-700 shadow-xl">
          {message || 'Profile not found.'}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-8 text-white sm:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl">
                  {profilePhoto?.file_url ? (
                    <img
                      src={profilePhoto.file_url}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-black">
                      {displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>

                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        onlineNow
                          ? 'bg-emerald-400 text-emerald-950'
                          : 'bg-slate-700 text-slate-100'
                      }`}
                    >
                      {onlineNow ? 'Online now' : 'Offline'}
                    </span>

                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white">
                      {profile.role === 'company'
                        ? 'Company'
                        : profile.role === 'worker'
                          ? 'Worker Passport'
                          : 'Role not set'}
                    </span>

                    {isWorkerProfile && (
                      <span className="rounded-full bg-cyan-400 px-3 py-1 text-xs font-black text-slate-950">
                        CrewCall Score {crewcallScore}
                      </span>
                    )}
                  </div>

                  <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                    {displayName}
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm font-semibold text-slate-200 sm:text-base">
                    {textValue(profile.trade)} ·{' '}
                    {[profile.city, profile.state]
                      .map((item) => inputValue(item).trim())
                      .filter(Boolean)
                      .join(', ') || 'Location not added yet'}
                  </p>

                  {isWorkerProfile && (
                    <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-300">
                      {displayBio}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[420px]">
                <StatCard label="Score" value={String(crewcallScore)} />
                <StatCard
                  label="Experience"
                  value={textValue(profile.years_experience)}
                />
                <StatCard
                  label="Travel"
                  value={
                    profile.travel_radius
                      ? `${profile.travel_radius} mi`
                      : 'Not set'
                  }
                />
                <StatCard
                  label="Rate"
                  value={
                    profile.expected_pay_min || profile.expected_pay_max
                      ? `$${profile.expected_pay_min || '?'}-${
                          profile.expected_pay_max || '?'
                        }`
                      : 'Not set'
                  }
                />
              </div>
            </div>
          </div>

          {message && (
            <div className="border-t border-slate-200 bg-blue-50 px-6 py-4 text-sm font-bold text-blue-900 sm:px-8">
              {message}
            </div>
          )}

          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.4fr_0.8fr]">
            <div className="space-y-6">
              <CrewCard>
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-950">
                      {isOwnProfile ? 'Edit Worker Passport' : 'Worker Passport'}
                    </h2>

                    <p className="text-sm font-semibold text-slate-500">
                      Build a profile companies can trust in 30 seconds.
                    </p>
                  </div>

                  {isOwnProfile && (
                    <CrewButton onClick={saveProfile} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Profile'}
                    </CrewButton>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FieldBlock label="Role">
                    {isOwnProfile ? (
                      <select
                        value={profile.role || ''}
                        onChange={(event) =>
                          updateField('role', event.target.value as Role)
                        }
                        className="input"
                      >
                        <option value="">Select role</option>
                        <option value="worker">Worker</option>
                        <option value="company">Company</option>
                      </select>
                    ) : (
                      <ReadOnlyValue value={profile.role || 'Not added yet'} />
                    )}
                  </FieldBlock>

                  <FieldBlock label="Full Name">
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.full_name)}
                        onChange={(event) =>
                          updateField('full_name', event.target.value)
                        }
                        className="input"
                        placeholder="Your name"
                      />
                    ) : (
                      <ReadOnlyValue value={textValue(profile.full_name)} />
                    )}
                  </FieldBlock>

                  <FieldBlock label="Company Name">
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.company_name)}
                        onChange={(event) =>
                          updateField('company_name', event.target.value)
                        }
                        className="input"
                        placeholder="Company name"
                      />
                    ) : (
                      <ReadOnlyValue value={textValue(profile.company_name)} />
                    )}
                  </FieldBlock>

                  <FieldBlock label="Phone">
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.phone)}
                        onChange={(event) =>
                          updateField('phone', event.target.value)
                        }
                        className="input"
                        placeholder="Phone number"
                      />
                    ) : (
                      <ReadOnlyValue value={textValue(profile.phone)} />
                    )}
                  </FieldBlock>

                  <FieldBlock label="City">
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.city)}
                        onChange={(event) =>
                          updateField('city', event.target.value)
                        }
                        className="input"
                        placeholder="City"
                      />
                    ) : (
                      <ReadOnlyValue value={textValue(profile.city)} />
                    )}
                  </FieldBlock>

                  <FieldBlock label="State">
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.state)}
                        onChange={(event) =>
                          updateField('state', event.target.value)
                        }
                        className="input"
                        placeholder="State"
                      />
                    ) : (
                      <ReadOnlyValue value={textValue(profile.state)} />
                    )}
                  </FieldBlock>

                  <FieldBlock label="Trade">
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.trade)}
                        onChange={(event) =>
                          updateField('trade', event.target.value)
                        }
                        className="input"
                        placeholder="Plumbing, electrical, HVAC..."
                      />
                    ) : (
                      <ReadOnlyValue value={textValue(profile.trade)} />
                    )}
                  </FieldBlock>

                  <FieldBlock label="Years Experience">
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.years_experience)}
                        onChange={(event) =>
                          updateField('years_experience', event.target.value)
                        }
                        className="input"
                        placeholder="Example: 8 years"
                      />
                    ) : (
                      <ReadOnlyValue
                        value={textValue(profile.years_experience)}
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label="Availability">
                    {isOwnProfile ? (
                      <select
                        value={profile.availability_status || 'available'}
                        onChange={(event) =>
                          updateField('availability_status', event.target.value)
                        }
                        className="input"
                      >
                        {availabilityOptions.map((option) => (
                          <option key={option} value={option}>
                            {cleanStatus(option)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <ReadOnlyValue
                        value={cleanStatus(profile.availability_status)}
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label="Travel Radius">
                    {isOwnProfile ? (
                      <input
                        type="number"
                        value={numberInputValue(profile.travel_radius)}
                        onChange={(event) =>
                          updateField('travel_radius', parseNumber(event.target.value))
                        }
                        className="input"
                        placeholder="25"
                      />
                    ) : (
                      <ReadOnlyValue
                        value={
                          profile.travel_radius
                            ? `${profile.travel_radius} miles`
                            : 'Not added yet'
                        }
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label="Expected Pay Min">
                    {isOwnProfile ? (
                      <input
                        type="number"
                        value={numberInputValue(profile.expected_pay_min)}
                        onChange={(event) =>
                          updateField(
                            'expected_pay_min',
                            parseNumber(event.target.value)
                          )
                        }
                        className="input"
                        placeholder="40"
                      />
                    ) : (
                      <ReadOnlyValue
                        value={
                          profile.expected_pay_min
                            ? `$${profile.expected_pay_min}/hr`
                            : 'Not added yet'
                        }
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label="Expected Pay Max">
                    {isOwnProfile ? (
                      <input
                        type="number"
                        value={numberInputValue(profile.expected_pay_max)}
                        onChange={(event) =>
                          updateField(
                            'expected_pay_max',
                            parseNumber(event.target.value)
                          )
                        }
                        className="input"
                        placeholder="55"
                      />
                    ) : (
                      <ReadOnlyValue
                        value={
                          profile.expected_pay_max
                            ? `$${profile.expected_pay_max}/hr`
                            : 'Not added yet'
                        }
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label="License Number">
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.license_number)}
                        onChange={(event) =>
                          updateField('license_number', event.target.value)
                        }
                        className="input"
                        placeholder="License number"
                      />
                    ) : (
                      <ReadOnlyValue value={textValue(profile.license_number)} />
                    )}
                  </FieldBlock>

                  <FieldBlock label="Insurance Provider">
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.insurance_provider)}
                        onChange={(event) =>
                          updateField('insurance_provider', event.target.value)
                        }
                        className="input"
                        placeholder="Insurance provider"
                      />
                    ) : (
                      <ReadOnlyValue
                        value={textValue(profile.insurance_provider)}
                      />
                    )}
                  </FieldBlock>
                </div>

                <div className="mt-4">
                  <FieldBlock label="About Me">
                    {isOwnProfile ? (
                      <textarea
                        value={inputValue(profile.bio || profile.job_experience)}
                        onChange={(event) => {
                          updateField('bio', event.target.value)
                          updateField('job_experience', event.target.value)
                        }}
                        className="input min-h-32"
                        placeholder="Example: Licensed journeyman plumber specializing in commercial rough-ins, service work, hospitals, schools, and tenant improvements."
                      />
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
                        {displayBio}
                      </div>
                    )}
                  </FieldBlock>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FieldBlock label="Skills">
                    {isOwnProfile ? (
                      <textarea
                        value={arrayToInput(profile.skills)}
                        onChange={(event) =>
                          updateField('skills', inputToArray(event.target.value))
                        }
                        className="input min-h-24"
                        placeholder="Commercial, Service, Underground, Copper, Cast Iron"
                      />
                    ) : (
                      <ChipList items={skills} empty="No skills added yet" />
                    )}
                  </FieldBlock>

                  <FieldBlock label="Preferred Work">
                    {isOwnProfile ? (
                      <textarea
                        value={arrayToInput(profile.preferred_work)}
                        onChange={(event) =>
                          updateField(
                            'preferred_work',
                            inputToArray(event.target.value)
                          )
                        }
                        className="input min-h-24"
                        placeholder="Commercial, Piece work, Emergency, Travel, Shutdowns"
                      />
                    ) : (
                      <ChipList
                        items={preferredWork}
                        empty="No preferred work added yet"
                      />
                    )}
                  </FieldBlock>
                </div>

                {isOwnProfile && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <CheckBoxField
                      label="Liability signed"
                      checked={Boolean(profile.liability_form_signed)}
                      onChange={(checked) =>
                        updateField('liability_form_signed', checked)
                      }
                    />

                    <CheckBoxField
                      label="Available"
                      checked={Boolean(profile.available_for_work)}
                      onChange={(checked) =>
                        updateField('available_for_work', checked)
                      }
                    />

                    <CheckBoxField
                      label="Currently working"
                      checked={Boolean(profile.currently_working)}
                      onChange={(checked) =>
                        updateField('currently_working', checked)
                      }
                    />

                    <CheckBoxField
                      label="Willing to travel"
                      checked={Boolean(profile.willing_to_travel)}
                      onChange={(checked) =>
                        updateField('willing_to_travel', checked)
                      }
                    />

                    <CheckBoxField
                      label="OSHA 10"
                      checked={Boolean(profile.osha10)}
                      onChange={(checked) => updateField('osha10', checked)}
                    />

                    <CheckBoxField
                      label="OSHA 30"
                      checked={Boolean(profile.osha30)}
                      onChange={(checked) => updateField('osha30', checked)}
                    />

                    <CheckBoxField
                      label="Med Gas"
                      checked={Boolean(profile.med_gas)}
                      onChange={(checked) => updateField('med_gas', checked)}
                    />

                    <CheckBoxField
                      label="Drug Tested"
                      checked={Boolean(profile.drug_tested)}
                      onChange={(checked) => updateField('drug_tested', checked)}
                    />
                  </div>
                )}
              </CrewCard>

              <CrewCard>
                <div className="mb-5">
                  <h2 className="text-2xl font-black text-slate-950">
                    Skills & Preferred Work
                  </h2>

                  <p className="text-sm font-semibold text-slate-500">
                    Companies can quickly see what kind of work fits you best.
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <p className="mb-3 text-sm font-black text-slate-700">
                      Skills
                    </p>
                    <ChipList items={skills} empty="No skills added yet" />
                  </div>

                  <div>
                    <p className="mb-3 text-sm font-black text-slate-700">
                      Preferred Work
                    </p>
                    <ChipList
                      items={preferredWork}
                      empty="No preferred work added yet"
                    />
                  </div>
                </div>
              </CrewCard>

              {isOwnProfile && (
                <CrewCard>
                  <div className="mb-5">
                    <h2 className="text-2xl font-black text-slate-950">
                      Profile Files
                    </h2>

                    <p className="text-sm font-semibold text-slate-500">
                      Upload your photo, licenses, certifications, and insurance.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <ProfileFileUpload
                      userId={profile.id}
                      category="profile_photo"
                      label="Profile Photo"
                      description="Upload a clear photo or company logo."
                      accept="image/*"
                      onUploadComplete={loadProfile}
                    />

                    <ProfileFileUpload
                      userId={profile.id}
                      category="license"
                      label="License"
                      description="Upload trade licenses or cards."
                      accept="image/*,.pdf"
                      onUploadComplete={loadProfile}
                    />

                    <ProfileFileUpload
                      userId={profile.id}
                      category="certification"
                      label="Certification"
                      description="Upload safety cards, certifications, or training docs."
                      accept="image/*,.pdf"
                      onUploadComplete={loadProfile}
                    />

                    <ProfileFileUpload
                      userId={profile.id}
                      category="insurance"
                      label="Insurance"
                      description="Upload insurance documents."
                      accept="image/*,.pdf"
                      onUploadComplete={loadProfile}
                    />
                  </div>
                </CrewCard>
              )}

              <CrewCard>
                <div className="mb-5">
                  <h2 className="text-2xl font-black text-slate-950">
                    Uploaded Documents
                  </h2>

                  <p className="text-sm font-semibold text-slate-500">
                    Licenses, insurance, certifications, and profile documents.
                  </p>
                </div>

                <ProfileFileList
                  files={profileFiles}
                  canDelete={isOwnProfile}
                  onDeleteComplete={loadProfile}
                />
              </CrewCard>

              <CrewCard>
                <ProfileReviews profileId={profile.id} />
              </CrewCard>
            </div>

            <aside className="space-y-6">
              {canInviteWorker && (
                <CrewCard>
                  <h2 className="text-2xl font-black text-slate-950">
                    Invite Worker
                  </h2>

                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    Send this worker an invite to one of your open jobs.
                  </p>

                  <div className="mt-5 space-y-3">
                    <select
                      value={selectedInviteJobId}
                      onChange={(event) =>
                        setSelectedInviteJobId(event.target.value)
                      }
                      className="input"
                    >
                      {companyJobs.length === 0 && (
                        <option value="">No open jobs available</option>
                      )}

                      {companyJobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title || 'Untitled job'} ·{' '}
                          {job.location || 'No location'}
                        </option>
                      ))}
                    </select>

                    <CrewButton
                      onClick={inviteWorker}
                      disabled={inviting || !selectedInviteJobId}
                      fullWidth
                    >
                      {inviting ? 'Sending Invite...' : 'Send Invite'}
                    </CrewButton>
                  </div>
                </CrewCard>
              )}

              {isOwnProfile && isWorkerProfile && (
                <CrewCard>
                  <h2 className="text-2xl font-black text-slate-950">
                    Stripe Payouts
                  </h2>

                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    Connect Stripe so companies can pay you through CrewCall.
                  </p>

                  <div className="mt-5 space-y-3">
                    {stripeConnected && (
                      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-center">
                        <div className="text-lg font-black text-emerald-700">
                          ✅ Stripe Connected
                        </div>

                        <div className="mt-1 text-sm font-semibold text-emerald-600">
                          Your account is ready to receive payouts.
                        </div>
                      </div>
                    )}

                    <StatusRow
                      label="Onboarding"
                      value={stripeOnboardingComplete ? 'Complete' : 'Not complete'}
                      active={stripeOnboardingComplete}
                    />

                    <StatusRow
                      label="Charges"
                      value={
                        profile.stripe_charges_enabled ? 'Enabled' : 'Disabled'
                      }
                      active={Boolean(profile.stripe_charges_enabled)}
                    />

                    <StatusRow
                      label="Payouts"
                      value={
                        profile.stripe_payouts_enabled ? 'Enabled' : 'Disabled'
                      }
                      active={Boolean(profile.stripe_payouts_enabled)}
                    />

                    <CrewButton
                      onClick={startStripeOnboarding}
                      disabled={stripeLoading}
                      fullWidth
                    >
                      {stripeLoading
                        ? 'Opening Stripe...'
                        : stripeConnected
                          ? 'Manage Stripe Account'
                          : 'Set Up Stripe'}
                    </CrewButton>
                  </div>
                </CrewCard>
              )}

              <CrewCard>
                <h2 className="text-2xl font-black text-slate-950">
                  CrewCall Score
                </h2>

                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Early trust score based on profile strength and verification.
                </p>

                <div className="mt-5 rounded-[2rem] bg-gradient-to-br from-slate-950 to-blue-950 p-6 text-center text-white">
                  <div className="text-6xl font-black">{crewcallScore}</div>
                  <div className="mt-2 text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
                    Professional Score
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-sm font-black">
                    <span>{completionScore}% complete</span>
                    <span>{crewcallScore >= 90 ? 'Strong' : 'Building'}</span>
                  </div>

                  <div className="h-4 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: `${completionScore}%` }}
                    />
                  </div>
                </div>
              </CrewCard>

              <CrewCard>
                <h2 className="text-2xl font-black text-slate-950">
                  Verification
                </h2>

                <div className="mt-5 grid gap-3">
                  {verificationBadges.map((badge) => (
                    <StatusRow
                      key={badge.label}
                      label={badge.label}
                      value={badge.active ? 'Added' : 'Missing'}
                      active={badge.active}
                    />
                  ))}
                </div>
              </CrewCard>

              <CrewCard>
                <h2 className="text-2xl font-black text-slate-950">
                  Work Status
                </h2>

                <div className="mt-5 space-y-3">
                  <StatusRow
                    label="Availability"
                    value={cleanStatus(profile.availability_status)}
                    active={Boolean(profile.available_for_work)}
                  />

                  <StatusRow
                    label="Currently Working"
                    value={profile.currently_working ? 'Yes' : 'No'}
                    active={Boolean(profile.currently_working)}
                  />

                  <StatusRow
                    label="Willing to Travel"
                    value={profile.willing_to_travel ? 'Yes' : 'No'}
                    active={Boolean(profile.willing_to_travel)}
                  />

                  <StatusRow
                    label="Booked Until"
                    value={formatDate(profile.booked_until)}
                    active={Boolean(profile.booked_until)}
                  />

                  <StatusRow
                    label="Last Seen"
                    value={
                      profile.last_seen
                        ? new Date(inputValue(profile.last_seen)).toLocaleString()
                        : 'Not available'
                    }
                    active={onlineNow}
                  />
                </div>
              </CrewCard>

              <CrewCard>
                <h2 className="text-2xl font-black text-slate-950">
                  Quick Details
                </h2>

                <div className="mt-5 space-y-3">
                  <InfoLine label="Name" value={profile.full_name} />
                  <InfoLine label="Company" value={profile.company_name} />
                  <InfoLine label="Phone" value={profile.phone} />
                  <InfoLine label="Trade" value={profile.trade} />
                  <InfoLine
                    label="Location"
                    value={[profile.city, profile.state]
                      .map((item) => inputValue(item).trim())
                      .filter(Boolean)
                      .join(', ')}
                  />
                  <InfoLine
                    label="Experience"
                    value={profile.years_experience}
                  />
                  <InfoLine
                    label="Expected Pay"
                    value={
                      profile.expected_pay_min || profile.expected_pay_max
                        ? `$${profile.expected_pay_min || '?'}-${
                            profile.expected_pay_max || '?'
                          }/hr`
                        : ''
                    }
                  />
                  <InfoLine
                    label="Travel Radius"
                    value={
                      profile.travel_radius
                        ? `${profile.travel_radius} miles`
                        : ''
                    }
                  />
                </div>
              </CrewCard>
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white shadow-xl backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-slate-300">
        {label}
      </p>

      <p className="mt-1 text-2xl font-black">{value}</p>
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
      <span className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </span>

      {children}
    </label>
  )
}

function ReadOnlyValue({ value }: { value: string }) {
  return (
    <div className="min-h-[48px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
      {value}
    </div>
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
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-sm font-black text-slate-900">{label}</p>

        <p className="text-xs font-bold text-slate-500">{value}</p>
      </div>

      <span
        className={`h-3 w-3 shrink-0 rounded-full ${
          active ? 'bg-emerald-500' : 'bg-slate-300'
        }`}
      />
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-black text-slate-900">
        {textValue(value)}
      </p>
    </div>
  )
}

function ChipList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">
        {empty}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700"
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function CheckBoxField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  )
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 px-4 py-8">
          <div className="mx-auto max-w-6xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl">
            <p className="text-lg font-black text-slate-700">
              Loading profile...
            </p>
          </div>
        </main>
      }
    >
      <ProfilePageInner />
    </Suspense>
  )
}