import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { HiredEmail } from '@/emails/HiredEmail'
import { sendCrewCallEmail } from '@/lib/resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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
  pay_rate: string | null
  start_date: string | null
  location: string | null
}

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  company_name: string | null
}

export async function POST(req: Request) {
  try {
    const { jobId, workerId } = (await req.json()) as HireRequest

    if (!jobId || !workerId) {
      return NextResponse.json(
        { error: 'Missing jobId or workerId' },
        { status: 400 }
      )
    }

    const { data: job, error: jobFetchError } = await supabase
      .from('jobs')
      .select('id, title, company_id, pay_rate, start_date, location')
      .eq('id', jobId)
      .single<JobRow>()

    if (jobFetchError || !job) {
      return NextResponse.json(
        { error: jobFetchError?.message || 'Job not found' },
        { status: 404 }
      )
    }

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        assigned_worker_id: workerId,
        status: 'assigned',
      })
      .eq('id', jobId)

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 400 })
    }

    await supabase
      .from('applications')
      .update({ status: 'rejected' })
      .eq('job_id', jobId)
      .neq('worker_id', workerId)

    await supabase
      .from('applications')
      .update({ status: 'hired' })
      .eq('job_id', jobId)
      .eq('worker_id', workerId)

    await supabase.from('notifications').insert({
      user_id: workerId,
      type: 'hired',
      title: '🎉 You were hired',
      body: `You were hired for ${job.title || 'a job'}`,
      message: `You were hired for ${job.title || 'a job'}`,
      link_url: `/jobs/${jobId}`,
      job_id: jobId,
      read: false,
      is_read: false,
      created_at: new Date().toISOString(),
    })

    const { data: existingChat } = await supabase
      .from('conversations')
      .select('id')
      .eq('job_id', jobId)
      .maybeSingle()

    if (!existingChat) {
      await supabase.from('conversations').insert({
        job_id: jobId,
        company_id: job.company_id,
        worker_id: workerId,
      })
    }

    const { data: workerProfile } = await supabase
      .from('profiles')
      .select('id, email, full_name, company_name')
      .eq('id', workerId)
      .maybeSingle<ProfileRow>()

    let companyProfile: ProfileRow | null = null

    if (job.company_id) {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, company_name')
        .eq('id', job.company_id)
        .maybeSingle<ProfileRow>()

      companyProfile = data || null
    }

    if (workerProfile?.email) {
      await sendCrewCallEmail({
        to: workerProfile.email,
        subject: `You were hired for ${job.title || 'a CrewCall job'}`,
        html: HiredEmail({
          workerName: workerProfile.full_name || workerProfile.company_name,
          companyName:
            companyProfile?.company_name ||
            companyProfile?.full_name ||
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
    }

    return NextResponse.json({
      success: true,
      message: 'Worker hired successfully',
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