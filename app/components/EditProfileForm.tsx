'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
  phone: string | null
  city: string | null
  state: string | null
  role: string | null
  primary_trade?: string | null
  years_experience?: number | null
  insured?: boolean | null
  license_number?: string | null
  certifications?: string | null
  liability_form_signed?: boolean | null
  liability_form_url?: string | null
  insurance_company?: string | null
  insurance_policy_number?: string | null
  insurance_expiration?: string | null
}

export default function EditProfileForm({
  profile,
}: {
  profile: Profile | null
}) {
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [companyName, setCompanyName] = useState(profile?.company_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [city, setCity] = useState(profile?.city || '')
  const [state, setState] = useState(profile?.state || '')
  const [primaryTrade, setPrimaryTrade] = useState(profile?.primary_trade || '')
  const [yearsExperience, setYearsExperience] = useState(
    profile?.years_experience?.toString() || ''
  )
  const [insured, setInsured] = useState(!!profile?.insured)
  const [licenseNumber, setLicenseNumber] = useState(profile?.license_number || '')
  const [certifications, setCertifications] = useState(profile?.certifications || '')
  const [liabilityFormSigned, setLiabilityFormSigned] = useState(
    !!profile?.liability_form_signed
  )
  const [insuranceCompany, setInsuranceCompany] = useState(
    profile?.insurance_company || ''
  )
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState(
    profile?.insurance_policy_number || ''
  )
  const [insuranceExpiration, setInsuranceExpiration] = useState(
    profile?.insurance_expiration || ''
  )

  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleUpload(userId: string) {
    if (!file) return true

    setUploading(true)

    const filePath = `${userId}/${Date.now()}_${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('compliance-files')
      .upload(filePath, file)

    if (uploadError) {
      setMessage(uploadError.message || 'Upload failed')
      setUploading(false)
      return false
    }

    const { data } = supabase.storage
      .from('compliance-files')
      .getPublicUrl(filePath)

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ liability_form_url: data.publicUrl })
      .eq('id', userId)

    setUploading(false)

    if (profileError) {
      setMessage(profileError.message || 'File uploaded, but profile update failed')
      return false
    }

    return true
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    const user = session?.user

    if (sessionError || !user) {
      setMessage('You must be logged in.')
      setSaving(false)
      return
    }

    const parsedYears =
      yearsExperience.trim() === '' ? null : Number(yearsExperience)

    if (
      parsedYears !== null &&
      (!Number.isFinite(parsedYears) || parsedYears < 0)
    ) {
      setMessage('Years of experience must be a valid number.')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim() || null,
        company_name: companyName.trim() || null,
        phone: phone.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        primary_trade: primaryTrade.trim() || null,
        years_experience: parsedYears,
        insured,
        license_number: licenseNumber.trim() || null,
        certifications: certifications.trim() || null,
        liability_form_signed: liabilityFormSigned,
        insurance_company: insuranceCompany.trim() || null,
        insurance_policy_number: insurancePolicyNumber.trim() || null,
        insurance_expiration: insuranceExpiration || null,
      })
      .eq('id', user.id)

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    if (file) {
      const uploaded = await handleUpload(user.id)
      if (!uploaded) {
        setSaving(false)
        return
      }
    }

    setMessage('Profile updated.')
    setSaving(false)
    setFile(null)

    window.location.reload()
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-blue-700 to-slate-900 px-8 py-6 text-white">
        <h2 className="text-2xl font-bold">Edit Profile</h2>
        <p className="mt-2 text-sm text-blue-100">
          Update your trade, experience, insurance, and compliance details.
        </p>
      </div>

      <form onSubmit={handleSave} className="p-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Basic Info
            </h3>

            <div className="mt-5 grid gap-4">
              <FormField
                label="Name"
                value={fullName}
                onChange={setFullName}
                placeholder="Full name"
              />

              <FormField
                label="Company"
                value={companyName}
                onChange={setCompanyName}
                placeholder="Company name"
              />

              <FormField
                label="Phone"
                value={phone}
                onChange={setPhone}
                placeholder="Phone number"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="City"
                  value={city}
                  onChange={setCity}
                  placeholder="City"
                />

                <FormField
                  label="State"
                  value={state}
                  onChange={setState}
                  placeholder="State"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Trade & Experience
            </h3>

            <div className="mt-5 grid gap-4">
              <FormField
                label="Primary Trade"
                value={primaryTrade}
                onChange={setPrimaryTrade}
                placeholder="Plumbing"
              />

              <FormField
                label="Years Experience"
                value={yearsExperience}
                onChange={setYearsExperience}
                placeholder="10"
              />

              <FormField
                label="License Number"
                value={licenseNumber}
                onChange={setLicenseNumber}
                placeholder="Optional"
              />

              <FormField
                label="Certifications"
                value={certifications}
                onChange={setCertifications}
                placeholder="OSHA 10, Med Gas, etc."
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Insurance
            </h3>

            <div className="mt-5 grid gap-4">
              <FormField
                label="Insurance Company"
                value={insuranceCompany}
                onChange={setInsuranceCompany}
                placeholder="Insurance company"
              />

              <FormField
                label="Policy Number"
                value={insurancePolicyNumber}
                onChange={setInsurancePolicyNumber}
                placeholder="Policy number"
              />

              <DateField
                label="Insurance Expiration"
                value={insuranceExpiration}
                onChange={setInsuranceExpiration}
              />

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={insured}
                    onChange={(e) => setInsured(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Currently insured
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Compliance Documents
            </h3>

            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={liabilityFormSigned}
                    onChange={(e) => setLiabilityFormSigned(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Liability form signed
                </label>
              </div>

              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
                <label className="block text-sm font-medium text-slate-700">
                  Upload Liability Form
                </label>

                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="mt-3 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
                />

                <p className="mt-3 text-xs text-slate-500">
                  Upload a PDF or image for your current liability form.
                </p>

                {profile?.liability_form_url && (
                  <a
                    href={profile.liability_form_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    View Current Liability Form
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving || uploading}
            className="inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {saving || uploading ? 'Saving...' : 'Save Profile'}
          </button>

          {message && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              {message}
            </div>
          )}
        </div>
      </form>
    </section>
  )
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  )
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  )
}