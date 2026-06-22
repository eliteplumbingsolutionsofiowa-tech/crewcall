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

    // 1. Assign worker to job
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

    // 2. Close all other applications
    await supabase
      .from('applications')
      .update({ status: 'not_selected' })
      .eq('job_id', jobId)
      .neq('worker_id', workerId)

    // 3. Mark hired worker
    await supabase
      .from('applications')
      .update({ status: 'hired' })
      .eq('job_id', jobId)
      .eq('worker_id', workerId)

    // 4. Get job info
    const { data: job } = await supabase
      .from('jobs')
      .select('title, company_id')
      .eq('id', jobId)
      .single()

    // 5. Notify worker
    await supabase.from('notifications').insert({
      user_id: workerId,
      title: '🎉 You were hired!',
      message: `You were hired for ${job?.title || 'a job'}`,
      job_id: jobId,
      read: false,
      created_at: new Date().toISOString(),
    })

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