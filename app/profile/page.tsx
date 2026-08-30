'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
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

  return Date.now() - lastSeen < 90_000
}

function ProfilePageInner() {
  const t = useTranslations('Profile')
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
const [skillsText, setSkillsText] = useState('')
const [preferredWorkText, setPreferredWorkText] = useState('')

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
    return Boolean(profile?.is_online) && isRecentlyOnline(profile?.last_seen)
  }, [profile?.is_online, profile?.last_seen])

  const verificationBadges = useMemo(() => {
    return [
      {
        label: t('licensed'),
        active: Boolean(profile?.license_number) || licenseFiles.length > 0,
      },
      {
        label: t('insured'),
        active: Boolean(profile?.insurance_provider) || insuranceFiles.length > 0,
      },
      {
        label: t('osha10'),
        active: Boolean(profile?.osha10),
      },
      {
        label: t('osha30'),
        active: Boolean(profile?.osha30),
      },
      {
        label: t('medGas'),
        active: Boolean(profile?.med_gas),
      },
      {
        label: t('background'),
        active: Boolean(profile?.background_verified),
      },
      {
        label: t('drugTested'),
        active: Boolean(profile?.drug_tested),
      },
      {
        label: t('liability'),
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

    const loadedProfile =
      (data as Profile | null) ||
      (profileId === user.id ? emptyProfile(user.id) : null)

    setProfile(loadedProfile)

    if (loadedProfile) {
      setSkillsText(arrayToInput(loadedProfile.skills))
      setPreferredWorkText(arrayToInput(loadedProfile.preferred_work))
    }

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

  const loadProfileFiles = useCallback(async () => {
    if (!currentUserId) return

    const profileId = viewedUserId || currentUserId

    const { data: files, error } = await supabaseAny
      .from('profile_files')
      .select('id,file_name,file_url,file_type,category,created_at')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      return
    }

    setProfileFiles((files as ProfileFile[]) || [])
  }, [currentUserId, supabaseAny, viewedUserId])

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
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateOnlineStatus(true)
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
  }, [currentUserId, updateOnlineStatus])

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
        body: JSON.stringify({
          userId: currentUserId,
          email: (await supabase.auth.getUser()).data.user?.email,
        }),
      })

      const text = await response.text()

      const result = text
        ? JSON.parse(text)
        : {}

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
    <main className="min-h-screen bg-slate-50 px-2 py-3 pb-32 text-slate-950 sm:px-4 sm:py-8 sm:pb-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:gap-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:rounded-[2rem]">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-5 text-white sm:px-8 sm:py-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-2xl sm:h-28 sm:w-28 sm:rounded-[2rem]">
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
                        ? t('company')
                        : profile.role === 'worker'
                          ? t('workerPassport')
                          : 'Role not set'}
                    </span>

                    {isWorkerProfile && (
                      <span className="rounded-full bg-cyan-400 px-3 py-1 text-xs font-black text-slate-950">
                        CrewCall Score {crewcallScore}
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl font-black tracking-tight sm:text-5xl">
                    {displayName}
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm font-semibold text-slate-200 sm:text-base">
                    {textValue(profile.trade)} ·{' '}
                    {[profile.city, profile.state]
                      .map((item) => inputValue(item).trim())
                      .filter(Boolean)
                      .join(', ') || t('locationNotAdded')}
                  </p>

                  {isWorkerProfile && (
                    <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-300">
                      {displayBio}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:min-w-[420px]">
                <StatCard label={t('score')} value={String(crewcallScore)} />
                <StatCard
                  label={t('experience')}
                  value={textValue(profile.years_experience)}
                />
                <StatCard
                  label={t('travel')}
                  value={
                    profile.travel_radius
                      ? `${profile.travel_radius} mi`
                      : 'Not set'
                  }
                />
                <StatCard
                  label={t('rate')}
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

          <div className="grid gap-4 p-3 pb-8 sm:gap-6 sm:p-8 lg:grid-cols-[1.4fr_0.8fr]">
            <div className="space-y-4 sm:space-y-6">
              <CrewCard>
                <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-950 sm:text-2xl">
                      {isOwnProfile ? t('editWorkerPassport') : t('workerPassport')}
                    </h2>

                    <p className="text-sm font-semibold text-slate-500">
                      Build a profile companies can trust in 30 seconds.
                    </p>
                  </div>

                  {isOwnProfile && (
                    <div className="hidden sm:block">
                      <CrewButton onClick={saveProfile} disabled={saving}>
                        {saving ? t('saving') : t('saveProfile')}
                      </CrewButton>
                    </div>
                  )}
                </div>

                <div className="grid gap-2.5 sm:gap-4 md:grid-cols-2">
                  <FieldBlock label={t('fullName')}>
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.full_name)}
                        onChange={(event) =>
                          updateField('full_name', event.target.value)
                        }
                        className="input min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-[48px] sm:rounded-2xl sm:px-4 sm:py-3"
                        placeholder={t('yourName')}
                      />
                    ) : (
                      <ReadOnlyValue value={textValue(profile.full_name)} />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('currentCompany')}>
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.company_name)}
                        onChange={(event) =>
                          updateField('company_name', event.target.value)
                        }
                        className="input min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-[48px] sm:rounded-2xl sm:px-4 sm:py-3"
                        placeholder={t('companyName')}
                      />
                    ) : (
                      <ReadOnlyValue value={textValue(profile.company_name)} />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('phone')}>
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.phone)}
                        onChange={(event) =>
                          updateField('phone', event.target.value)
                        }
                        className="input min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-[48px] sm:rounded-2xl sm:px-4 sm:py-3"
                        placeholder={t('phoneNumber')}
                      />
                    ) : (
                      <ReadOnlyValue value={textValue(profile.phone)} />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('city')}>
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.city)}
                        onChange={(event) =>
                          updateField('city', event.target.value)
                        }
                        className="input min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-[48px] sm:rounded-2xl sm:px-4 sm:py-3"
                        placeholder={t('city')}
                      />
                    ) : (
                      <ReadOnlyValue value={textValue(profile.city)} />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('state')}>
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.state)}
                        onChange={(event) =>
                          updateField('state', event.target.value)
                        }
                        className="input min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-[48px] sm:rounded-2xl sm:px-4 sm:py-3"
                        placeholder={t('state')}
                      />
                    ) : (
                      <ReadOnlyValue value={textValue(profile.state)} />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('trade')}>
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.trade)}
                        onChange={(event) =>
                          updateField('trade', event.target.value)
                        }
                        className="input min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-[48px] sm:rounded-2xl sm:px-4 sm:py-3"
                        placeholder="Plumbing, electrical, HVAC..."
                      />
                    ) : (
                      <ReadOnlyValue value={textValue(profile.trade)} />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('yearsExperience')}>
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.years_experience)}
                        onChange={(event) =>
                          updateField('years_experience', event.target.value)
                        }
                        className="input min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-[48px] sm:rounded-2xl sm:px-4 sm:py-3"
                        placeholder="Example: 8 years"
                      />
                    ) : (
                      <ReadOnlyValue
                        value={textValue(profile.years_experience)}
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('travelRadius')}>
                    {isOwnProfile ? (
                      <input
                        type="number"
                        value={numberInputValue(profile.travel_radius)}
                        onChange={(event) =>
                          updateField('travel_radius', parseNumber(event.target.value))
                        }
                        className="input min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-[48px] sm:rounded-2xl sm:px-4 sm:py-3"
                        placeholder="25"
                      />
                    ) : (
                      <ReadOnlyValue
                        value={
                          profile.travel_radius
                            ? t('miles', { count: profile.travel_radius })
                            : t('notAddedYet')
                        }
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('expectedPayMin')}>
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
                        className="input min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-[48px] sm:rounded-2xl sm:px-4 sm:py-3"
                        placeholder="40"
                      />
                    ) : (
                      <ReadOnlyValue
                        value={
                          profile.expected_pay_min
                            ? `$${profile.expected_pay_min}/hr`
                            : t('notAddedYet')
                        }
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('expectedPayMax')}>
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
                        className="input min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-[48px] sm:rounded-2xl sm:px-4 sm:py-3"
                        placeholder="55"
                      />
                    ) : (
                      <ReadOnlyValue
                        value={
                          profile.expected_pay_max
                            ? `$${profile.expected_pay_max}/hr`
                            : t('notAddedYet')
                        }
                      />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('licenseNumber')}>
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.license_number)}
                        onChange={(event) =>
                          updateField('license_number', event.target.value)
                        }
                        className="input min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-[48px] sm:rounded-2xl sm:px-4 sm:py-3"
                        placeholder={t('licenseNumber')}
                      />
                    ) : (
                      <ReadOnlyValue value={textValue(profile.license_number)} />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('insuranceProvider')}>
                    {isOwnProfile ? (
                      <input
                        value={inputValue(profile.insurance_provider)}
                        onChange={(event) =>
                          updateField('insurance_provider', event.target.value)
                        }
                        className="input min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-[48px] sm:rounded-2xl sm:px-4 sm:py-3"
                        placeholder={t('insuranceProvider')}
                      />
                    ) : (
                      <ReadOnlyValue
                        value={textValue(profile.insurance_provider)}
                      />
                    )}
                  </FieldBlock>
                </div>

                <div className="mt-4">
                  <FieldBlock label={t('aboutMe')}>
                    {isOwnProfile ? (
                      <textarea
                        value={inputValue(profile.bio || profile.job_experience)}
                        onChange={(event) => {
                          updateField('bio', event.target.value)
                          updateField('job_experience', event.target.value)
                        }}
                        className="input min-h-24 sm:min-h-32"
                        placeholder={t('aboutMePlaceholder')}
                      />
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
                        {displayBio}
                      </div>
                    )}
                  </FieldBlock>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FieldBlock label={t('skills')}>
                    {isOwnProfile ? (
                      <textarea
                        value={skillsText}
                        onChange={(event) => {
                          setSkillsText(event.target.value)
                          updateField('skills', inputToArray(event.target.value))
                        }}
                        className="input min-h-20 sm:min-h-24"
                        placeholder="Example: Commercial plumbing, Service work, Copper, PVC, Cast Iron"
                      />
                    ) : (
                      <ChipList items={skills} empty="No skills added yet" />
                    )}
                  </FieldBlock>

                  <FieldBlock label={t('preferredWork')}>
                    {isOwnProfile ? (
                      <textarea
                        value={preferredWorkText}
                        onChange={(event) => {
                          setPreferredWorkText(event.target.value)
                          updateField(
                            'preferred_work',
                            inputToArray(event.target.value)
                          )
                        }}
                        className="input min-h-20 sm:min-h-24"
                        placeholder="Example: Commercial rough-ins, Service calls, Hospitals, Shutdowns"
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
                  <>
                    <div className="mt-4 hidden sm:block">
                      <CrewButton
                        onClick={saveProfile}
                        disabled={saving}
                        fullWidth
                      >
                        {saving ? t('saving') : t('saveProfile')}
                      </CrewButton>
                    </div>

                  </>
                )}

              </CrewCard>


              {isOwnProfile ? (
                <CrewCard>
                  <div className="mb-3 sm:mb-6">
                    <h2 className="text-xl font-black text-slate-950 sm:text-2xl">
                      {t('profileFiles')}
                    </h2>

                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {t('profileFilesDescription')}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                    <ProfileFileUpload
                      userId={profile.id}
                      category="profile_photo"
                      label={t('profilePhoto')}
                      description={t('profilePhotoDescription')}
                      accept="image/*"
                      onUploadComplete={loadProfileFiles}
                    />

                    <ProfileFileUpload
                      userId={profile.id}
                      category="license"
                      label={t('license')}
                      description={t('licenseDescription')}
                      accept="image/*,.pdf"
                      onUploadComplete={loadProfileFiles}
                    />

                    <ProfileFileUpload
                      userId={profile.id}
                      category="certification"
                      label={t('certification')}
                      description={t('certificationDescription')}
                      accept="image/*,.pdf"
                      onUploadComplete={loadProfileFiles}
                    />

                    <ProfileFileUpload
                      userId={profile.id}
                      category="insurance"
                      label={t('insurance')}
                      description={t('insuranceDescription')}
                      accept="image/*,.pdf"
                      onUploadComplete={loadProfileFiles}
                    />
                  </div>

                  <div className="mt-4 border-t border-slate-200 pt-3 sm:mt-8 sm:pt-6">
                    <h3 className="text-lg font-black text-slate-950">
                      {t('uploadedDocuments')}
                    </h3>

                    <p className="mt-1 mb-3 text-sm font-semibold text-slate-500">
                      {t('uploadedDocumentsDescription')}
                    </p>

                    <ProfileFileList
                      files={profileFiles}
                      canDelete
                      onDeleteComplete={loadProfileFiles}
                    />
                  </div>
                </CrewCard>
              ) : (
                <CrewCard>
                  <div className="mb-5">
                    <h2 className="text-2xl font-black text-slate-950">
                      Documents
                    </h2>

                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Licenses, insurance, certifications, and profile documents.
                    </p>
                  </div>

                  <ProfileFileList
                    files={profileFiles}
                    canDelete={false}
                    onDeleteComplete={loadProfileFiles}
                  />
                </CrewCard>
              )}

              <CrewCard>
                <ProfileReviews profileId={profile.id} />
              </CrewCard>
            </div>

            <aside className="space-y-4 sm:space-y-6">
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
                      className="input min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-[48px] sm:rounded-2xl sm:px-4 sm:py-3"
                    >
                      {companyJobs.length === 0 && (
                        <option value="">{t('noOpenJobsAvailable')}</option>
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
                    {t('stripePayouts')}
                  </h2>

                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    {t('stripePayoutsDescription')}
                  </p>

                  <div className="mt-5 space-y-3">
                    {stripeConnected && (
                      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-center">
                        <div className="text-lg font-black text-emerald-700">
                          ✅ {t('stripeConnected')}
                        </div>

                        <div className="mt-1 text-sm font-semibold text-emerald-600">
                          {t('stripeReady')}
                        </div>
                      </div>
                    )}

                    <StatusRow
                      label={t('onboarding')}
                      value={stripeOnboardingComplete ? t('complete') : t('notComplete')}
                      active={stripeOnboardingComplete}
                    />

                    <StatusRow
                      label={t('charges')}
                      value={
                        profile.stripe_charges_enabled ? t('enabled') : t('disabled')
                      }
                      active={Boolean(profile.stripe_charges_enabled)}
                    />

                    <StatusRow
                      label={t('payouts')}
                      value={
                        profile.stripe_payouts_enabled ? t('enabled') : t('disabled')
                      }
                      active={Boolean(profile.stripe_payouts_enabled)}
                    />

                    <CrewButton
                      onClick={startStripeOnboarding}
                      disabled={stripeLoading}
                      fullWidth
                    >
                      {stripeLoading
                        ? t('openingStripe')
                        : stripeConnected
                          ? t('manageStripeAccount')
                          : t('setUpStripe')}
                    </CrewButton>
                  </div>
                </CrewCard>
              )}


              <CrewCard>
                <h2 className="text-2xl font-black text-slate-950">
                  {t('verification')}
                </h2>

                <p className="mt-2 text-sm font-semibold text-slate-500">
                  {t('verificationDescription')}
                </p>

                <div className="mt-5 space-y-3">
                  <StatusRow
                    label={t('licensed')}
                    value={
                      Boolean(profile.license_number) || licenseFiles.length > 0
                        ? 'Added'
                        : 'Missing'
                    }
                    active={
                      Boolean(profile.license_number) || licenseFiles.length > 0
                    }
                  />

                  <StatusRow
                    label={t('insured')}
                    value={
                      Boolean(profile.insurance_provider) || insuranceFiles.length > 0
                        ? 'Added'
                        : 'Missing'
                    }
                    active={
                      Boolean(profile.insurance_provider) || insuranceFiles.length > 0
                    }
                  />

                  {isOwnProfile ? (
                    <>
                      {[
                        [t('osha10'), 'osha10'],
                        [t('osha30'), 'osha30'],
                        [t('medGas'), 'med_gas'],
                        [t('background'), 'background_verified'],
                        [t('drugTested'), 'drug_tested'],
                        [t('liability'), 'liability_form_signed'],
                      ].map(([label, field]) => (
                        <label
                          key={field}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:gap-4 sm:rounded-2xl sm:p-4"
                        >
                          <span className="text-sm font-black text-slate-700">
                            {label}
                          </span>

                          <input
                            type="checkbox"
                            checked={Boolean(profile[field as keyof Profile])}
                            onChange={(event) =>
                              updateField(
                                field as keyof Profile,
                                event.target.checked as never
                              )
                            }
                            className="h-5 w-5 shrink-0 accent-blue-600"
                            style={{ width: '20px' }}
                          />
                        </label>
                      ))}

                      <CrewButton
                        onClick={saveProfile}
                        disabled={saving}
                        fullWidth
                      >
                        {saving ? t('saving') : t('updateVerification')}
                      </CrewButton>
                    </>
                  ) : (
                    <>
                      {verificationBadges.slice(2).map((badge) => (
                        <StatusRow
                          key={badge.label}
                          label={badge.label}
                          value={badge.active ? t('added') : t('missing')}
                          active={badge.active}
                        />
                      ))}
                    </>
                  )}
                </div>
              </CrewCard>

              <CrewCard>
                <h2 className="text-2xl font-black text-slate-950">
                  Work Status
                </h2>

                <p className="mt-2 text-sm font-semibold text-slate-500">
                  {t('workStatusDescription')}
                </p>

                <div className="mt-5 space-y-4">
                  {isOwnProfile ? (
                    <>
                      <FieldBlock label={t('availability')}>
                        <select
                          value={profile.availability_status || 'available'}
                          onChange={(event) => {
                            const value = event.target.value
                            updateField('availability_status', value)
                            updateField(
                              'available_for_work',
                              value !== 'busy' && value !== 'not_available'
                            )
                          }}
                          className="input min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-[48px] sm:rounded-2xl sm:px-4 sm:py-3"
                        >
                          {availabilityOptions.map((option) => (
                            <option key={option} value={option}>
                              {cleanStatus(option)}
                            </option>
                          ))}
                        </select>
                      </FieldBlock>

                      <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:gap-4 sm:rounded-2xl sm:p-4">
                        <span className="text-sm font-black text-slate-700">
                          {t('currentlyWorking')}
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(profile.currently_working)}
                          onChange={(event) =>
                            updateField('currently_working', event.target.checked)
                          }
                          className="h-5 w-5 shrink-0 accent-blue-600"
                          style={{ width: '20px' }}
                        />
                      </label>

                      <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:gap-4 sm:rounded-2xl sm:p-4">
                        <span className="text-sm font-black text-slate-700">
                          {t('willingToTravel')}
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(profile.willing_to_travel)}
                          onChange={(event) =>
                            updateField('willing_to_travel', event.target.checked)
                          }
                          className="h-5 w-5 shrink-0 accent-blue-600"
                          style={{ width: '20px' }}
                        />
                      </label>

                      <FieldBlock label={t('bookedUntil')}>
                        <input
                          type="date"
                          value={
                            profile.booked_until
                              ? inputValue(profile.booked_until).slice(0, 10)
                              : ''
                          }
                          onChange={(event) =>
                            updateField(
                              'booked_until',
                              event.target.value || null
                            )
                          }
                          className="input min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-[48px] sm:rounded-2xl sm:px-4 sm:py-3"
                        />
                      </FieldBlock>

                      <CrewButton
                        onClick={saveProfile}
                        disabled={saving}
                        fullWidth
                      >
                        {saving ? t('saving') : t('updateWorkStatus')}
                      </CrewButton>
                    </>
                  ) : (
                    <>
                      <StatusRow
                        label={t('availability')}
                        value={cleanStatus(profile.availability_status)}
                        active={Boolean(profile.available_for_work)}
                      />

                      <StatusRow
                        label={t('currentlyWorking')}
                        value={profile.currently_working ? t('yes') : t('no')}
                        active={Boolean(profile.currently_working)}
                      />

                      <StatusRow
                        label={t('willingToTravel')}
                        value={profile.willing_to_travel ? t('yes') : t('no')}
                        active={Boolean(profile.willing_to_travel)}
                      />

                      <StatusRow
                        label={t('bookedUntil')}
                        value={formatDate(profile.booked_until)}
                        active={Boolean(profile.booked_until)}
                      />
                    </>
                  )}

                  <StatusRow
                    label={t('lastSeen')}
                    value={
                      profile.last_seen
                        ? new Date(inputValue(profile.last_seen)).toLocaleString()
                        : t('notAvailable')
                    }
                    active={onlineNow}
                  />
                </div>
              </CrewCard>

              {isOwnProfile && (
                <CrewCard>
                  <h2 className="text-2xl font-black text-slate-950">
                    {t('account')}
                  </h2>

                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    {t('accountDescription')}
                  </p>

                  <a
                    href="/delete-account"
                    className="mt-5 flex min-h-12 items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-100"
                  >
                    {t('deleteAccount')}
                  </a>
                </CrewCard>
              )}

            </aside>
          </div>
        </section>
      </div>

      {isOwnProfile && (
        <div className="px-3 pb-28 pt-4 sm:hidden">
          <div className="mx-auto max-w-xl">
            <CrewButton
              onClick={saveProfile}
              disabled={saving}
              fullWidth
            >
              {saving ? t('saving') : t('saveProfile')}
            </CrewButton>
          </div>
        </div>
      )}
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/10 p-3 text-white shadow-xl backdrop-blur sm:rounded-2xl sm:p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-300">
        {label}
      </p>

      <p className="mt-1 text-lg font-black sm:text-2xl">{value}</p>
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
      <span className="mb-1.5 block text-sm font-black text-slate-700 sm:mb-2">
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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:gap-4 sm:rounded-2xl sm:p-4">
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
    <label
      style={{
        width: '100%',
        minWidth: 0,
        minHeight: '64px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        overflow: 'hidden',
        cursor: 'pointer',
        borderRadius: '16px',
        border: checked ? '1px solid #93c5fd' : '1px solid #e2e8f0',
        background: checked ? '#eff6ff' : '#ffffff',
        color: '#0f172a',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{
          width: '20px',
          height: '20px',
          minWidth: '20px',
          maxWidth: '20px',
          margin: 0,
          flex: '0 0 20px',
          accentColor: '#2563eb',
        }}
      />

      <span
        style={{
          display: 'block',
          minWidth: 0,
          flex: '1 1 auto',
          overflow: 'hidden',
          overflowWrap: 'break-word',
          wordBreak: 'normal',
          fontSize: '14px',
          lineHeight: '20px',
          fontWeight: 800,
          textAlign: 'left',
        }}
      >
        {label}
      </span>
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
