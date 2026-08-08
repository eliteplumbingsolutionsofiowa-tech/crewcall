import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(){

  try {

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const [
      unpaid,
      pending,
      openJobs,
      unassigned
    ] = await Promise.all([

      supabase
        .from('jobs')
        .select('id')
        .eq('payment_status','pending'),

      supabase
        .from('jobs')
        .select('id')
        .eq('payout_status','pending'),

      supabase
        .from('jobs')
        .select('id')
        .eq('status','open'),

      supabase
        .from('jobs')
        .select('id')
        .is('assigned_worker_id',null),

    ])


    return NextResponse.json({

      failedPayments:
        unpaid.data?.length || 0,

      pendingPayouts:
        pending.data?.length || 0,

      openJobs:
        openJobs.data?.length || 0,

      unassignedJobs:
        unassigned.data?.length || 0,

    })


  } catch(error:any){

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
