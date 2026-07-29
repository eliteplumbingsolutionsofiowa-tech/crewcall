import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function POST(req: Request) {
  try {
    const supabase = getAdminClient()

    const { inviteId, workerId } = await req.json()

    if (!inviteId || !workerId) {
      return NextResponse.json(
        { error: 'Missing inviteId or workerId' },
        { status: 400 }
      )
    }

    const { data: invite, error: inviteLookupError } =
      await supabase
        .from('job_invites')
        .select('id, job_id')
        .eq('id', inviteId)
        .single()

    if (inviteLookupError || !invite) {
      throw new Error('Invite not found')
    }


    const { error: inviteUpdateError } =
      await supabase
        .from('job_invites')
        .update({
          status: 'accepted',
          worker_seen: true,
          company_seen: false,
        })
        .eq('id', inviteId)

    if (inviteUpdateError) {
      throw inviteUpdateError
    }


    const { data: jobBefore } =
      await supabase
        .from('jobs')
        .select('id,status,assigned_worker_id')
        .eq('id', invite.job_id)
        .single()


    console.log('JOB BEFORE UPDATE', jobBefore)


    const { error: jobUpdateError } =
      await supabase
        .from('jobs')
        .update({
          status: 'assigned',
          assigned_worker_id: workerId,
        })
        .eq('id', invite.job_id)


    if (jobUpdateError) {
      throw jobUpdateError
    }


    const { data: jobAfter, error: verifyError } =
      await supabase
        .from('jobs')
        .select('id,status,assigned_worker_id')
        .eq('id', invite.job_id)
        .single()


    if (verifyError) {
      throw verifyError
    }


    console.log('JOB AFTER UPDATE', jobAfter)


    if (
      jobAfter.status !== 'assigned' ||
      jobAfter.assigned_worker_id !== workerId
    ) {
      throw new Error('Job did not assign correctly')
    }


    const { error: applicationError } =
      await supabase
        .from('applications')
        .upsert({
          job_id: invite.job_id,
          worker_id: workerId,
          status: 'accepted',
        }, {
          onConflict: 'job_id,worker_id',
        })


    if (applicationError) {
      throw applicationError
    }


    return NextResponse.json({
      success: true,
      job: jobAfter,
    })


  } catch (error) {

    console.error(error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Accept failed',
      },
      {
        status: 500,
      }
    )
  }
}
