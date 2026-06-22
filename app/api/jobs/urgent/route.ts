import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      jobId,
      durationHours = 24,
    } = body

    const urgent_until = new Date(
      Date.now() + durationHours * 60 * 60 * 1000
    ).toISOString()

    const { error } = await supabase
      .from('jobs')
      .update({
        urgent: true,
        urgent_until,
      })
      .eq('id', jobId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, urgent_until })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    )
  }
}