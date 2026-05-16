import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { jobId, companyId } = body

    if (!jobId || !companyId) {
      return NextResponse.json(
        { error: 'Missing jobId or companyId.' },
        { status: 400 }
      )
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('id, company_id, status, payment_status')
      .eq('id', jobId)
      .maybeSingle()

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found.' },
        { status: 404 }
      )
    }

    if (job.company_id !== companyId) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 403 }
      )
    }

    if (
      job.status !== 'open' ||
      job.payment_status === 'paid'
    ) {
      return NextResponse.json(
        {
          error:
            'Only unpaid open jobs can be deleted.',
        },
        { status: 400 }
      )
    }

    await supabaseAdmin
      .from('applications')
      .delete()
      .eq('job_id', jobId)

    await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('job_id', jobId)

    await supabaseAdmin
      .from('jobs')
      .delete()
      .eq('id', jobId)

    return NextResponse.json({
      success: true,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message || 'Delete failed.',
      },
      { status: 500 }
    )
  }
}