'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: string | null
  full_name: string | null
  company_name: string | null
  insurance_provider: string | null
  job_experience: string | null
  liability_form_signed: boolean | null
  insurance_verified: boolean | null
  liability_form_verified: boolean | null
  company_verified: boolean | null
}

type ProfileUpdate = {
  insurance_verified: boolean | null
  liability_form_verified: boolean | null
  company_verified: boolean | null
}

type QueryError = {
  message: string
}

type MaybeSingleQuery<T> = {
  maybeSingle: () => Promise<{ data: T | null; error: QueryError | null }>
}

type EqMaybeQuery<T> = {
  eq: (column: string, value: string) => MaybeSingleQuery<T>
}

type SelectTable<T> = {
  select: (columns: string) => EqMaybeQuery<T>
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

function profilesSelectTable() {
  return supabase.from('profiles') as unknown as SelectTable<Profile>
}

function profilesUpdateTable() {
  return supabase.from('profiles') as unknown as UpdateTable<ProfileUpdate>
}

export default function CompliancePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('Please log in to manage compliance.')
      setLoading(false)
      return
    }

    const { data, error } = await profilesSelectTable()
      .select(`
        id,
        role,
        full_name,
        company_name,
        insurance_provider,
        job_experience,
        liability_form_signed,
        insurance_verified,
        liability_form_verified,
        company_verified
      `)
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setProfile(data)
    setLoading(false)
  }

  async function saveCompliance() {
    if (!profile) return

    setSaving(true)
    setMessage(null)

    const { error } = await profilesUpdateTable()
      .update({
        insurance_verified: profile.insurance_verified,
        liability_form_verified: profile.liability_form_verified,
        company_verified: profile.company_verified,
      })
      .eq('id', profile.id)

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    setMessage('Compliance updated successfully.')
    setSaving(false)
  }

  function toggleField(
    field:
      | 'insurance_verified'
      | 'liability_form_verified'
      | 'company_verified'
  ) {
    if (!profile) return

    setProfile({
      ...profile,
      [field]: !profile[field],
    })
  }

  function StatusBadge({ active }: { active: boolean | null }) {
    return (
      <span
        className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${
          active
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-slate-100 text-slate-600'
        }`}
      >
        {active ? 'Verified' : 'Not Verified'}
      </span>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 text-center text-sm font-black text-slate-500 shadow-sm">
          Loading compliance...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-300">
            CrewCall Trust
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Compliance Center
          </h1>

          <p className="mt-2 max-w-2xl text-sm font-medium text-slate-300">
            Review company and worker trust signals like insurance,
            liability forms, and verification status.
          </p>
        </div>

        {message && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
            {message}
          </div>
        )}

        {!profile ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-black text-slate-950">
              No profile found.
            </h2>

            <p className="mt-2 text-sm font-bold text-slate-500">
              Finish your profile before managing compliance.
            </p>

            <Link
              href="/profile"
              className="mt-5 inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white"
            >
              Go to Profile
            </Link>
          </div>
        ) : (
          <>
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">
                    {profile.company_name ||
                      profile.full_name ||
                      'CrewCall Profile'}
                  </h2>

                  <p className="mt-1 text-sm font-bold text-slate-500">
                    Role: {profile.role || 'Not set'}
                  </p>
                </div>

                <Link
                  href="/profile"
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-black text-slate-900 transition hover:bg-slate-50"
                >
                  Edit Profile
                </Link>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Insurance Provider
                  </p>

                  <p className="mt-2 text-sm font-black text-slate-950">
                    {profile.insurance_provider || 'Not provided'}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Liability Form
                  </p>

                  <p className="mt-2 text-sm font-black text-slate-950">
                    {profile.liability_form_signed
                      ? 'Signed'
                      : 'Not signed'}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Job Experience
                  </p>

                  <p className="mt-2 line-clamp-3 text-sm font-black text-slate-950">
                    {profile.job_experience || 'Not provided'}
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-950">
                Verification Controls
              </h2>

              {(
                [
                  [
                    'Insurance Verified',
                    'Confirms insurance information has been reviewed.',
                    'insurance_verified',
                  ],
                  [
                    'Liability Form Verified',
                    'Confirms liability paperwork is signed and reviewed.',
                    'liability_form_verified',
                  ],
                  [
                    'Company Verified',
                    'Marks this account as a trusted CrewCall company.',
                    'company_verified',
                  ],
                ] as const
              ).map(([title, description, field]) => (
                <div
                  key={field}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-black text-slate-950">
                      {title}
                    </p>

                    <p className="text-sm font-bold text-slate-500">
                      {description}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <StatusBadge active={profile[field]} />

                    <button
                      type="button"
                      onClick={() => toggleField(field)}
                      className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white"
                    >
                      Toggle
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={saveCompliance}
                disabled={saving}
                className="w-full rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-orange-400 disabled:opacity-50 sm:w-auto"
              >
                {saving ? 'Saving...' : 'Save Compliance'}
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  )
}