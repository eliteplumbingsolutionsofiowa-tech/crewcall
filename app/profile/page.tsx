'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CrewCard } from '@/app/components/CrewCard'
import { CrewButton } from '@/app/components/CrewButton'

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
  stripe_account_id: string | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connectLoading, setConnectLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    setEmail(user.email || '')

    const { data, error } = await supabase
      .from('profiles')
      .select(`
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
        stripe_account_id
      `)
      .eq('id', user.id)
      .single()

    if (error) {
      setMessage(error.message)
    } else {
      setProfile(data as Profile)
    }

    setLoading(false)
  }

  async function saveProfile() {
    if (!profile) return

    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        company_name: profile.company_name,
        phone: profile.phone,
        city: profile.city,
        state: profile.state,
        trade: profile.trade,
        years_experience: profile.years_experience,
        insurance_provider: profile.insurance_provider,
        job_experience: profile.job_experience,
        liability_form_signed: profile.liability_form_signed,
      })
      .eq('id', profile.id)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Profile saved.')
    }

    setSaving(false)
  }

  async function connectStripe() {
    if (!profile) return

    setConnectLoading(true)

    try {
      const response = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: profile.id,
          email,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.error || 'Stripe connection failed.')
        setConnectLoading(false)
        return
      }

      window.location.href = data.url
    } catch (error: any) {
      setMessage(error.message)
      setConnectLoading(false)
    }
  }

  function updateField(field: keyof Profile, value: any) {
    if (!profile) return
    setProfile({ ...profile, [field]: value })
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-4xl">
          <CrewCard>
            <p className="text-gray-600">Loading profile...</p>
          </CrewCard>
        </div>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-4xl">
          <CrewCard>
            <p className="text-gray-600">No profile found.</p>
          </CrewCard>
        </div>
      </main>
    )
  }

  const isWorker = profile.role === 'worker'

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <CrewCard>
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                {profile.role}
              </p>

              <h1 className="mt-2 text-4xl font-bold text-gray-900">
                {profile.full_name || profile.company_name || 'Profile'}
              </h1>

              <p className="mt-2 text-gray-600">{email}</p>
            </div>

            {isWorker && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900">
                  Stripe Payouts
                </h2>

                <p className="mt-2 text-sm text-gray-600">
                  Connect your Stripe account so companies can pay you directly.
                </p>

                <div className="mt-4">
                  <CrewButton
                    onClick={connectStripe}
                    disabled={connectLoading}
                  >
                    {connectLoading
                      ? 'Opening Stripe...'
                      : profile.stripe_account_id
                        ? 'Continue Stripe Setup'
                        : 'Connect Stripe Payouts'}
                  </CrewButton>
                </div>
              </div>
            )}
          </div>
        </CrewCard>

        {message && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-blue-700">
            {message}
          </div>
        )}

        <CrewCard>
          <h2 className="text-2xl font-bold text-gray-900">
            Profile Details
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Full Name
              </label>

              <input
                value={profile.full_name || ''}
                onChange={(e) =>
                  updateField('full_name', e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Company Name
              </label>

              <input
                value={profile.company_name || ''}
                onChange={(e) =>
                  updateField('company_name', e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Phone
              </label>

              <input
                value={profile.phone || ''}
                onChange={(e) =>
                  updateField('phone', e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                City
              </label>

              <input
                value={profile.city || ''}
                onChange={(e) =>
                  updateField('city', e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                State
              </label>

              <input
                value={profile.state || ''}
                onChange={(e) =>
                  updateField('state', e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
              />
            </div>

            {isWorker && (
              <>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Trade
                  </label>

                  <input
                    value={profile.trade || ''}
                    onChange={(e) =>
                      updateField('trade', e.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Years Experience
                  </label>

                  <input
                    value={profile.years_experience || ''}
                    onChange={(e) =>
                      updateField(
                        'years_experience',
                        e.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Insurance Provider
                  </label>

                  <input
                    value={profile.insurance_provider || ''}
                    onChange={(e) =>
                      updateField(
                        'insurance_provider',
                        e.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Job Experience
                  </label>

                  <textarea
                    rows={5}
                    value={profile.job_experience || ''}
                    onChange={(e) =>
                      updateField(
                        'job_experience',
                        e.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={
                        !!profile.liability_form_signed
                      }
                      onChange={(e) =>
                        updateField(
                          'liability_form_signed',
                          e.target.checked
                        )
                      }
                    />

                    <span className="text-sm font-medium text-gray-700">
                      Liability form signed
                    </span>
                  </label>
                </div>
              </>
            )}
          </div>

          <div className="mt-8">
            <CrewButton
              onClick={saveProfile}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </CrewButton>
          </div>
        </CrewCard>
      </div>
    </main>
  )
}
