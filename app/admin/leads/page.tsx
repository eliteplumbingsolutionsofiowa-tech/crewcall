'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Lead = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  lead_type: string | null
  trade: string | null
  location: string | null
  company_name: string | null
  status: string | null
  notes?: string | null
  follow_up_date?: string | null
  referral_source?: string | null
  created_at: string | null
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  async function loadLeads() {
    setLoading(true)

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', {
        ascending: false,
      })

    if (!error) {
      setLeads((data || []) as Lead[])
    }

    setLoading(false)
  }

  async function updateLead(
    id: string,
    updates: Partial<Lead>,
  ) {
    setSavingId(id)

    await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)

    await loadLeads()

    setSavingId(null)
  }

  useEffect(() => {
    void loadLeads()
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

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">

        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            Admin
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Lead Queue
          </h1>

          <p className="mt-3 text-slate-400">
            Manage CrewCall beta signups and customer outreach.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat title="Total Leads" value={String(leads.length)} />
          <Stat title="Companies" value={String(companies)} />
          <Stat title="Workers" value={String(workers)} />
          <Stat title="Converted" value={String(converted)} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">

          <div className="border-b border-white/10 p-6">
            <h2 className="text-2xl font-black">
              Beta Leads
            </h2>
          </div>

          {loading ? (
            <div className="p-6 text-slate-400">
              Loading leads...
            </div>
          ) : leads.length === 0 ? (
            <div className="p-6 text-slate-400">
              No leads yet.
            </div>
          ) : (

            <div className="overflow-x-auto">

              <table className="w-full text-left">

                <thead className="bg-slate-900 text-sm text-slate-400">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Trade</th>
                    <th className="p-4">Location</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Source</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Follow Up</th>
                    <th className="p-4">Notes</th>
                    <th className="p-4">Save</th>
                  </tr>
                </thead>

                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-t border-white/10"
                    >
                      <td className="p-4 font-bold">
                        {lead.name || '-'}
                      </td>

                      <td className="p-4">
                        {lead.lead_type || '-'}
                      </td>

                      <td className="p-4">
                        {lead.trade || '-'}
                      </td>

                      <td className="p-4">
                        {lead.location || '-'}
                      </td>

                      <td className="p-4">
                        {lead.email || '-'}
                      </td>

                      <td className="p-4 text-cyan-300">
                        {lead.referral_source || 'direct'}
                      </td>

                      <td className="p-4">
                        <select
                          id={`status-${lead.id}`}
                          defaultValue={lead.status || 'new'}
                          className="rounded-lg bg-slate-900 px-3 py-2"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="demo">Demo Scheduled</option>
                          <option value="converted">Converted</option>
                        </select>
                      </td>

                      <td className="p-4">
                        <input
                          id={`follow-${lead.id}`}
                          type="date"
                          defaultValue={lead.follow_up_date || ''}
                          className="rounded-lg bg-slate-900 px-3 py-2"
                        />
                      </td>

                      <td className="p-4">
                        <input
                          id={`notes-${lead.id}`}
                          defaultValue={lead.notes || ''}
                          placeholder="Notes"
                          className="rounded-lg bg-slate-900 px-3 py-2"
                        />
                      </td>

                      <td className="p-4">
                        <button
                          onClick={() =>
                            updateLead(lead.id, {
                              status: (
                                document.getElementById(
                                  `status-${lead.id}`,
                                ) as HTMLSelectElement
                              ).value,

                              follow_up_date: (
                                document.getElementById(
                                  `follow-${lead.id}`,
                                ) as HTMLInputElement
                              ).value,

                              notes: (
                                document.getElementById(
                                  `notes-${lead.id}`,
                                ) as HTMLInputElement
                              ).value,
                            })
                          }
                          className="rounded-lg bg-cyan-400 px-4 py-2 font-black text-slate-950"
                        >
                          {savingId === lead.id
                            ? 'Saving...'
                            : 'Save'}
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>

              </table>

            </div>

          )}

        </section>

      </div>
    </main>
  )
}

function Stat({
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
