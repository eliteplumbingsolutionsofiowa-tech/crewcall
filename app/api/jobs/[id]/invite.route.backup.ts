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

async function createInviteNotification(
  adminClient: ReturnType<typeof createAdminClient>,
  workerId: string,
  jobTitle: string | null
) {
  if (!adminClient) return

  const { error } = await adminClient
    .from('notifications')
    .insert({
      user_id: workerId,
      type: 'invite',
      title: 'New job invitation',
      body: `You were invited to ${jobTitle || 'a CrewCall job'}.

Check your Worker Invites page to review the job details and respond.`,
      link: '/worker/invites',
      link_url: '/worker/invites',
      read: false,
      is_read: false,
    })

  if (error) {
    console.error(
      'INVITE NOTIFICATION FAILED:',
      error.message
    )
  } else {
    console.log(
      'INVITE NOTIFICATION CREATED:',
      workerId
    )
  }
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
          error: authError?.message || 'Invalid session.',
        },
        { status: 401 }
      )
    }

    const { id: jobId } = await context.params

    const body =
      (await request.json().catch(() => null)) as InviteRequest | null

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
          error: 'Cannot invite yourself.',
        },
        { status: 400 }
      )
    }

    const { data: job, error: jobError } = await adminClient
      .from('jobs')
      .select(
        'id,title,company_id,status'
      )
      .eq('id', jobId)
      .maybeSingle()

    if (jobError || !job) {
      return NextResponse.json(
        {
          error: jobError?.message || 'Job not found.',
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

    const { data: worker } = await adminClient
      .from('profiles')
      .select(
        'id,role'
      )
      .eq('id', workerId)
      .maybeSingle()

    if (!worker || worker.role !== 'worker') {
      return NextResponse.json(
        {
          error: 'Worker not found.',
        },
        { status: 404 }
      )
    }

    const { data: existingInvite } = await adminClient
      .from('job_invites')
      .select(
        'id,status'
      )
      .eq('job_id', jobId)
      .eq('worker_id', workerId)
      .eq('company_id', user.id)
      .maybeSingle()

    if (existingInvite) {
      await adminClient
        .from('job_invites')
        .update({
          status: 'pending',
          worker_seen: false,
          company_seen: true,
        })
        .eq('id', existingInvite.id)

      await createInviteNotification(
        adminClient,
        workerId,
        job.title
      )

      return NextResponse.json({
        success: true,
        inviteId: existingInvite.id,
        message: 'Worker invited successfully.',
      })
    }

    const { data: invite, error: inviteError } =
      await adminClient
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

    await createInviteNotification(
      adminClient,
      workerId,
      job.title
    )

    return NextResponse.json({
      success: true,
      inviteId: invite.id,
      message: 'Worker invited successfully.',
    })

  } catch (error) {
    console.error(
      'Invite worker route error:',
      error
    )

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