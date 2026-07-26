import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

type RecruitingJob = {
  id: string
  title: string | null
  company_id: string
  assigned_worker_id: string | null
  status: string | null
  ai_recruiting: boolean | null
  ai_recruiting_started_at: string | null
  ai_last_invite_at: string | null
  ai_next_worker_index: number | null
  ai_recruiting_complete: boolean | null
}

type RankedMatch = {
  worker_id: string
  match_score: number | null
  rank: number | null
}

type ExistingInviteRow = {
  worker_id: string
}

type FinalJobCheckRow = {
  assigned_worker_id: string | null
  status: string | null
  ai_recruiting: boolean | null
}

type WorkerProfile = {
  id: string
  role: string | null
  full_name: string | null
  company_name: string | null
  available_for_work: boolean | null
}

type JobResult = {
  jobId: string
  title: string
  status:
    | 'invited'
    | 'waiting'
    | 'completed'
    | 'stopped'
    | 'skipped'
    | 'error'
  message: string
  workerId?: string
  workerName?: string
  matchScore?: number
  rank?: number
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

const cronSecret =
  process.env.CRON_SECRET?.trim()

const inviteDelayMinutes = Math.max(
  1,
  Number(process.env.AI_RECRUIT_INVITE_DELAY_MINUTES) || 15,
)

const maxJobsPerRun = Math.max(
  1,
  Math.min(
    100,
    Number(process.env.AI_RECRUIT_MAX_JOBS_PER_RUN) || 25,
  ),
)

function createAdminClient(): any {
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

function isAuthorized(request: Request) {
  if (!cronSecret) {
    return false
  }

  const authorization =
    request.headers.get('authorization') || ''

  return authorization === `Bearer ${cronSecret}`
}

function normalizeStatus(status: unknown) {
  return String(status || '')
    .trim()
    .toLowerCase()
}

function jobCannotRecruit(job: RecruitingJob) {
  const status = normalizeStatus(job.status)

  return (
    Boolean(job.assigned_worker_id) ||
    ['assigned', 'in_progress', 'completed', 'cancelled', 'closed'].includes(
      status,
    )
  )
}

function inviteDelayHasPassed(lastInviteAt: string | null) {
  if (!lastInviteAt) {
    return true
  }

  const lastInviteTime = new Date(lastInviteAt).getTime()

  if (!Number.isFinite(lastInviteTime)) {
    return true
  }

  const delayMilliseconds =
    inviteDelayMinutes * 60 * 1000

  return Date.now() - lastInviteTime >= delayMilliseconds
}

function getWorkerName(worker: WorkerProfile) {
  return (
    worker.full_name?.trim() ||
    worker.company_name?.trim() ||
    'CrewCall Worker'
  )
}

async function markRecruitingComplete(
  adminClient: any,
  jobId: string,
  nextWorkerIndex?: number,
) {
  if (typeof nextWorkerIndex === 'number') {
    return adminClient
      .from('jobs')
      .update({
        ai_recruiting: false,
        ai_recruiting_complete: true,
        ai_next_worker_index: nextWorkerIndex,
      } as never)
      .eq('id', jobId)
  }

  return adminClient
    .from('jobs')
    .update({
      ai_recruiting: false,
      ai_recruiting_complete: true,
    } as never)
    .eq('id', jobId)
}

async function processRecruitingJob(
  adminClient: any,
  job: RecruitingJob,
): Promise<JobResult> {
  const title = job.title?.trim() || 'Untitled job'

  try {
    /*
     * Re-read the job immediately before processing it.
     * This helps prevent invitations after a worker has been assigned.
     */
    const { data: currentJob, error: currentJobError } =
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
          ai_next_worker_index,
          ai_recruiting_complete
        `)
        .eq('id', job.id)
        .maybeSingle()

    if (currentJobError) {
      throw currentJobError
    }

    if (!currentJob) {
      return {
        jobId: job.id,
        title,
        status: 'skipped',
        message: 'Job no longer exists.',
      }
    }

    const freshJob = currentJob as RecruitingJob

    if (!freshJob.ai_recruiting) {
      return {
        jobId: freshJob.id,
        title,
        status: 'skipped',
        message: 'AI recruiting is no longer active.',
      }
    }

    if (jobCannotRecruit(freshJob)) {
      const { error: stopError } =
        await markRecruitingComplete(
          adminClient,
          freshJob.id,
        )

      if (stopError) {
        throw stopError
      }

      return {
        jobId: freshJob.id,
        title,
        status: 'stopped',
        message: freshJob.assigned_worker_id
          ? 'Recruiting stopped because a worker was assigned.'
          : 'Recruiting stopped because the job is no longer open.',
      }
    }

    if (!inviteDelayHasPassed(freshJob.ai_last_invite_at)) {
      return {
        jobId: freshJob.id,
        title,
        status: 'waiting',
        message: `Waiting for the ${inviteDelayMinutes}-minute invitation delay.`,
      }
    }

    const nextWorkerIndex =
      Number(freshJob.ai_next_worker_index) || 0

    const [
      existingInvitesResult,
      matchesResult,
    ] = await Promise.all([
      adminClient
        .from('job_invites')
        .select('worker_id')
        .eq('job_id', freshJob.id)
        .eq('company_id', freshJob.company_id),

      adminClient
        .from('job_matches')
        .select('worker_id, match_score, rank')
        .eq('job_id', freshJob.id)
        .order('rank', {
          ascending: true,
          nullsFirst: false,
        })
        .order('match_score', {
          ascending: false,
        }),
    ])

    if (existingInvitesResult.error) {
      throw existingInvitesResult.error
    }

    if (matchesResult.error) {
      throw matchesResult.error
    }

    const existingInvites =
      (existingInvitesResult.data || []) as ExistingInviteRow[]

    const invitedWorkerIds = new Set(
      existingInvites.map((invite) => invite.worker_id),
    )

    const rankedMatches =
      (matchesResult.data || []) as RankedMatch[]

    let selectedMatch: RankedMatch | null = null
    let selectedWorker: WorkerProfile | null = null
    let selectedIndex = -1
    let searchIndex = nextWorkerIndex

    /*
     * Continue past deleted, invalid, unavailable, or already-invited
     * worker profiles during the same cron run.
     */
    while (searchIndex < rankedMatches.length) {
      const candidate = rankedMatches[searchIndex]

      if (
        !candidate?.worker_id ||
        candidate.worker_id === freshJob.company_id ||
        invitedWorkerIds.has(candidate.worker_id)
      ) {
        searchIndex += 1
        continue
      }

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
          .eq('id', candidate.worker_id)
          .maybeSingle()

      if (workerError) {
        console.error(
          `Auto recruiter worker load failed for ${candidate.worker_id}:`,
          workerError,
        )

        searchIndex += 1
        continue
      }

      const profile = worker as WorkerProfile | null

      if (
        !profile ||
        profile.role !== 'worker' ||
        profile.available_for_work === false
      ) {
        searchIndex += 1
        continue
      }

      selectedMatch = candidate
      selectedWorker = profile
      selectedIndex = searchIndex
      break
    }

    if (!selectedMatch || !selectedWorker) {
      const { error: completeError } =
        await markRecruitingComplete(
          adminClient,
          freshJob.id,
          rankedMatches.length,
        )

      if (completeError) {
        throw completeError
      }

      return {
        jobId: freshJob.id,
        title,
        status: 'completed',
        message:
          rankedMatches.length === 0
            ? 'No ranked matches were available.'
            : 'All eligible matched workers have been contacted.',
      }
    }

    /*
     * Check once more immediately before inserting the invitation.
     */
    const { data: finalJobCheckData, error: finalJobCheckError } =
      await adminClient
        .from('jobs')
        .select('assigned_worker_id, status, ai_recruiting')
        .eq('id', freshJob.id)
        .maybeSingle()

    if (finalJobCheckError) {
      throw finalJobCheckError
    }

    const finalJobCheck =
      finalJobCheckData as FinalJobCheckRow | null

    if (
      !finalJobCheck ||
      !finalJobCheck.ai_recruiting ||
      finalJobCheck.assigned_worker_id ||
      ['assigned', 'in_progress', 'completed', 'cancelled', 'closed'].includes(
        normalizeStatus(finalJobCheck.status),
      )
    ) {
      await markRecruitingComplete(
        adminClient,
        freshJob.id,
      )

      return {
        jobId: freshJob.id,
        title,
        status: 'stopped',
        message:
          'Recruiting stopped because the job changed before the invitation was sent.',
      }
    }

    const { data: existingInvite } =
      await adminClient
        .from('job_invites')
        .select('id')
        .eq('job_id', freshJob.id)
        .eq('worker_id', selectedWorker.id)
        .maybeSingle()

    if (existingInvite) {
      await adminClient
        .from('jobs')
        .update({
          ai_next_worker_index: selectedIndex + 1,
        })
        .eq('id', freshJob.id)

      return {
        jobId: freshJob.id,
        title,
        status: 'skipped',
        message:
          'The selected worker had already been invited. The recruiter advanced to the next worker.',
      }
    }

    const { data: invite, error: inviteError } =
      await adminClient
        .from('job_invites')
        .insert({
          job_id: freshJob.id,
          worker_id: selectedWorker.id,
          company_id: freshJob.company_id,
          status: 'pending',
          worker_seen: false,
          company_seen: true,
        })
        .select('id')
        .single()

    if (inviteError) {
      /*
       * A unique constraint may reject a duplicate created by
       * two overlapping cron executions. Treat that safely.
       */
      if (
        String(inviteError.message || '')
          .toLowerCase()
          .includes('duplicate')
      ) {
        await adminClient
          .from('jobs')
          .update({
            ai_next_worker_index: selectedIndex + 1,
          })
          .eq('id', freshJob.id)

        return {
          jobId: freshJob.id,
          title,
          status: 'skipped',
          message:
            'A duplicate invitation was prevented. The recruiter advanced safely.',
        }
      }

      throw inviteError
    }

    const workerName = getWorkerName(selectedWorker)
    const now = new Date().toISOString()
    const nextIndex = selectedIndex + 1

    const [
      notificationResult,
      jobUpdateResult,
    ] = await Promise.all([
      adminClient
        .from('notifications')
        .insert({
          user_id: selectedWorker.id,
          title: 'New job invitation',
          body: `You were invited to ${title}.`,
          link_url: `/jobs/${freshJob.id}`,
          read: false,
          is_read: false,
        }),

      adminClient
        .from('jobs')
        .update({
          ai_recruiting: true,
          ai_recruiting_started_at:
            freshJob.ai_recruiting_started_at || now,
          ai_last_invite_at: now,
          ai_next_worker_index: nextIndex,
          ai_recruiting_complete: false,
        })
        .eq('id', freshJob.id)
        .eq('ai_recruiting', true),
    ])

    if (notificationResult.error) {
      console.error(
        `Auto recruiter notification failed for invite ${invite.id}:`,
        notificationResult.error,
      )
    }

    if (jobUpdateResult.error) {
      throw jobUpdateResult.error
    }

    return {
      jobId: freshJob.id,
      title,
      status: 'invited',
      message: `Invitation sent automatically to ${workerName}.`,
      workerId: selectedWorker.id,
      workerName,
      matchScore:
        Number(selectedMatch.match_score) || 0,
      rank:
        Number(selectedMatch.rank) ||
        selectedIndex + 1,
    }
  } catch (error) {
    console.error(
      `Auto recruiter failed for job ${job.id}:`,
      error,
    )

    return {
      jobId: job.id,
      title,
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Unknown recruiting error.',
    }
  }
}

async function runAutoRecruitCron(request: Request) {
  if (!cronSecret) {
    return NextResponse.json(
      {
        error: 'CRON_SECRET is not configured.',
      },
      { status: 500 },
    )
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        error: 'Unauthorized cron request.',
      },
      { status: 401 },
    )
  }

  const adminClient = createAdminClient()

  if (!adminClient) {
    return NextResponse.json(
      {
        error: 'Supabase service role is not configured.',
      },
      { status: 500 },
    )
  }

  const startedAt = new Date().toISOString()

  try {
    const { data: jobs, error: jobsError } =
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
          ai_next_worker_index,
          ai_recruiting_complete
        `)
        .eq('ai_recruiting', true)
        .order('ai_last_invite_at', {
          ascending: true,
          nullsFirst: true,
        })
        .limit(maxJobsPerRun)

    if (jobsError) {
      throw jobsError
    }

    const activeJobs =
      (jobs || []) as RecruitingJob[]

    const results: JobResult[] = []

    /*
     * Process sequentially to avoid large bursts of database writes
     * and worker notifications.
     */
    for (const job of activeJobs) {
      const result =
        await processRecruitingJob(adminClient, job)

      results.push(result)
    }

    const counts = results.reduce(
      (summary, result) => {
        summary[result.status] += 1
        return summary
      },
      {
        invited: 0,
        waiting: 0,
        completed: 0,
        stopped: 0,
        skipped: 0,
        error: 0,
      },
    )

    return NextResponse.json({
      success: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      inviteDelayMinutes,
      maxJobsPerRun,
      activeJobsFound: activeJobs.length,
      counts,
      results,
    })
  } catch (error) {
    console.error('Auto recruiter cron error:', error)

    return NextResponse.json(
      {
        success: false,
        startedAt,
        finishedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : 'Unable to run automatic recruiting.',
      },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  return runAutoRecruitCron(request)
}

export async function POST(request: Request) {
  return runAutoRecruitCron(request)
}
