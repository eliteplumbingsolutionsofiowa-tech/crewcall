import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const [
      jobs,
      paidJobs,
      pendingPayouts,
      profiles,
      applications,
    ] = await Promise.all([
      supabase.from('jobs').select('id'),
      supabase
        .from('jobs')
        .select('id')
        .eq('payment_status','paid'),
      supabase
        .from('jobs')
        .select('id')
        .eq('payout_status','pending'),
      supabase.from('profiles').select('id,role'),
      supabase.from('applications').select('id'),
    ])

    return NextResponse.json({
      jobs: jobs.data?.length || 0,
      paidJobs: paidJobs.data?.length || 0,
      pendingPayouts: pendingPayouts.data?.length || 0,
      workers:
        profiles.data?.filter(
          (p:any)=>p.role === 'worker'
        ).length || 0,
      companies:
        profiles.data?.filter(
          (p:any)=>p.role === 'company'
        ).length || 0,
      applications: applications.data?.length || 0,
    })

  } catch (error:any) {

    return NextResponse.json(
      {
        error:error.message
      },
      {
        status:500
      }
    )

  }
}
