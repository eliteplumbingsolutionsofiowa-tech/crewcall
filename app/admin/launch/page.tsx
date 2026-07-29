'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Lead = {
  id: string
  name: string | null
  email: string | null
  lead_type: string | null
  status: string | null
  referral_source: string | null
  created_at: string | null
}

export default function AdminLaunchPage() {
  const [leads, setLeads] = useState<Lead[]>([])

  async function load() {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', {
        ascending: false,
      })

    setLeads(data || [])
  }

  useEffect(() => {
    void load()
  }, [])

  const companies = leads.filter(
    (lead) => lead.lead_type === 'Company',
  ).length

  const workers = leads.filter(
    (lead) => lead.lead_type === 'Worker',
  ).length

  const converted = leads.filter(
    (lead) => lead.status === 'converted',
  ).length

  const today = new Date()
    .toISOString()
    .slice(0, 10)

  const todayLeads = leads.filter(
    (lead) =>
      lead.created_at?.startsWith(today),
  ).length

  const conversion =
    leads.length > 0
      ? Math.round(
          (converted / leads.length) * 100,
        )
      : 0

  const sources = leads.reduce(
    (acc, lead) => {
      const source =
        lead.referral_source || 'direct'

      acc[source] =
        (acc[source] || 0) + 1

      return acc
    },
    {} as Record<string, number>,
  )

  const topSource =
    Object.entries(sources).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0] || 'Direct'

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
            CrewCall
          </p>

          <h1 className="mt-3 text-5xl font-black">
            Launch Command Center
          </h1>

          <p className="mt-3 text-slate-400">
            Monitor beta growth and customer acquisition.
          </p>
        </section>


        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">

          <Metric title="Leads" value={String(leads.length)} />

          <Metric title="Today" value={String(todayLeads)} />

          <Metric title="Companies" value={String(companies)} />

          <Metric title="Workers" value={String(workers)} />

          <Metric title="Converted" value={String(converted)} />

          <Metric title="Conversion" value={`${conversion}%`} />

        </section>


        <section className="grid gap-6 lg:grid-cols-2">

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-black">
              Best Source
            </h2>

            <p className="mt-4 text-4xl font-black text-cyan-300">
              {topSource}
            </p>
          </div>


          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-black">
              Recent Leads
            </h2>

            <div className="mt-4 space-y-3">
              {leads.slice(0, 5).map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-xl bg-slate-900 p-4"
                >
                  <p className="font-bold">
                    {lead.name || 'New Lead'}
                  </p>

                  <p className="text-sm text-slate-400">
                    {lead.lead_type || 'Unknown'} · {lead.referral_source || 'direct'}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </section>

      </div>
    </main>
  )
}

function Metric({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs font-bold uppercase text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-black">
        {value}
      </p>
    </div>
  )
}
