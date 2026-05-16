'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CrewCard } from '@/app/components/CrewCard'
import { CrewButton } from '@/app/components/CrewButton'
import ProfileReviews from '@/app/components/ProfileReviews'

type Profile = {
  id: string
  role: 'company' | 'worker' | null
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
}

const emptyProfile = (id: string): Profile => ({
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
})

function ProfileContent() {
  const searchParams = useSearchParams()
  const viewedUserId = searchParams.get('user')

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const isOwnProfile = !viewedUserId || viewedUserId === currentUserId

  useEffect(() => {
    loadProfile()
  }, [viewedUserId])

  async function loadProfile() {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('Please log in to view profiles.')
      setLoading(false)
      return
    }

    setCurrentUserId(user.id)

    const profileId = viewedUserId || user.id

    const { data, error } = await supabase
      .from('profiles')
      .select(
        `
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
        liability_form_signed
      `
      )
      .eq('id', profileId)
      .maybeSingle()

    if (error) {
      setMessage(error.message)
      setProfile(null)
    } else if (data) {
      setProfile(data as Profile)
    } else if (profileId === user.id) {
      setProfile(emptyProfile(user.id))
      setMessage('Finish setting up your profile.')
    } else {
      setProfile(null)
      setMessage('Profile not found.')
    }

    setLoading(false)
  }

  function updateField(field: keyof Profile, value: string | boolean) {
    setProfile((prev) => {
      if (!prev) return prev
      return { ...prev, [field]: value }
    })
  }

  async function saveProfile() {
    if (!profile || !currentUserId || !isOwnProfile) return

    setSaving(true)
    setMessage('')

    const payload = {
      id: currentUserId,
      role: profile.role,
      full_name: profile.full_name || null,
      company_name: profile.company_name || null,
      phone: profile.phone || null,
      city: profile.city || null,
      state: profile.state || null,
      trade: profile.trade || null,
      years_experience: profile.years_experience || null,
      insurance_provider: profile.insurance_provider || null,
      job_experience: profile.job_experience || null,
      liability_form_signed: Boolean(profile.liability_form_signed),
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Profile saved.')
      await loadProfile()
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-gray-600">Loading profile...</p>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <CrewCard>
          <p className="text-gray-600">{message || 'Profile not found.'}</p>
        </CrewCard>
      </main>
    )
  }

  const displayName =
    profile.role === 'company'
      ? profile.company_name || profile.full_name || 'Company Profile'
      : profile.full_name || 'Worker Profile'

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
          {isOwnProfile ? 'My Profile' : 'Public Profile'}
        </p>

        <h1 className="mt-2 text-4xl font-bold text-gray-950 sm:text-5xl">
          {displayName}
        </h1>

        <p className="mt-3 text-lg text-gray-600">
          {profile.trade || profile.role || 'CrewCall user'}
          {profile.city || profile.state
            ? ` · ${[profile.city, profile.state].filter(Boolean).join(', ')}`
            : ''}
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-semibold text-blue-800">
          {message}
        </div>
      )}

      <CrewCard>
        {isOwnProfile && (
          <div className="mb-6">
            <label className="text-sm font-bold text-gray-800">
              Account Type
            </label>

            <select
              value={profile.role || ''}
              onChange={(e) =>
                updateField(
                  'role',
                  e.target.value as 'company' | 'worker' | ''
                )
              }
              className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="">Select role</option>
              <option value="company">Company</option>
              <option value="worker">Worker</option>
            </select>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Full Name"
            value={profile.full_name}
            editable={isOwnProfile}
            onChange={(value) => updateField('full_name', value)}
          />

          <Field
            label="Company Name"
            value={profile.company_name}
            editable={isOwnProfile}
            onChange={(value) => updateField('company_name', value)}
          />

          <Field
            label="Phone"
            value={profile.phone}
            editable={isOwnProfile}
            onChange={(value) => updateField('phone', value)}
          />

          <Field
            label="Trade"
            value={profile.trade}
            editable={isOwnProfile}
            onChange={(value) => updateField('trade', value)}
          />

          <Field
            label="City"
            value={profile.city}
            editable={isOwnProfile}
            onChange={(value) => updateField('city', value)}
          />

          <Field
            label="State"
            value={profile.state}
            editable={isOwnProfile}
            onChange={(value) => updateField('state', value)}
          />

          <Field
            label="Years Experience"
            value={profile.years_experience}
            editable={isOwnProfile}
            onChange={(value) => updateField('years_experience', value)}
          />

          <Field
            label="Insurance Provider"
            value={profile.insurance_provider}
            editable={isOwnProfile}
            onChange={(value) => updateField('insurance_provider', value)}
          />
        </div>

        <div className="mt-6">
          <label className="text-sm font-bold text-gray-800">
            Job Experience
          </label>

          {isOwnProfile ? (
            <textarea
              value={profile.job_experience || ''}
              onChange={(e) => updateField('job_experience', e.target.value)}
              rows={6}
              className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="Describe your experience, past jobs, skills, licenses, or specialties."
            />
          ) : (
            <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-gray-100 bg-gray-50 p-4 text-gray-700">
              {profile.job_experience || 'Not listed'}
            </p>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <p className="font-bold text-gray-900">Compliance</p>

          {isOwnProfile ? (
            <label className="mt-3 flex items-center gap-3 text-sm font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(profile.liability_form_signed)}
                onChange={(e) =>
                  updateField('liability_form_signed', e.target.checked)
                }
                className="h-5 w-5 rounded border-gray-300"
              />
              Liability form signed
            </label>
          ) : (
            <p className="mt-1 text-gray-700">
              Liability Form:{' '}
              {profile.liability_form_signed ? 'Signed' : 'Not signed'}
            </p>
          )}
        </div>

        {isOwnProfile && (
          <div className="mt-8">
            <CrewButton onClick={saveProfile} disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </CrewButton>
          </div>
        )}
      </CrewCard>

      <div className="mt-8">
        <ProfileReviews profileId={profile.id} />
      </div>
    </main>
  )
}

function Field({
  label,
  value,
  editable,
  onChange,
}: {
  label: string
  value: string | null
  editable: boolean
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="text-sm font-bold text-gray-800">{label}</label>

      {editable ? (
        <input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500"
        />
      ) : (
        <p className="mt-2 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-gray-700">
          {value || 'Not listed'}
        </p>
      )}
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-gray-600">Loading profile...</p>
        </main>
      }
    >
      <ProfileContent />
    </Suspense>
  )
}