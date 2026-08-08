'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Metric = {
  jobs:number
  applications:number
  workers:number
  companies:number
  aiInvites:number
  aiHires:number
  alerts:number
  pendingPayouts:number
  openJobs:number
}

export default function ReleaseCenterPage(){

  const [loading,setLoading] = useState(true)

  const [metrics,setMetrics] = useState<Metric>({
    jobs:0,
    applications:0,
    workers:0,
    companies:0,
    aiInvites:0,
    aiHires:0,
    alerts:0,
    pendingPayouts:0,
    openJobs:0,
  })

  useEffect(()=>{
    loadDashboard()
  },[])

  async function loadDashboard(){

    const [response, aiResponse, alertResponse] = await Promise.all([
      fetch('/api/admin/release/metrics'),
      fetch('/api/admin/release/ai'),
      fetch('/api/admin/release/alerts'),
    ])

    const data = await response.json()
    const ai = await aiResponse.json()
    const alerts = await alertResponse.json()

    setMetrics({
      jobs:data.jobs || 0,
      applications:data.applications || 0,
      workers:data.workers || 0,
      companies:data.companies || 0,
      aiInvites:ai.invitesSent || 0,
      aiHires:ai.hires || 0,
      alerts:
        (alerts.failedPayments || 0) +
        (alerts.pendingPayouts || 0),
      pendingPayouts:alerts.pendingPayouts || 0,
      openJobs:alerts.openJobs || 0,
    })

    setLoading(false)
  }


  if(loading){
    return(
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        Loading Release Center...
      </main>
    )
  }


  return(
    <main className="min-h-screen bg-slate-950 text-white p-8">

      <div className="max-w-7xl mx-auto">

        <div className="flex justify-between items-center">

          <div>
            <p className="text-cyan-400 font-black">
              CREWCALL
            </p>

            <h1 className="text-5xl font-black">
              Release Center
            </h1>
          </div>


          <Link
            href="/admin"
            className="bg-cyan-400 text-slate-950 px-5 py-3 rounded-xl font-black"
          >
            Back
          </Link>

        </div>


        <div className="grid md:grid-cols-3 gap-5 mt-10">

          <Card title="Release" value="v1.0.0-rc1" />

          <Card title="Build" value="SUCCESS" />

          <Card title="Branch" value="main" />

        </div>


        <div className="grid md:grid-cols-3 gap-5 mt-6">

          <Card title="Jobs" value={String(metrics.jobs)} />

          <Card title="Applications" value={String(metrics.applications)} />

          <Card title="Workers" value={String(metrics.workers)} />

          <Card title="Companies" value={String(metrics.companies)} />

          <Card title="AI Invites" value={String(metrics.aiInvites)} />

          <Card title="AI Hires" value={String(metrics.aiHires)} />

          <Card title="Alerts" value={String(metrics.alerts)} />

          <Card title="Open Jobs" value={String(metrics.openJobs)} />

          <Card title="Pending Payouts" value={String(metrics.pendingPayouts)} />

        </div>


      </div>

    </main>
  )
}


function Card({
  title,
  value
}:{
  title:string
  value:string
}){

  return(
    <div className="rounded-3xl border border-white/10 bg-slate-900 p-6">

      <p className="text-slate-400">
        {title}
      </p>

      <h2 className="text-3xl font-black mt-2">
        {value}
      </h2>

    </div>
  )
}
