import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ApplicantEmail } from '@/emails/ApplicantEmail'
import { sendCrewCallEmail } from '@/lib/resend'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://crewcall-tqin.vercel.app'

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
}

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  company_name: string | null
}

export async function POST(req: Request) {
  try {
    const {
      jobId,
      workerId,
      requestedPayRate,
      negotiationMessage,
    } = (await req.json()) as ApplyRequest

    if (!jobId || !workerId) {
      return NextResponse.json(
        { error: 'Missing jobId or workerId' },
        { status: 400 }
      )
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, company_id, pay_rate, status')
      .eq('id', jobId)
      .maybeSingle<JobRow>()

    if (jobError || !job) {
      return NextResponse.json(
        { error: jobError?.message || 'Job not found' },
        { status: 404 }
      )
    }

    if (job.status && job.status !== 'open') {
      return NextResponse.json(
        { error: 'This job is not accepting applications.' },
        { status: 400 }
      )
    }

    if (!job.company_id) {
      return NextResponse.json(
        { error: 'Job company not found.' },
        { status: 400 }
      )
    }

    const { data: existing } = await supabase
      .from('applications')
      .select('id')
      .eq('job_id', jobId)
      .eq('worker_id', workerId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Already applied' }, { status: 400 })
    }

    const { data: workerProfile } = await supabase
      .from('profiles')
      .select('id, email, full_name, company_name')
      .eq('id', workerId)
      .maybeSingle<ProfileRow>()

    const { data: companyProfile } = await supabase
      .from('profiles')
      .select('id, email, full_name, company_name')
      .eq('id', job.company_id)
      .maybeSingle<ProfileRow>()

    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert({
        job_id: jobId,
        worker_id: workerId,
        status: 'pending',
        requested_pay_rate: requestedPayRate || null,
        negotiation_message: negotiationMessage || null,
        created_at: new Date().toISOString(),
      } as never)
      .select()
      .single()

    if (appError) {
      return NextResponse.json({ error: appError.message }, { status: 400 })
    }

    await supabase.from('notifications').insert({
      user_id: job.company_id,
      type: 'application',
      title: 'New application',
      body: `New applicant for ${job.title || 'your job'}`,
      message: `New applicant for ${job.title || 'your job'}`,
      job_id: jobId,
      is_read: false,
      read: false,
      created_at: new Date().toISOString(),
    } as never)

    const workerName =
      workerProfile?.full_name || workerProfile?.company_name || 'A worker'

    const companyName =
      companyProfile?.company_name || companyProfile?.full_name || 'there'

    const emailResults = {
      companyEmailSent: false,
      workerEmailSent: false,
    }

    if (companyProfile?.email) {
      try {
        await sendCrewCallEmail({
          to: companyProfile.email,
          subject: `New applicant for ${job.title || 'your job'}`,
          html: ApplicantEmail({
            companyName,
            workerName,
            jobTitle: job.title,
            requestedPay: requestedPayRate || job.pay_rate,
            message: negotiationMessage,
            actionUrl: `${appUrl}/my-jobs/${jobId}/applicants`,
          }),
          text: `${workerName} applied to ${
            job.title || 'your job'
          }. View the applicant in CrewCall: ${appUrl}/my-jobs/${jobId}/applicants`,
        })

        emailResults.companyEmailSent = true
      } catch (emailError) {
        console.error('Company application email failed:', emailError)
      }
    }

    if (workerProfile?.email) {
      try {
        await sendCrewCallEmail({
          to: workerProfile.email,
          subject: `Application submitted: ${job.title || 'CrewCall job'}`,
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
              <h2>Application submitted</h2>
              <p>Hi ${escapeHtml(workerProfile.full_name || 'there')},</p>
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
        console.error('Worker application confirmation email failed:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      application,
      ...emailResults,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Server error',
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