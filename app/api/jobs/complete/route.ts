import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: Request) {
  try {
    const { jobId, companyId } = await req.json()

    if (!jobId || !companyId) {
      return NextResponse.json(
        { error: 'Missing jobId or companyId.' },
        { status: 400 }
      )
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('id, company_id, assigned_worker_id, status, payment_status')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { error: jobError?.message || 'Job not found.' },
        { status: 404 }
      )
    }

    if (job.company_id !== companyId) {
      return NextResponse.json(
        { error: 'You do not own this job.' },
        { status: 403 }
      )
    }

    if (!job.assigned_worker_id) {
      return NextResponse.json(
        { error: 'No worker assigned to this job.' },
        { status: 400 }
      )
    }

    if (job.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Job must be paid before it can be completed.' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Job marked completed.',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to complete job.' },
      { status: 500 }
    )
  }
}