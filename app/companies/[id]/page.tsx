'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type CompanyProfile = {
  id: string
  role: string | null
  full_name: string | null
  company_name: string | null
  phone: string | null
  city: string | null
  state: string | null
  verified: boolean | null
}

export default function CompanyProfilePage() {
  const params = useParams()
  const companyId = String(params.id || '')

  const [company, setCompany] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadCompany()
  }, [])

  async function loadCompany() {
    setLoading(true)
    setMessage(null)

    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, company_name, phone, city, state, verified')
      .eq('id', companyId)
      .maybeSingle()

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    if (!data || data.role !== 'company') {
      setMessage('Company profile not found.')
      setLoading(false)
      return
    }

    setCompany(data as CompanyProfile)
    setLoading(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow-sm">
          Loading company profile...
        </div>
      </main>
    )
  }

  if (!company) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          {message || 'Company not found.'}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/jobs" className="text-sm font-semibold text-blue-600 hover:underline">
          ← Back to jobs
        </Link>

        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-xl">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-600">
            Company Profile
          </p>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-4xl font-black text-slate-950">
                {company.company_name || company.full_name || 'Company'}
              </h1>

              <p className="mt-2 text-lg text-slate-600">
                {[company.city, company.state].filter(Boolean).join(', ') ||
                  'Location not listed'}
              </p>

              {company.phone && (
                <p className="mt-2 text-slate-600">Phone: {company.phone}</p>
              )}
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-center">
              <p className="text-2xl font-black text-blue-700">
                {company.verified ? 'Verified' : 'Not Verified'}
              </p>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-500">
                Company Status
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-xl">
          <h2 className="text-2xl font-black text-slate-950">
            Company Reputation
          </h2>

          <p className="mt-3 text-slate-600">
            Reviews, completed jobs, and company history will show here next.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                Rating
              </p>
              <p className="mt-2 text-3xl font-black text-slate-950">—</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                Reviews
              </p>
              <p className="mt-2 text-3xl font-black text-slate-950">0</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-black uppercase tracking-wide text-slate-500">
                Completed Jobs
              </p>
              <p className="mt-2 text-3xl font-black text-slate-950">0</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}