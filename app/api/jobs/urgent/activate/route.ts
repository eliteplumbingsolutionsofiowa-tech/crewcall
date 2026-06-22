import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { jobId, plan } = await req.json()

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId' },
        { status: 400 }
      )
    }

    const hours = plan === 'premium' ? 24 : 24

    const urgent_until = new Date(
      Date.now() + hours * 60 * 60 * 1000
    ).toISOString()

    const { data, error } = await supabase
      .from('jobs')
      .update({
        urgent: true,
        urgent_until,
      })
      .eq('id', jobId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      job: data,
      urgent: true,
      urgent_until,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    )
  }
}


