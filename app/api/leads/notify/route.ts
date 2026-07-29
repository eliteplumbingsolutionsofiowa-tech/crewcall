import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const resend = new Resend(
      process.env.RESEND_API_KEY,
    )

    const body = await req.json()

    const {
      name,
      email,
      lead_type,
      trade,
      location,
      company_name,
    } = body

    await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL ||
        'CrewCall <notifications@crewcall.com>',
      to:
        process.env.ADMIN_EMAIL ||
        'jaygohn@gmail.com',
      subject:
        `New CrewCall ${lead_type || 'Lead'} Signup`,
      html: `
        <h2>New CrewCall Lead</h2>

        <p><strong>Name:</strong> ${name || '-'}</p>
        <p><strong>Email:</strong> ${email || '-'}</p>
        <p><strong>Type:</strong> ${lead_type || '-'}</p>
        <p><strong>Trade:</strong> ${trade || '-'}</p>
        <p><strong>Location:</strong> ${location || '-'}</p>
        <p><strong>Company:</strong> ${company_name || '-'}</p>
      `,
    })

    return NextResponse.json({
      success: true,
    })

  } catch (error) {
    console.error(
      'Lead notification error:',
      error,
    )

    return NextResponse.json(
      {
        error: 'Notification failed',
      },
      {
        status: 500,
      },
    )
  }
}
