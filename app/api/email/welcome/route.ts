import { NextResponse } from 'next/server'
import { sendCrewCallEmail } from '@/lib/resend'

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://crewcall-tqin.vercel.app'

type WelcomeRequest = {
  email?: string
  fullName?: string
  role?: 'worker' | 'company'
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Welcome email route is live. Use POST to send a test email.',
  })
}

export async function POST(req: Request) {
  try {
    const { email, fullName, role } = (await req.json()) as WelcomeRequest

    console.log('Welcome email request:', {
      email,
      fullName,
      role,
    })

    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    }

    const name = fullName?.trim() || 'there'
    const dashboardUrl = `${appUrl}/dashboard`

    const result = await sendCrewCallEmail({
      to: email,
      subject: 'Welcome to CrewCall',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
          <h2>Welcome to CrewCall, ${escapeHtml(name)}.</h2>
          <p>Your ${
            role === 'company' ? 'company' : 'worker'
          } account has been created.</p>
          <p>CrewCall helps contractors find skilled help fast and helps workers find jobs fast.</p>
          <p>
            <a href="${dashboardUrl}" style="display:inline-block;background:#06b6d4;color:#020617;padding:12px 18px;border-radius:12px;font-weight:bold;text-decoration:none;">
              Open CrewCall
            </a>
          </p>
        </div>
      `,
      text: `Welcome to CrewCall, ${name}. Open your dashboard: ${dashboardUrl}`,
    })

    console.log('Welcome email send result:', result)

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Email failed to send.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      emailSent: true,
      result,
    })
  } catch (error) {
    console.error('Welcome email route failed:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
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