import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const resendApiKey = process.env.RESEND_API_KEY
const emailFrom = process.env.EMAIL_FROM || 'CrewCall <notifications@crewcall.app>'

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

type NotificationRequest = {
  userIds?: string[]
  title?: string
  message?: string
  jobId?: string | null
  sendEmail?: boolean
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as NotificationRequest
    const { userIds, title, message, jobId, sendEmail = true } = body

    if (!userIds || userIds.length === 0) {
      return NextResponse.json({ error: 'No recipients' }, { status: 400 })
    }

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Missing title or message' },
        { status: 400 }
      )
    }

    const notifications = userIds.map((id) => ({
      user_id: id,
      title,
      message,
      job_id: jobId || null,
      read: false,
      is_read: false,
      created_at: new Date().toISOString(),
    }))

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notifications as never)

    if (notificationError) {
      return NextResponse.json(
        { error: notificationError.message },
        { status: 400 }
      )
    }

    let emailsAttempted = 0
    let emailsSent = 0

    if (sendEmail && resendApiKey) {
      const emailResults = await Promise.allSettled(
        userIds.map(async (userId) => {
          const { data, error } = await supabase.auth.admin.getUserById(userId)

          if (error || !data.user?.email) {
            return false
          }

          emailsAttempted += 1

          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: emailFrom,
              to: data.user.email,
              subject: title,
              html: `
                <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
                  <h2>${escapeHtml(title)}</h2>
                  <p>${escapeHtml(message)}</p>
                  ${
                    jobId
                      ? `<p><a href="https://crewcall-tqin.vercel.app/jobs/${jobId}">View job</a></p>`
                      : ''
                  }
                </div>
              `,
            }),
          })

          if (!response.ok) {
            return false
          }

          emailsSent += 1
          return true
        })
      )

      emailResults.forEach(() => {})
    }

    return NextResponse.json({
      success: true,
      notificationsSent: userIds.length,
      emailsAttempted,
      emailsSent,
      emailEnabled: Boolean(resendApiKey),
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Server error',
      },
      { status: 500 }
    )
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}