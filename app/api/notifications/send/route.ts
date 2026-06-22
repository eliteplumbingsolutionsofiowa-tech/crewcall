import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { userIds, title, message, jobId } = await req.json()

    if (!userIds?.length) {
      return NextResponse.json(
        { error: 'No recipients' },
        { status: 400 }
      )
    }

    const notifications = userIds.map((id: string) => ({
      user_id: id,
      title,
      message,
      job_id: jobId || null,
      read: false,
      created_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('notifications')
      .insert(notifications)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      sent: userIds.length,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    )
  }
}