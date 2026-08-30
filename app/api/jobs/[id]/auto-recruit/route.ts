import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type AutoRecruitAction =
  | 'start'
  | 'pause'
  | 'stop'
  | 'restart'
  | 'send_next'
  | 'status'

type AutoRecruitRequest = {
  action?: AutoRecruitAction
}

type RankedMatch = {
  worker_id: string
  match_score: number | null
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function sendCrewCallNotificationEmail({
  userIds,
  title,
  message,
  jobId,
}: {
  userIds: string[]
  title: string
  message: string
  jobId: string
}) {
  try {
    await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIds,
          title,
          message,
          jobId,
          sendEmail: true,
        }),
      },
    )
  } catch (error) {
    console.error(
      'CrewCall email notification failed:',
      error,
    )
  }
}

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

async function logRecruitEvent(
  adminClient: any,
  {
    jobId,
    workerId = null,
    eventType,
    message,
    metadata = {},
  }: {
    jobId: string
    workerId?: string | null
    eventType: string
    message: string
    metadata?: Record<string, unknown>
  }
) {
  const { error } = await adminClient
    .from('ai_recruit_events')
    .insert({
      job_id: jobId,
      worker_id: workerId,
      event_type: eventType,
      message,
      metadata,
    })

  if (error) {
    console.error(
      'AI recruiter event logging error:',
      error
    )
  }
}

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get('authorization') || ''

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null
  }

  return authorization.slice(7).trim()
}

function isClosedStatus(status: unknown) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase()

  return ['completed', 'cancelled', 'closed'].includes(normalized)
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
          error:
            authError?.message ||
            'Invalid login session.',
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

    const body = (await request
      .json()
      .catch(() => null)) as AutoRecruitRequest | null

    const action: AutoRecruitAction =
      body?.action || 'status'

    const { data: job, error: jobError } =
      await adminClient
        .from('jobs')
        .select(`
          id,
          title,
          company_id,
          assigned_worker_id,
          status,
          ai_recruiting,
          ai_recruiting_started_at,
          ai_last_invite_at,
          ai_next_action_at,
          ai_attempt_count,
          ai_next_worker_index,
          ai_recruiting_complete
        `)
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

    if (action === 'status') {
      const { count: inviteCount } =
        await adminClient
          .from('job_invites')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('job_id', jobId)
          .eq('company_id', user.id)

      return NextResponse.json({
        success: true,
        jobId,
        recruiting: Boolean(job.ai_recruiting),
        complete: Boolean(job.ai_recruiting_complete),
        startedAt: job.ai_recruiting_started_at,
        lastInviteAt: job.ai_last_invite_at,
        nextWorkerIndex:
          Number(job.ai_next_worker_index) || 0,
        inviteCount: inviteCount || 0,
        assignedWorkerId:
          job.assigned_worker_id || null,
      })
    }

    if (action === 'pause') {
      const { error: pauseError } =
        await adminClient
          .from('jobs')
          .update({
            ai_recruiting: false,
          })
          .eq('id', jobId)

      if (pauseError) {
        return NextResponse.json(
          {
            error: pauseError.message,
          },
          { status: 500 }
        )
      }

      await logRecruitEvent(adminClient, {
        jobId,
        eventType: 'recruiting_paused',
        message: 'AI recruiting paused.',
      })

      return NextResponse.json({
        success: true,
        recruiting: false,
        complete: false,
        message: 'AI recruiting paused.',
      })
    }

    if (action === 'stop') {
      const { error: stopError } =
        await adminClient
          .from('jobs')
          .update({
            ai_recruiting: false,
            ai_recruiting_complete: true,
          })
          .eq('id', jobId)

      if (stopError) {
        return NextResponse.json(
          {
            error: stopError.message,
          },
          { status: 500 }
        )
      }

      await logRecruitEvent(adminClient, {
        jobId,
        eventType: 'recruiting_stopped',
        message: 'AI recruiting stopped.',
      })

      return NextResponse.json({
        success: true,
        recruiting: false,
        complete: true,
        message: 'AI recruiting stopped.',
      })
    }

    if (
      job.assigned_worker_id ||
      isClosedStatus(job.status)
    ) {
      await adminClient
        .from('jobs')
        .update({
          ai_recruiting: false,
          ai_recruiting_complete: true,
        })
        .eq('id', jobId)

      await logRecruitEvent(adminClient, {
        jobId,
        workerId: job.assigned_worker_id || null,
        eventType: job.assigned_worker_id
          ? 'position_filled'
          : 'recruiting_unavailable',
        message: job.assigned_worker_id
          ? 'The job already has an assigned worker.'
          : 'AI recruiting is unavailable for this job.',
      })

      return NextResponse.json(
        {
          success: true,
          recruiting: false,
          complete: true,
          assignedWorkerId:
            job.assigned_worker_id || null,
          message: job.assigned_worker_id
            ? 'The job already has an assigned worker.'
            : 'AI recruiting is unavailable for this job.',
        },
        { status: 200 }
      )
    }

    let nextWorkerIndex =
      Number(job.ai_next_worker_index) || 0

    if (action === 'start' || action === 'restart') {
      if (action === 'restart') {
        nextWorkerIndex = 0
      }

      const { error: startError } =
        await adminClient
          .from('jobs')
          .update({
            ai_recruiting: true,
            ai_recruiting_started_at:
              action === 'restart' ||
              !job.ai_recruiting_started_at
                ? new Date().toISOString()
                : job.ai_recruiting_started_at,
            ai_next_worker_index: nextWorkerIndex,
            ai_recruiting_complete: false,
          })
          .eq('id', jobId)

      if (startError) {
        return NextResponse.json(
          {
            error: startError.message,
          },
          { status: 500 }
        )
      }

      await logRecruitEvent(adminClient, {
        jobId,
        eventType:
          action === 'restart'
            ? 'recruiting_restarted'
            : 'recruiting_started',
        message:
          action === 'restart'
            ? 'AI recruiting restarted.'
            : 'AI recruiting started.',
        metadata: {
          nextWorkerIndex,
        },
      })

      if (action === 'start') {
        return NextResponse.json({
          success: true,
          recruiting: true,
          complete: false,
          nextWorkerIndex,
          message: 'AI recruiting started.',
        })
      }
    }

    if (
      action !== 'send_next' &&
      action !== 'restart'
    ) {
      return NextResponse.json(
        {
          error: 'Unsupported auto-recruit action.',
        },
        { status: 400 }
      )
    }

    const { data: existingInvites, error: inviteLoadError } =
      await adminClient
        .from('job_invites')
        .select('worker_id')
        .eq('job_id', jobId)
        .eq('company_id', user.id)

    if (inviteLoadError) {
      console.error('AUTO RECRUIT inviteLoadError:', inviteLoadError)
      return NextResponse.json(
        {
          error: inviteLoadError.message,
        },
        { status: 500 }
      )
    }

    const invitedWorkerIds = new Set(
      (existingInvites || []).map(
        (invite) => invite.worker_id
      )
    )

    const { data: matches, error: matchError } =
      await adminClient
        .from('job_matches')
        .select('worker_id, match_score')
        .eq('job_id', jobId)

    if (matchError) {
      console.error('AUTO RECRUIT matchError:', matchError)
      return NextResponse.json(
        {
          error: matchError.message,
        },
        { status: 500 }
      )
    }

    const rankedMatches =
      (matches || []) as RankedMatch[]

    const nextMatch = rankedMatches.find(
      (match, index) =>
        index >= nextWorkerIndex &&
        Boolean(match.worker_id) &&
        match.worker_id !== user.id &&
        !invitedWorkerIds.has(match.worker_id)
    )

    if (!nextMatch) {
      await adminClient
        .from('jobs')
        .update({
          ai_recruiting: false,
          ai_recruiting_complete: true,
          ai_next_worker_index:
            rankedMatches.length,
        })
        .eq('id', jobId)

      const completionMessage =
        rankedMatches.length === 0
          ? 'No ranked workers are available. Run job matching first.'
          : 'All matched workers have already been invited.'

      await logRecruitEvent(adminClient, {
        jobId,
        eventType:
          rankedMatches.length === 0
            ? 'no_matches_available'
            : 'recruiting_complete',
        message: completionMessage,
        metadata: {
          totalMatches: rankedMatches.length,
        },
      })

      return NextResponse.json({
        success: true,
        recruiting: false,
        complete: true,
        totalMatches: rankedMatches.length,
        message: completionMessage,
      })
    }

    const matchIndex = rankedMatches.findIndex(
      (match) =>
        match.worker_id === nextMatch.worker_id
    )

    const { data: worker, error: workerError } =
      await adminClient
        .from('profiles')
        .select(`
          id,
          role,
          full_name,
          company_name,
          available_for_work
        `)
        .eq('id', nextMatch.worker_id)
        .maybeSingle()

    if (workerError) {
      console.error('AUTO RECRUIT workerError:', workerError)
      return NextResponse.json(
        {
          error: workerError.message,
        },
        { status: 500 }
      )
    }

    if (!worker || worker.role !== 'worker') {
      await adminClient
        .from('jobs')
        .update({
          ai_next_worker_index:
            Math.max(matchIndex + 1, nextWorkerIndex + 1),
        })
        .eq('id', jobId)

      return NextResponse.json(
        {
          error:
            'The next matched worker profile is unavailable. Run Send Next again.',
        },
        { status: 409 }
      )
    }

    const { data: invite, error: createInviteError } =
      await adminClient
        .from('job_invites')
        .insert({
          job_id: jobId,
          worker_id: worker.id,
          company_id: user.id,
          status: 'pending',
          worker_seen: false,
          company_seen: true,
        })
        .select('id')
        .single()

    if (createInviteError) {
      console.error('AUTO RECRUIT createInviteError:', createInviteError)
      return NextResponse.json(
        {
          error: createInviteError.message,
        },
        { status: 500 }
      )
    }

    const workerName =
      worker.full_name?.trim() ||
      worker.company_name?.trim() ||
      'CrewCall Worker'

    const notificationResult =
      await adminClient
        .from('notifications')
        .insert({
          user_id: worker.id,
          type: 'invite',
          title: '🤖 CrewCall AI matched you',
          body: `You were selected for ${
            job.title || 'a CrewCall job'
          }. Your AI match score is ${
            nextMatch.match_score || 0
          }%.`,
          link_url: `/jobs/${jobId}`,
          read: false,
          is_read: false,
        })

    if (notificationResult.error) {
      console.error(
        'Auto recruiter notification error:',
        notificationResult.error
      )
    }

    const companyNotificationResult =
      await adminClient
        .from('notifications')
        .insert({
          user_id: user.id,
          title: '🤖 AI Recruiter found a match',
          body: `${workerName} was selected for ${
            job.title || 'your CrewCall job'
          } with a ${
            nextMatch.match_score || 0
          }% match score.`,
          link_url: `/my-jobs/${jobId}/recruiter`,
          read: false,
          is_read: false,
        })

    if (companyNotificationResult.error) {
      console.error(
        'AI recruiter company notification error:',
        companyNotificationResult.error
      )
    }

    await sendCrewCallNotificationEmail({
      userIds: [user.id],
      title: '🤖 AI Recruiter found a match',
      message: `${workerName} was selected for ${
        job.title || 'your CrewCall job'
      } with a ${
        nextMatch.match_score || 0
      }% match score.`,
      jobId,
    })

    await sendCrewCallNotificationEmail({
      userIds: [worker.id],
      title: '🤖 CrewCall AI matched you',
      message: `You were selected for ${
        job.title || 'a CrewCall job'
      }. Your AI match score is ${
        nextMatch.match_score || 0
      }%.`,
      jobId,
    })

    const nextIndex = Math.max(
      matchIndex + 1,
      nextWorkerIndex + 1
    )

    const nowDate = new Date()
    const now = nowDate.toISOString()

    const nextAction = new Date(
      nowDate.getTime() + 24 * 60 * 60 * 1000,
    ).toISOString()

    const { error: jobUpdateError } =
      await adminClient
        .from('jobs')
        .update({
          ai_recruiting: true,
          ai_recruiting_started_at:
            job.ai_recruiting_started_at || now,
          ai_last_invite_at: now,
          ai_next_action_at: nextAction,
          ai_attempt_count:
            Number(job.ai_attempt_count || 0) + 1,
          ai_next_worker_index: nextIndex,
          ai_recruiting_complete: false,
        })
        .eq('id', jobId)

    if (jobUpdateError) {
      console.error('AUTO RECRUIT jobUpdateError:', jobUpdateError)
      return NextResponse.json(
        {
          error: jobUpdateError.message,
        },
        { status: 500 }
      )
    }

    await logRecruitEvent(adminClient, {
      jobId,
      workerId: worker.id,
      eventType: 'invite_sent',
      message: `Invitation sent to ${workerName}.`,
      metadata: {
        inviteId: invite.id,
        workerName,
        matchScore:
          Number(nextMatch.match_score) || 0,
        rank:
          0 ||
          matchIndex + 1,
        nextWorkerIndex: nextIndex,
        totalMatches: rankedMatches.length,
      },
    })

    return NextResponse.json({
      success: true,
      recruiting: true,
      complete: false,
      inviteId: invite.id,
      invitedWorker: {
        id: worker.id,
        name: workerName,
        matchScore:
          Number(nextMatch.match_score) || 0,
        rank:
          0 ||
          matchIndex + 1,
      },
      nextWorkerIndex: nextIndex,
      totalMatches: rankedMatches.length,
      message: `Invitation sent to ${workerName}.`,
    })
  } catch (error) {
    console.error(
      'AUTO RECRUIT FAILURE DETAIL:',
      error instanceof Error ? error.stack : error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to run AI recruiting.',
      },
      { status: 500 }
    )
  }
}
