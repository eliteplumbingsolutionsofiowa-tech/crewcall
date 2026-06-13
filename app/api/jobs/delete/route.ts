import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Missing Supabase server environment variables.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const jobId = body?.jobId
    const companyId = body?.companyId

    if (!jobId || !companyId) {
      return NextResponse.json(
        { error: 'Missing jobId or companyId.' },
        { status: 400 }
      )
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('id, company_id')
      .eq('id', jobId)
      .maybeSingle()

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 400 })
    }

    if (!job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    }

    if (job.company_id !== companyId) {
      return NextResponse.json(
        { error: 'You do not own this job.' },
        { status: 403 }
      )
    }

    await supabaseAdmin.from('notifications').delete().eq('link_url', `/jobs/${jobId}`)
    await supabaseAdmin.from('messages').delete().eq('job_id', jobId)
    await supabaseAdmin.from('conversations').delete().eq('job_id', jobId)
    await supabaseAdmin.from('applications').delete().eq('job_id', jobId)
    await supabaseAdmin.from('job_files').delete().eq('job_id', jobId)

    const { error: deleteError } = await supabaseAdmin
      .from('jobs')
      .delete()
      .eq('id', jobId)
      .eq('company_id', companyId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to delete job.' },
      { status: 500 }
    )
  }
}