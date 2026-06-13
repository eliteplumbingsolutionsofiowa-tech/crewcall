'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  full_name?: string | null
  company_name?: string | null
  phone?: string | null
  city?: string | null
  state?: string | null
  trade?: string | null
  years_experience?: string | null
  insurance_provider?: string | null
  job_experience?: string | null
  liability_form_signed?: boolean | null
  liability_form_url?: string | null
}

type ProfileUpdate = {
  full_name: string
  company_name: string
  phone: string
  city: string
  state: string
  trade: string
  years_experience: string
  insurance_provider: string
  job_experience: string
  liability_form_signed: boolean
}

type LiabilityUpdate = {
  liability_form_url: string
}

type Props = {
  userId: string
  initialProfile: Profile
}

type QueryError = {
  message: string
}

type UpdateEqQuery = {
  eq: (
    column: string,
    value: string
  ) => Promise<{ data: null; error: QueryError | null }>
}

type UpdateTable<TUpdate> = {
  update: (value: TUpdate) => UpdateEqQuery
}

function profileUpdateTable() {
  return supabase
    .from('profiles') as unknown as UpdateTable<ProfileUpdate>
}

function liabilityUpdateTable() {
  return supabase
    .from('profiles') as unknown as UpdateTable<LiabilityUpdate>
}

export default function EditProfileForm({
  userId,
  initialProfile,
}: Props) {
  const [profile, setProfile] = useState<Profile>(initialProfile)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function updateField(field: keyof Profile, value: string | boolean) {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    const { error } = await profileUpdateTable()
      .update({
        full_name: profile.full_name ?? '',
        company_name: profile.company_name ?? '',
        phone: profile.phone ?? '',
        city: profile.city ?? '',
        state: profile.state ?? '',
        trade: profile.trade ?? '',
        years_experience: profile.years_experience ?? '',
        insurance_provider: profile.insurance_provider ?? '',
        job_experience: profile.job_experience ?? '',
        liability_form_signed: profile.liability_form_signed ?? false,
      })
      .eq('id', userId)

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    setMessage('Profile updated successfully.')
    setSaving(false)
  }

  async function handleLiabilityUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0]

    if (!file) return

    setUploading(true)
    setMessage(null)

    const extension = file.name.split('.').pop() || 'pdf'

    const filePath = `${userId}/liability/${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('profile-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      setMessage(uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage
      .from('profile-files')
      .getPublicUrl(filePath)

    const { error: profileError } = await liabilityUpdateTable()
      .update({
        liability_form_url: data.publicUrl,
      })
      .eq('id', userId)

    if (profileError) {
      setMessage(profileError.message)
      setUploading(false)
      return
    }

    setProfile((current) => ({
      ...current,
      liability_form_url: data.publicUrl,
    }))

    setUploading(false)
    setMessage('Liability form uploaded successfully.')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
          {message}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-black text-slate-700">
            Full Name
          </label>

          <input
            type="text"
            value={profile.full_name ?? ''}
            onChange={(e) => updateField('full_name', e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-slate-700">
            Company Name
          </label>

          <input
            type="text"
            value={profile.company_name ?? ''}
            onChange={(e) => updateField('company_name', e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-slate-700">
            Phone
          </label>

          <input
            type="text"
            value={profile.phone ?? ''}
            onChange={(e) => updateField('phone', e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-slate-700">
            Trade
          </label>

          <input
            type="text"
            value={profile.trade ?? ''}
            onChange={(e) => updateField('trade', e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-slate-700">
            City
          </label>

          <input
            type="text"
            value={profile.city ?? ''}
            onChange={(e) => updateField('city', e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-slate-700">
            State
          </label>

          <input
            type="text"
            value={profile.state ?? ''}
            onChange={(e) => updateField('state', e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-slate-700">
            Years Experience
          </label>

          <input
            type="text"
            value={profile.years_experience ?? ''}
            onChange={(e) =>
              updateField('years_experience', e.target.value)
            }
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-slate-700">
            Insurance Provider
          </label>

          <input
            type="text"
            value={profile.insurance_provider ?? ''}
            onChange={(e) =>
              updateField('insurance_provider', e.target.value)
            }
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-black text-slate-700">
          Job Experience
        </label>

        <textarea
          rows={5}
          value={profile.job_experience ?? ''}
          onChange={(e) =>
            updateField('job_experience', e.target.value)
          }
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500"
        />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">
              Liability Form
            </h3>

            <p className="mt-1 text-sm font-bold text-slate-500">
              Upload your signed liability form PDF or image.
            </p>

            {profile.liability_form_url && (
              <a
                href={profile.liability_form_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-sm font-black text-blue-600 hover:text-blue-500"
              >
                View Uploaded Form
              </a>
            )}
          </div>

          <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-500">
            {uploading ? 'Uploading...' : 'Upload Form'}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              disabled={uploading}
              onChange={handleLiabilityUpload}
              className="hidden"
            />
          </label>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <input
            id="liability-signed"
            type="checkbox"
            checked={profile.liability_form_signed ?? false}
            onChange={(e) =>
              updateField('liability_form_signed', e.target.checked)
            }
            className="h-5 w-5 rounded border-slate-300"
          />

          <label
            htmlFor="liability-signed"
            className="text-sm font-black text-slate-700"
          >
            I have signed my liability form
          </label>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-orange-400 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  )
}