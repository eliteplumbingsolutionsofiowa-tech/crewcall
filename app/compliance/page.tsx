'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: string | null
  company_name: string | null
  insurance_verified: boolean | null
  liability_form_verified: boolean | null
  company_verified: boolean | null
}

export default function CompliancePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select(`
          id,
          role,
          company_name,
          insurance_verified,
          liability_form_verified,
          company_verified
        `)
        .eq('id', user.id)
        .single()

      setProfile(data || null)
      setLoading(false)
    }

    loadProfile()
  }, [])

  async function saveCompliance() {
    if (!profile) return

    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('profiles')
      .update({
        insurance_verified: profile.insurance_verified,
        liability_form_verified: profile.liability_form_verified,
        company_verified: profile.company_verified,
      })
      .eq('id', profile.id)

    if (error) {
      setMessage('Could not save compliance info.')
      setSaving(false)
      return
    }

    setMessage('Compliance info saved.')
    setSaving(false)
  }

  if (loading) return <div className="p-6">Loading compliance...</div>

  if (!profile) {
    return <div className="p-6">You need to be logged in.</div>
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">
          Company Compliance
        </h1>
        <p className="mt-2 text-gray-600">
          Track insurance, liability forms, and company verification.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">
          {profile.company_name || 'Company Profile'}
        </h2>

        <div className="mt-6 space-y-4">
          <label className="flex items-center gap-3 rounded-xl border p-4">
            <input
              type="checkbox"
              checked={!!profile.insurance_verified}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  insurance_verified: e.target.checked,
                })
              }
            />
            <div>
              <p className="font-semibold">Insurance Verified</p>
              <p className="text-sm text-gray-500">
                General liability or insurance information is on file.
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 rounded-xl border p-4">
            <input
              type="checkbox"
              checked={!!profile.liability_form_verified}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  liability_form_verified: e.target.checked,
                })
              }
            />
            <div>
              <p className="font-semibold">Liability Form Verified</p>
              <p className="text-sm text-gray-500">
                Required liability form has been received.
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 rounded-xl border p-4">
            <input
              type="checkbox"
              checked={!!profile.company_verified}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  company_verified: e.target.checked,
                })
              }
            />
            <div>
              <p className="font-semibold">Company Verified</p>
              <p className="text-sm text-gray-500">
                Company profile has been reviewed and approved.
              </p>
            </div>
          </label>
        </div>

        {message && (
          <div className="mt-5 rounded-xl bg-gray-100 p-4 text-sm text-gray-700">
            {message}
          </div>
        )}

        <button
          onClick={saveCompliance}
          disabled={saving}
          className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Compliance'}
        </button>
      </div>
    </main>
  )
}