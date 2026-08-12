import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { HiredEmail } from '@/emails/HiredEmail'
import { sendCrewCallEmail } from '@/lib/resend'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY

if (
  !supabaseUrl ||
  !supabaseAnonKey ||
  !supabaseServiceRoleKey
) {
  throw new Error(
    'Missing required Supabase environment variables.'
  )
}

const authClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

const adminClient = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://crewcall-tqin.vercel.app'

type HireRequest = {
  jobId?: string
  workerId?: string
}

type JobRow = {
  id: string
  title: string | null
  company_id: string | null
  assigned_worker_id: string | null
  pay_rate: string | null
  start_date: string | null
  location: string | null
  status: string | null
}

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  company_name: string | null
  role?: string | null
}

type ApplicationRow = {
  id: string
  worker_id: string
  status: string | null
  requested_pay: string | null
  requested_pay_rate: string | null
  company_counter_offer: string | null
  negotiation_status: string | null
}

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get('authorization')

  if (
    !authorization ||
    !authorization.startsWith('Bearer ')
  ) {
    return null
  }

  const token = authorization
    .slice('Bearer '.length)
    .trim()

  return token || null
}

function normalizeString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed || null
}

export async function POST(req: Request) {
  try {
    const accessToken = getBearerToken(req)

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authorization token required.' },
        { status: 401 }
      )
    }

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            userError?.message ||
            'Unable to verify the authenticated user.',
        },
        { status: 401 }
      )
    }

    const payload = (await req.json()) as HireRequest

    const jobId = normalizeString(payload.jobId)
    const workerId = normalizeString(payload.workerId)

    if (!jobId || !workerId) {
      return NextResponse.json(
        { error: 'Missing jobId or workerId.' },
        { status: 400 }
      )
    }

    if (workerId === user.id) {
      return NextResponse.json(
        {
          error:
            'A company cannot hire itself for a job.',
        },
        { status: 403 }
      )
    }

    const { data: job, error: jobFetchError } =
      await adminClient
        .from('jobs')
        .select(
          `
          id,
          title,
          company_id,
          assigned_worker_id,
          pay_rate,
          start_date,
          location,
          status
        `
        )
        .eq('id', jobId)
        .maybeSingle<JobRow>()

    if (jobFetchError) {
      return NextResponse.json(
        { error: jobFetchError.message },
        { status: 400 }
      )
    }

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found.' },
        { status: 404 }
      )
    }

    if (job.company_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not own this job.' },
        { status: 403 }
      )
    }

    if (job.assigned_worker_id) {
      if (job.assigned_worker_id === workerId) {
        return NextResponse.json({
          success: true,
          message: 'This worker is already hired.',
          alreadyHired: true,
        })
      }

      return NextResponse.json(
        {
          error:
            'This job already has an assigned worker.',
        },
        { status: 409 }
      )
    }

    if (job.status && job.status !== 'open') {
      return NextResponse.json(
        {
          error:
            'Only open jobs can have a worker hired.',
        },
        { status: 409 }
      )
    }

    const {
      data: companyProfile,
      error: companyProfileError,
    } = await adminClient
      .from('profiles')
      .select(
        'id, email, full_name, company_name, role'
      )
      .eq('id', user.id)
      .maybeSingle<ProfileRow>()

    if (companyProfileError) {
      return NextResponse.json(
        { error: companyProfileError.message },
        { status: 400 }
      )
    }

    if (!companyProfile) {
      return NextResponse.json(
        { error: 'Company profile not found.' },
        { status: 404 }
      )
    }

    if (
      companyProfile.role &&
      companyProfile.role !== 'company'
    ) {
      return NextResponse.json(
        {
          error:
            'Only company accounts can hire workers.',
        },
        { status: 403 }
      )
    }

    const {
      data: workerProfile,
      error: workerProfileError,
    } = await adminClient
      .from('profiles')
      .select(
        'id, email, full_name, company_name, role'
      )
      .eq('id', workerId)
      .maybeSingle<ProfileRow>()

    if (workerProfileError) {
      return NextResponse.json(
        { error: workerProfileError.message },
        { status: 400 }
      )
    }

    if (!workerProfile) {
      return NextResponse.json(
        { error: 'Worker profile not found.' },
        { status: 404 }
      )
    }

    if (
      workerProfile.role &&
      workerProfile.role !== 'worker'
    ) {
      return NextResponse.json(
        {
          error:
            'The selected account is not a worker.',
        },
        { status: 400 }
      )
    }

    const {
      data: application,
      error: applicationError,
    } = await adminClient
      .from('applications')
      .select('id, worker_id, status')
      .eq('job_id', jobId)
      .eq('worker_id', workerId)
      .maybeSingle<ApplicationRow>()

    if (applicationError) {
      return NextResponse.json(
        { error: applicationError.message },
        { status: 400 }
      )
    }

    if (!application) {
      return NextResponse.json(
        {
          error:
            'This worker has not applied to the job.',
        },
        { status: 409 }
      )
    }

    if (
      application.status === 'withdrawn' ||
      application.status === 'rejected' ||
      application.status === 'not_selected'
    ) {
      return NextResponse.json(
        {
          error:
            'This application is no longer eligible for hiring.',
        },
        { status: 409 }
      )
    }

    const hasNegotiatedOffer = Boolean(
      application.requested_pay_rate ||
      application.requested_pay ||
      application.company_counter_offer
    )

    if (
      hasNegotiatedOffer &&
      application.negotiation_status !== 'accepted'
    ) {
      return NextResponse.json(
        {
          error:
            'Accept the negotiated rate before hiring this worker.',
        },
        { status: 409 }
      )
    }

    const finalPay =
      application.company_counter_offer ||
      application.requested_pay_rate ||
      application.requested_pay ||
      job.pay_rate

    const hiredAt = new Date().toISOString()

    const {
      data: updatedJob,
      error: jobUpdateError,
    } = await adminClient
      .from('jobs')
      .update({
        assigned_worker_id: workerId,
        assigned_application_id: application.id,
        status: 'assigned',
        pay_rate: finalPay,
      })
      .eq('id', jobId)
      .eq('company_id', user.id)
      .is('assigned_worker_id', null)
      .eq('status', 'open')
      .select(
        'id, assigned_worker_id, status'
      )
      .maybeSingle()

    if (jobUpdateError) {
      return NextResponse.json(
        { error: jobUpdateError.message },
        { status: 400 }
      )
    }

    if (!updatedJob) {
      return NextResponse.json(
        {
          error:
            'The job changed before the hire completed. Refresh and try again.',
        },
        { status: 409 }
      )
    }

    const {
      error: rejectedApplicationsError,
    } = await adminClient
      .from('applications')
      .update({ status: 'rejected' })
      .eq('job_id', jobId)
      .neq('worker_id', workerId)

    if (rejectedApplicationsError) {
      console.error(
        'Unable to reject other applications:',
        rejectedApplicationsError
      )
    }

    const {
      error: hiredApplicationError,
    } = await adminClient
      .from('applications')
      .update({ status: 'hired' })
      .eq('id', application.id)
      .eq('worker_id', workerId)

    if (hiredApplicationError) {
      console.error(
        'Unable to mark application as hired:',
        hiredApplicationError
      )
    }

    const {
      error: notificationError,
    } = await adminClient
      .from('notifications')
      .insert({
        user_id: workerId,
        type: 'hired',
        title: '🎉 You were hired',
        body: `You were hired for ${
          job.title || 'a job'
        }`,
        message: `You were hired for ${
          job.title || 'a job'
        }`,
        link_url: `/jobs/${jobId}`,
        job_id: jobId,
        read: false,
        is_read: false,
        created_at: hiredAt,
      })

    if (notificationError) {
      console.error(
        'Unable to create hired notification:',
        notificationError
      )
    }

    const { data: existingChat } =
      await adminClient
        .from('conversations')
        .select('id')
        .eq('job_id', jobId)
        .maybeSingle()

    if (!existingChat) {
      const {
        error: conversationError,
      } = await adminClient
        .from('conversations')
        .insert({
          job_id: jobId,
          company_id: user.id,
          worker_id: workerId,
        })

      if (conversationError) {
        console.error(
          'Unable to create job conversation:',
          conversationError
        )
      }
    }

    let workerEmailSent = false

    if (workerProfile.email) {
      try {
        await sendCrewCallEmail({
          to: workerProfile.email,
          subject: `You were hired for ${
            job.title || 'a CrewCall job'
          }`,
          html: HiredEmail({
            workerName:
              workerProfile.full_name ||
              workerProfile.company_name,
            companyName:
              companyProfile.company_name ||
              companyProfile.full_name ||
              'A company',
            jobTitle: job.title,
            payRate: job.pay_rate,
            startDate: job.start_date,
            location: job.location,
            actionUrl: `${appUrl}/jobs/${jobId}`,
          }),
          text: `You were hired for ${
            job.title || 'a CrewCall job'
          }. Open CrewCall to view the job details.`,
        })

        workerEmailSent = true
      } catch (emailError) {
        console.error(
          'Hired worker email failed:',
          emailError
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Worker hired successfully.',
      job: updatedJob,
      workerEmailSent,
    })
  } catch (error) {
    console.error('Job hire route failed:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Server error',
      },
      { status: 500 }
    )
  }
}