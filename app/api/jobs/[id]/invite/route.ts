import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type InviteRequest = {
  workerId?: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function createAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || ''

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null
  }

  return authorization.slice(7).trim()
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const adminClient = createAdminClient()

    if (!adminClient) {
      return NextResponse.json(
        {
          error: 'Supabase service role is not configured.',
        },
        { status: 500 }
      )
    }

    const token = getBearerToken(request)

    if (!token) {
      return NextResponse.json(
        {
          error: 'Authentication required.',
        },
        { status: 401 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await adminClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        {
          error: authError?.message || 'Invalid login session.',
        },
        { status: 401 }
      )
    }

    const { id: jobId } = await context.params

    if (!jobId) {
      return NextResponse.json(
        {
          error: 'Missing job ID.',
        },
        { status: 400 }
      )
    }

    const body = (await request.json().catch(() => null)) as InviteRequest | null
    const workerId =
      typeof body?.workerId === 'string'
        ? body.workerId.trim()
        : ''

    if (!workerId) {
      return NextResponse.json(
        {
          error: 'Missing worker ID.',
        },
        { status: 400 }
      )
    }

    if (workerId === user.id) {
      return NextResponse.json(
        {
          error: 'You cannot invite yourself.',
        },
        { status: 400 }
      )
    }

    const { data: job, error: jobError } = await adminClient
      .from('jobs')
      .select('id, title, company_id, status')
      .eq('id', jobId)
      .maybeSingle()

    if (jobError) {
      return NextResponse.json(
        {
          error: jobError.message,
        },
        { status: 500 }
      )
    }

    if (!job) {
      return NextResponse.json(
        {
          error: 'Job not found.',
        },
        { status: 404 }
      )
    }

    if (job.company_id !== user.id) {
      return NextResponse.json(
        {
          error: 'You do not own this job.',
        },
        { status: 403 }
      )
    }

    if (
      job.status === 'completed' ||
      job.status === 'cancelled' ||
      job.status === 'closed'
    ) {
      return NextResponse.json(
        {
          error: 'Workers cannot be invited to this job.',
        },
        { status: 400 }
      )
    }

    const { data: worker, error: workerError } = await adminClient
      .from('profiles')
      .select('id, role, full_name, company_name')
      .eq('id', workerId)
      .maybeSingle()

    if (workerError) {
      return NextResponse.json(
        {
          error: workerError.message,
        },
        { status: 500 }
      )
    }

    if (!worker || worker.role !== 'worker') {
      return NextResponse.json(
        {
          error: 'Worker profile not found.',
        },
        { status: 404 }
      )
    }

    const { data: existingInvite, error: existingInviteError } =
      await adminClient
        .from('job_invites')
        .select('id, status')
        .eq('job_id', jobId)
        .eq('worker_id', workerId)
        .eq('company_id', user.id)
        .maybeSingle()

    if (existingInviteError) {
      return NextResponse.json(
        {
          error: existingInviteError.message,
        },
        { status: 500 }
      )
    }

    if (existingInvite) {
      if (existingInvite.status === 'pending') {
        return NextResponse.json({
          success: true,
          alreadyInvited: true,
          inviteId: existingInvite.id,
          message: 'This worker already has a pending invitation.',
        })
      }

      const { error: updateError } = await adminClient
        .from('job_invites')
        .update({
          status: 'pending',
          worker_seen: false,
          company_seen: true,
        })
        .eq('id', existingInvite.id)

      if (updateError) {
        return NextResponse.json(
          {
            error: updateError.message,
          },
          { status: 500 }
        )
      }

      await adminClient.from('notifications').insert({
        user_id: workerId,
        title: 'New job invitation',
        body: `You were invited to ${job.title || 'a CrewCall job'}.`,
        link_url: `/jobs/${job.id}`,
        read: false,
        is_read: false,
      })

      return NextResponse.json({
        success: true,
        alreadyInvited: false,
        inviteId: existingInvite.id,
        message: 'Worker invited successfully.',
      })
    }

    const { data: invite, error: inviteError } = await adminClient
      .from('job_invites')
      .insert({
        job_id: job.id,
        worker_id: workerId,
        company_id: user.id,
        status: 'pending',
        worker_seen: false,
        company_seen: true,
      })
      .select('id')
      .single()

    if (inviteError) {
      return NextResponse.json(
        {
          error: inviteError.message,
        },
        { status: 500 }
      )
    }

    const { error: notificationError } = await adminClient
      .from('notifications')
      .insert({
        user_id: workerId,
        title: 'New job invitation',
        body: `You were invited to ${job.title || 'a CrewCall job'}.`,
        link_url: `/jobs/${job.id}`,
        read: false,
        is_read: false,
      })

    if (notificationError) {
      console.warn(
        'Worker invitation notification could not be created:',
        notificationError.message
      )
    }

    return NextResponse.json({
      success: true,
      alreadyInvited: false,
      inviteId: invite.id,
      message: 'Worker invited successfully.',
    })
  } catch (error) {
    console.error('Worker invitation route error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to invite worker.',
      },
      { status: 500 }
    )
  }
}
