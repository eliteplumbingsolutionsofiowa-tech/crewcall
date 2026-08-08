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
      invites,
      applications,
      hired
    ] = await Promise.all([
      supabase
        .from('job_invites')
        .select('id'),

      supabase
        .from('applications')
        .select('id'),

      supabase
        .from('applications')
        .select('id')
        .eq('status','hired'),
    ])

    return NextResponse.json({

      invitesSent:
        invites.data?.length || 0,

      applications:
        applications.data?.length || 0,

      hires:
        hired.data?.length || 0,

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
