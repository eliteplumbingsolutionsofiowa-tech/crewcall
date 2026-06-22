import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { jobId, workerId } = await req.json()

    if (!jobId || !workerId) {
      return NextResponse.json(
        { error: 'Missing jobId or workerId' },
        { status: 400 }
      )
    }

    // Prevent duplicate applications
    const { data: existing } = await supabase
      .from('applications')
      .select('id')
      .eq('job_id', jobId)
      .eq('worker_id', workerId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Already applied' },
        { status: 400 }
      )
    }

    // Create application
    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert({
        job_id: jobId,
        worker_id: workerId,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (appError) {
      return NextResponse.json(
        { error: appError.message },
        { status: 400 }
      )
    }

    // Get job info
    const { data: job } = await supabase
      .from('jobs')
      .select('id, title, company_id')
      .eq('id', jobId)
      .single()

    // Notify company
    if (job?.company_id) {
      await supabase.from('notifications').insert({
        user_id: job.company_id,
        title: '🚨 New Application',
        message: `New applicant for ${job.title || 'a job'}`,
        job_id: jobId,
        read: false,
        created_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      application,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    )
  }
}