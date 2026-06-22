import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ApplicantEmail } from '@/emails/ApplicantEmail'
import { sendCrewCallEmail } from '@/lib/resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    const { data: existing } = await supabase
      .from('applications')
      .select('id')
      .eq('job_id', jobId)
      .eq('worker_id', workerId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Already applied' }, { status: 400 })
    }

    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert({
        job_id: jobId,
        worker_id: workerId,
        status: 'pending',
        requested_pay_rate: requestedPayRate || null,
        negotiation_message: negotiationMessage || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (appError) {
      return NextResponse.json({ error: appError.message }, { status: 400 })
    }

    const { data: job } = await supabase
      .from('jobs')
      .select('id, title, company_id, pay_rate')
      .eq('id', jobId)
      .single<JobRow>()

    const { data: workerProfile } = await supabase
      .from('profiles')
      .select('id, email, full_name, company_name')
      .eq('id', workerId)
      .maybeSingle<ProfileRow>()

    if (job?.company_id) {
      await supabase.from('notifications').insert({
        user_id: job.company_id,
        type: 'application',
        title: '🚨 New Application',
        body: `New applicant for ${job.title || 'a job'}`,
        message: `New applicant for ${job.title || 'a job'}`,
        job_id: jobId,
        is_read: false,
        read: false,
        created_at: new Date().toISOString(),
      })

      const { data: companyProfile } = await supabase
        .from('profiles')
        .select('id, email, full_name, company_name')
        .eq('id', job.company_id)
        .maybeSingle<ProfileRow>()

      if (companyProfile?.email) {
        await sendCrewCallEmail({
          to: companyProfile.email,
          subject: `New applicant for ${job.title || 'your job'}`,
          html: ApplicantEmail({
            companyName: companyProfile.company_name || companyProfile.full_name,
            workerName:
              workerProfile?.full_name ||
              workerProfile?.company_name ||
              'A worker',
            jobTitle: job.title,
            requestedPay: requestedPayRate || job.pay_rate,
            message: negotiationMessage,
            actionUrl: `${appUrl}/my-jobs/${jobId}/applicants`,
          }),
          text: `${workerProfile?.full_name || 'A worker'} applied to ${
            job.title || 'your job'
          }. View the applicant in CrewCall.`,
        })
      }
    }

    return NextResponse.json({
      success: true,
      application,
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