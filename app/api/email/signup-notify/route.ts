import { NextResponse } from 'next/server'

import { sendCrewCallEmail } from '@/lib/resend'

type SignupNotifyRequest = {
  email?: string
  fullName?: string
  phone?: string
  role?: 'worker' | 'company' | 'staffing_agency'
}

export async function POST(req: Request) {
  try {
    const {
      email,
      fullName,
      phone,
      role,
    } = (await req.json()) as SignupNotifyRequest

    if (!email) {
      return NextResponse.json(
        { error: 'Missing signup email' },
        { status: 400 }
      )
    }

    const adminEmail =
      process.env.ADMIN_EMAIL ||
      'jaygohn@gmail.com'

    const roleLabel =
      role === 'company'
        ? 'Company'
        : role === 'staffing_agency'
          ? 'Staffing Agency'
          : 'Worker'

    const name =
      fullName?.trim() || 'Not provided'

    const phoneNumber =
      phone?.trim() || 'Not provided'

    const signedUpAt = new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone: 'America/Chicago',
        dateStyle: 'medium',
        timeStyle: 'short',
      }
    ).format(new Date())

    const result = await sendCrewCallEmail({
      to: adminEmail,
      subject: `New CrewCall ${roleLabel} Signup`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;">
          <h2>🎉 New CrewCall Signup</h2>

          <p>
            A new ${escapeHtml(roleLabel.toLowerCase())}
            account was just created.
          </p>

          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(phoneNumber)}</p>
          <p><strong>Role:</strong> ${escapeHtml(roleLabel)}</p>
          <p><strong>Signed up:</strong> ${escapeHtml(signedUpAt)} CT</p>
        </div>
      `,
      text: [
        'New CrewCall Signup',
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phoneNumber}`,
        `Role: ${roleLabel}`,
        `Signed up: ${signedUpAt} CT`,
      ].join('\n'),
    })

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            result.error ||
            'Signup notification failed.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      emailSent: true,
    })
  } catch (error) {
    console.error(
      'Signup notification route failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Server error',
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
