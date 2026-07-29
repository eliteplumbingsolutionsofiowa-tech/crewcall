'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Lead = {
  id: string
  lead_type: string | null
  status: string | null
  referral_source: string | null
  created_at: string | null
}

export default function LaunchAnalyticsPage() {
  const [leads, setLeads] = useState<Lead[]>([])

  async function load() {
    const { data } = await supabase
      .from('leads')
      .select(
        'id, lead_type, status, referral_source, created_at',
      )
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
    )[0]?.[0] || 'None'

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">

          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
            CrewCall Launch
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Growth Analytics
          </h1>

        </section>


        <section className="grid gap-4 md:grid-cols-4">

          <Card
            title="Total Leads"
            value={String(leads.length)}
          />

          <Card
            title="Companies"
            value={String(companies)}
          />

          <Card
            title="Workers"
            value={String(workers)}
          />

          <Card
            title="Converted"
            value={String(converted)}
          />

        </section>


        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">

          <h2 className="text-2xl font-black">
            Best Referral Source
          </h2>

          <p className="mt-3 text-4xl font-black text-cyan-300">
            {topSource}
          </p>

        </section>


        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">

          <h2 className="text-2xl font-black">
            Recent Signups
          </h2>

          <div className="mt-5 space-y-3">

            {leads.slice(0, 10).map((lead) => (
              <div
                key={lead.id}
                className="rounded-xl bg-slate-900 p-4"
              >
                <p className="font-bold">
                  {lead.lead_type || 'Unknown'}
                </p>

                <p className="text-sm text-slate-400">
                  Source: {lead.referral_source || 'direct'}
                </p>
              </div>
            ))}

          </div>

        </section>

      </div>
    </main>
  )
}

function Card({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-black">
        {value}
      </p>
    </div>
  )
}
