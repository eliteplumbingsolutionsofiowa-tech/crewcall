import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { jobId } = await req.json()

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })
    }

    // 1. Get job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, trade, location, urgent')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // 2. Get workers (simple version: trade match)
    const { data: workers, error: workerError } = await supabase
      .from('profiles')
      .select('id, full_name, trade, sms_enabled, push_enabled, role')
      .eq('role', 'worker')
      .eq('sms_enabled', true)

    if (workerError) {
      return NextResponse.json({ error: workerError.message }, { status: 400 })
    }

    const matchingWorkers =
      workers?.filter((w) =>
        !job.trade || w.trade === job.trade
      ) || []

    // 3. (SIMULATED SEND — real SMS later)
    const notifications = matchingWorkers.map((w) => ({
      user_id: w.id,
      title: '🚨 Urgent Job Available',
      message: `${job.title} - ${job.location}`,
      job_id: job.id,
    }))

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications)

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      sent_to: matchingWorkers.length,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    )
  }
}