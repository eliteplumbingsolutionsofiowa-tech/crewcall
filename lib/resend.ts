import { Resend } from 'resend'

type SendCrewCallEmailInput = {
  to: string
  subject: string
  html: string
  text?: string
}

const resendApiKey = process.env.RESEND_API_KEY
const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

export const resend = resendApiKey ? new Resend(resendApiKey) : null

export async function sendCrewCallEmail({
  to,
  subject,
  html,
  text,
}: SendCrewCallEmailInput) {
  if (!resend) {
    console.warn('RESEND_API_KEY is missing. Email was not sent.')
    return {
      ok: false,
      error: 'RESEND_API_KEY is missing.',
    }
  }

  if (!to) {
    return {
      ok: false,
      error: 'Missing recipient email.',
    }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `CrewCall <${fromEmail}>`,
      to,
      subject,
      html,
      text,
    })

    if (error) {
      console.error('Resend email error:', error)
      return {
        ok: false,
        error: error.message || 'Email failed to send.',
      }
    }

    return {
      ok: true,
      data,
    }
  } catch (error) {
    console.error('Unexpected email error:', error)

    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Email failed to send.',
    }
  }
}

export function crewCallEmailLayout({
  title,
  preview,
  body,
  buttonText,
  buttonUrl,
}: {
  title: string
  preview: string
  body: string
  buttonText?: string
  buttonUrl?: string
}) {
  const safeButton =
    buttonText && buttonUrl
      ? `
        <a href="${buttonUrl}" style="display:inline-block;margin-top:24px;background:#22d3ee;color:#020617;text-decoration:none;font-weight:900;padding:14px 22px;border-radius:14px;">
          ${buttonText}
        </a>
      `
      : ''

  return `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
        <title>${title}</title>
      </head>
      <body style="margin:0;padding:0;background:#020617;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
          ${preview}
        </div>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#0f172a;border:1px solid rgba(255,255,255,0.12);border-radius:28px;overflow:hidden;">
                <tr>
                  <td style="padding:28px;background:linear-gradient(135deg,rgba(34,211,238,0.18),rgba(249,115,22,0.16));">
                    <div style="font-size:13px;font-weight:900;letter-spacing:0.22em;text-transform:uppercase;color:#67e8f9;">
                      CrewCall
                    </div>
                    <h1 style="margin:14px 0 0;font-size:32px;line-height:1.1;color:#ffffff;">
                      ${title}
                    </h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding:28px;">
                    <div style="font-size:16px;line-height:1.7;color:#cbd5e1;">
                      ${body}
                    </div>

                    ${safeButton}
                  </td>
                </tr>

                <tr>
                  <td style="padding:22px 28px;border-top:1px solid rgba(255,255,255,0.1);font-size:12px;line-height:1.6;color:#64748b;">
                    You are receiving this email because you have a CrewCall account.
                    <br />
                    CrewCall — Find help. Find work. Fast.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}