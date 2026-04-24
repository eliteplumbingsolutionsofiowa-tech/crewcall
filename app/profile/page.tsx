'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import EditProfileForm from '@/app/components/EditProfileForm'

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

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      setErrorMessage(null)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      const user = session?.user

      if (sessionError || !user) {
        setErrorMessage('You must be logged in.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        setErrorMessage(error.message)
        setLoading(false)
        return
      }

      setProfile(data)
      setLoading(false)
    }

    loadProfile()
  }, [])

  const completion = useMemo(() => {
    if (!profile) {
      return {
        completed: 0,
        total: 8,
        percent: 0,
        checks: [] as { label: string; done: boolean }[],
      }
    }

    const checks = [
      {
        label: 'Name or company',
        done: Boolean(profile.full_name || profile.company_name),
      },
      {
        label: 'Phone',
        done: Boolean(profile.phone),
      },
      {
        label: 'City and state',
        done: Boolean(profile.city && profile.state),
      },
      {
        label: 'Primary trade',
        done: Boolean(profile.primary_trade),
      },
      {
        label: 'Years experience',
        done:
          typeof profile.years_experience === 'number' &&
          Number.isFinite(profile.years_experience),
      },
      {
        label: 'Insurance marked',
        done: profile.insured === true,
      },
      {
        label: 'Insurance details',
        done: Boolean(
          profile.insurance_company &&
            profile.insurance_policy_number &&
            profile.insurance_expiration
        ),
      },
      {
        label: 'Liability form uploaded',
        done: Boolean(profile.liability_form_url),
      },
    ]

    const completed = checks.filter((item) => item.done).length
    const total = checks.length
    const percent = Math.round((completed / total) * 100)

    return { checks, completed, total, percent }
  }, [profile])

  const isVerified = Boolean(profile?.liability_form_url && profile?.insured)

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-slate-600">Loading profile...</div>
        </div>
      </main>
    )
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <div className="text-red-600">{errorMessage}</div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-8 py-8 text-white">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">
                    {profile?.full_name || profile?.company_name || 'My Profile'}
                  </h1>

                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
                    {profile?.role || 'Profile'}
                  </span>

                  {isVerified && (
                    <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
                      Verified
                    </span>
                  )}
                </div>

                <p className="mt-3 max-w-2xl text-sm text-slate-200">
                  Keep your profile complete so companies can trust what they see.
                </p>
              </div>

              <div className="min-w-[280px] rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    Profile Completion
                  </h3>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900">
                    {completion.percent}%
                  </span>
                </div>

                <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${completion.percent}%` }}
                  />
                </div>

                <p className="mt-3 text-xs text-slate-200">
                  {completion.completed} of {completion.total} items complete
                </p>

                <div className="mt-4 space-y-2">
                  {completion.checks.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-100">{item.label}</span>
                      <span
                        className={
                          item.done
                            ? 'font-medium text-emerald-300'
                            : 'font-medium text-slate-300'
                        }
                      >
                        {item.done ? 'Done' : 'Missing'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Profile Details
                </h2>

                <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                  <InfoItem label="Company" value={profile?.company_name} />
                  <InfoItem label="Phone" value={profile?.phone} />
                  <InfoItem label="City" value={profile?.city} />
                  <InfoItem label="State" value={profile?.state} />
                  <InfoItem label="Trade" value={profile?.primary_trade} />
                  <InfoItem
                    label="Years Experience"
                    value={
                      profile?.years_experience !== null &&
                      profile?.years_experience !== undefined
                        ? String(profile.years_experience)
                        : null
                    }
                  />
                  <InfoItem label="License #" value={profile?.license_number} />
                  <div className="sm:col-span-2">
                    <InfoItem
                      label="Certifications"
                      value={profile?.certifications}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Compliance
                  </h2>

                  {isVerified ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Verified Profile
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      In Progress
                    </span>
                  )}
                </div>

                <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                  <InfoItem
                    label="Insured"
                    value={profile?.insured ? 'Yes' : 'No'}
                    valueClassName={profile?.insured ? 'text-emerald-700' : 'text-slate-700'}
                  />
                  <InfoItem
                    label="Liability Form Signed"
                    value={profile?.liability_form_signed ? 'Yes' : 'No'}
                  />
                  <InfoItem
                    label="Insurance Company"
                    value={profile?.insurance_company}
                  />
                  <InfoItem
                    label="Policy Number"
                    value={profile?.insurance_policy_number}
                  />
                  <InfoItem
                    label="Insurance Expiration"
                    value={profile?.insurance_expiration}
                  />
                </div>

                {profile?.liability_form_url && (
                  <a
                    href={profile.liability_form_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    View Liability Form
                  </a>
                )}
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Trust Status
                </h3>

                <div className="mt-4 space-y-3">
                  <StatusRow
                    label="Profile basics"
                    done={Boolean(
                      profile?.full_name ||
                        profile?.company_name ||
                        profile?.phone ||
                        profile?.city
                    )}
                  />
                  <StatusRow
                    label="Insurance marked"
                    done={profile?.insured === true}
                  />
                  <StatusRow
                    label="Insurance details"
                    done={Boolean(
                      profile?.insurance_company &&
                        profile?.insurance_policy_number &&
                        profile?.insurance_expiration
                    )}
                  />
                  <StatusRow
                    label="Liability form uploaded"
                    done={Boolean(profile?.liability_form_url)}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                  CrewCall Tip
                </h3>
                <p className="mt-3 text-sm text-slate-700">
                  Profiles with insurance info and uploaded compliance documents
                  look more trustworthy to companies and stand out faster.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <EditProfileForm profile={profile} />
      </div>
    </main>
  )
}

function InfoItem({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string | null | undefined
  valueClassName?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-2 text-sm font-medium ${valueClassName || 'text-slate-900'}`}>
        {value || '—'}
      </div>
    </div>
  )
}

function StatusRow({
  label,
  done,
}: {
  label: string
  done: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
      <span className="text-sm text-slate-700">{label}</span>
      <span
        className={
          done
            ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700'
            : 'rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600'
        }
      >
        {done ? 'Done' : 'Missing'}
      </span>
    </div>
  )
}