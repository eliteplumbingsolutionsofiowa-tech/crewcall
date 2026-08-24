import { NextResponse } from 'next/server'
import { sendApnsPush } from '@/lib/push/apns'
import { createClient } from '@supabase/supabase-js'
import { ApplicantEmail } from '@/emails/ApplicantEmail'
import { sendCrewCallEmail } from '@/lib/resend'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error('Missing required Supabase environment variables.')
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://usecrewcall.com'

const MAX_PAY_RATE_LENGTH = 100
const MAX_NEGOTIATION_MESSAGE_LENGTH = 2_000

type ApplyRequest = {
  jobId?: string
  workerId?: string
  requestedPayRate?: string | null
  negotiationMessage?: string | null
}

type JobRow = {
  id: string
  title: string | null
  company_id: string | null
  pay_rate: string | null
  status: string | null
  assigned_worker_id?: string | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  company_name: string | null
  role?: string | null
}

type SupabaseErrorLike = {
  code?: string | null
  message?: string | null
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  const token = authorization.slice('Bearer '.length).trim()

  return token || null
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed || null
}

function isDuplicateApplicationError(error: SupabaseErrorLike | null) {
  if (!error) {
    return false
  }

  const message = error.message?.toLowerCase() || ''

  return (
    error.code === '23505' ||
    message.includes('duplicate key') ||
    message.includes('unique constraint')
  )
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

    const payload = (await req.json()) as ApplyRequest

    const jobId = normalizeOptionalString(payload.jobId)
    const requestedWorkerId = normalizeOptionalString(payload.workerId)
    const requestedPayRate = normalizeOptionalString(
      payload.requestedPayRate
    )
    const negotiationMessage = normalizeOptionalString(
      payload.negotiationMessage
    )

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId.' },
        { status: 400 }
      )
    }

    if (requestedWorkerId && requestedWorkerId !== user.id) {
      return NextResponse.json(
        {
          error: 'You cannot submit an application for another user.',
        },
        { status: 403 }
      )
    }

    if (
      requestedPayRate &&
      requestedPayRate.length > MAX_PAY_RATE_LENGTH
    ) {
      return NextResponse.json(
        {
          error: `Requested pay rate cannot exceed ${MAX_PAY_RATE_LENGTH} characters.`,
        },
        { status: 400 }
      )
    }

    if (
      negotiationMessage &&
      negotiationMessage.length > MAX_NEGOTIATION_MESSAGE_LENGTH
    ) {
      return NextResponse.json(
        {
          error: `Negotiation message cannot exceed ${MAX_NEGOTIATION_MESSAGE_LENGTH.toLocaleString()} characters.`,
        },
        { status: 400 }
      )
    }

    const {
      data: workerProfile,
      error: workerProfileError,
    } = await adminClient
      .from('profiles')
      .select('id, full_name, company_name, role')
      .eq('id', user.id)
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

    if (workerProfile.role !== 'worker') {
      return NextResponse.json(
        {
          error: 'Only worker accounts can apply to jobs.',
        },
        { status: 403 }
      )
    }

    const { data: job, error: jobError } = await adminClient
      .from('jobs')
      .select(
        'id, title, company_id, pay_rate, status, assigned_worker_id'
      )
      .eq('id', jobId)
      .maybeSingle<JobRow>()

    if (jobError) {
      return NextResponse.json(
        { error: jobError.message },
        { status: 400 }
      )
    }

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found.' },
        { status: 404 }
      )
    }

    if (job.status && job.status !== 'open') {
      return NextResponse.json(
        {
          error: 'This job is not accepting applications.',
        },
        { status: 400 }
      )
    }

    if (job.assigned_worker_id) {
      return NextResponse.json(
        {
          error: 'This job has already been assigned.',
        },
        { status: 400 }
      )
    }

    if (!job.company_id) {
      return NextResponse.json(
        { error: 'Job company not found.' },
        { status: 400 }
      )
    }

    if (job.company_id === user.id) {
      return NextResponse.json(
        {
          error: 'You cannot apply to your own job.',
        },
        { status: 403 }
      )
    }

    const { data: existing, error: existingError } =
      await adminClient
        .from('applications')
        .select('id, status')
        .eq('job_id', jobId)
        .eq('worker_id', user.id)
        .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 400 }
      )
    }

    if (existing) {
      return NextResponse.json(
        { error: 'You have already applied to this job.' },
        { status: 409 }
      )
    }

    const { data: companyProfile } = await adminClient
      .from('profiles')
      .select('id, full_name, company_name')
      .eq('id', job.company_id)
      .maybeSingle<ProfileRow>()

    const { data: companyAuthData, error: companyAuthError } =
      await adminClient.auth.admin.getUserById(job.company_id)

    if (companyAuthError) {
      console.error(
        'Unable to load company auth email:',
        companyAuthError
      )
    }

    const companyEmail =
      companyAuthData?.user?.email || null

    const workerEmail =
      user.email || null

    const { data: application, error: appError } =
      await adminClient
        .from('applications')
        .insert({
          job_id: jobId,
          worker_id: user.id,
          status: 'pending',
          requested_pay_rate: requestedPayRate,
          negotiation_message: negotiationMessage,
          created_at: new Date().toISOString(),
        } as never)
        .select()
        .single()

    if (appError) {
      if (isDuplicateApplicationError(appError)) {
        return NextResponse.json(
          { error: 'You have already applied to this job.' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: appError.message },
        { status: 400 }
      )
    }

    try {
      const {
        data: companyDevices,
        error: companyDevicesError,
      } = await adminClient
        .from('device_tokens')
        .select('id, token')
        .eq('user_id', job.company_id)
        .eq('platform', 'ios')

      if (companyDevicesError) {
        console.error(
          'Unable to load application push devices:',
          companyDevicesError
        )
      } else {
        const pushBody = `A worker applied for ${
          job.title || 'your CrewCall job'
        }.`

        for (const device of companyDevices || []) {
          try {
            const result = await sendApnsPush({
              deviceToken: device.token,
              title: 'New Job Application',
              body: pushBody,
              url: `/my-jobs/${job.id}/applicants`,
              badge: 1,
            })

            if (result.status !== 200) {
              console.error(
                'Application push failed:',
                {
                  deviceId: device.id,
                  status: result.status,
                  response: result.body,
                }
              )
            }
          } catch (pushError) {
            console.error(
              'Unable to send application push:',
              pushError
            )
          }
        }
      }
    } catch (pushError) {
      console.error(
        'Application push delivery failed:',
        pushError
      )
    }

    const workerName =
      workerProfile.full_name ||
      workerProfile.company_name ||
      user.email ||
      'A worker'

    const companyName =
      companyProfile?.company_name ||
      companyProfile?.full_name ||
      'there'

    const { error: notificationError } = await adminClient
      .from('notifications')
      .insert({
        user_id: job.company_id,
        type: 'application',
        title: 'New application',
        body: `${workerName} applied for ${
          job.title || 'your job'
        }.`,
        message: `${workerName} applied for ${
          job.title || 'your job'
        }.`,
        job_id: jobId,
        is_read: false,
        read: false,
        created_at: new Date().toISOString(),
      } as never)

    if (notificationError) {
      console.error(
        'Unable to create application notification:',
        notificationError
      )
    }

    const emailResults = {
      companyEmailSent: false,
      workerEmailSent: false,
    }

    if (companyEmail) {
      try {
        await sendCrewCallEmail({
          to: companyEmail,
          subject: `New applicant for ${
            job.title || 'your job'
          }`,
          html: ApplicantEmail({
            companyName,
            workerName,
            jobTitle: job.title,
            requestedPay:
              requestedPayRate || job.pay_rate,
            message: negotiationMessage,
            actionUrl: `${appUrl}/my-jobs/${jobId}/applicants`,
          }),
          text: `${workerName} applied to ${
            job.title || 'your job'
          }. View the applicant in CrewCall: ${appUrl}/my-jobs/${jobId}/applicants`,
        })

        emailResults.companyEmailSent = true
      } catch (emailError) {
        console.error(
          'Company application email failed:',
          emailError
        )
      }
    }

    if (workerEmail) {
      try {
        await sendCrewCallEmail({
          to: workerEmail,
          subject: `Application submitted: ${
            job.title || 'CrewCall job'
          }`,
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
              <h2>Application submitted</h2>
              <p>Hi ${escapeHtml(
                workerProfile.full_name || 'there'
              )},</p>
              <p>Your application for <strong>${escapeHtml(
                job.title || 'this job'
              )}</strong> has been sent.</p>
              ${
                requestedPayRate
                  ? `<p><strong>Your requested rate:</strong> ${escapeHtml(
                      requestedPayRate
                    )}</p>`
                  : ''
              }
              ${
                negotiationMessage
                  ? `<p><strong>Your message:</strong> ${escapeHtml(
                      negotiationMessage
                    )}</p>`
                  : ''
              }
              <p>
                <a href="${appUrl}/applications" style="display:inline-block;background:#06b6d4;color:#020617;padding:12px 18px;border-radius:12px;font-weight:bold;text-decoration:none;">
                  View my applications
                </a>
              </p>
            </div>
          `,
          text: `Your application for ${
            job.title || 'this job'
          } has been sent. View your applications: ${appUrl}/applications`,
        })

        emailResults.workerEmailSent = true
      } catch (emailError) {
        console.error(
          'Worker application confirmation email failed:',
          emailError
        )
      }
    }

    return NextResponse.json({
      success: true,
      application,
      ...emailResults,
    })
  } catch (error) {
    console.error('Application apply route failed:', error)

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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}