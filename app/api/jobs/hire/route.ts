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

    // 1. Get job info
    const { data: job } = await supabase
      .from('jobs')
      .select('id, title, company_id')
      .eq('id', jobId)
      .single()

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // 2. Assign worker to job
    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        assigned_worker_id: workerId,
        status: 'assigned',
      })
      .eq('id', jobId)

    if (jobError) {
      return NextResponse.json(
        { error: jobError.message },
        { status: 400 }
      )
    }

    // 3. Close other applications
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

    // 4. Notify worker
    await supabase.from('notifications').insert({
      user_id: workerId,
      title: '🎉 You were hired',
      body: `You were hired for ${job.title || 'a job'}`,
      link_url: `/jobs/${jobId}`,
      read: false,
      is_read: false,
    })

    // 5. AUTO CREATE CHAT (IMPORTANT)
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

    return NextResponse.json({
      success: true,
      message: 'Worker hired successfully',
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    )
  }
}