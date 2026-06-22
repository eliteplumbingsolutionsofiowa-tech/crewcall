import { crewCallEmailLayout } from '@/lib/resend'

type MessageEmailInput = {
  recipientName?: string | null
  senderName?: string | null
  jobTitle?: string | null
  messagePreview?: string | null
  actionUrl?: string
}

export function MessageEmail({
  recipientName,
  senderName,
  jobTitle,
  messagePreview,
  actionUrl,
}: MessageEmailInput) {
  return crewCallEmailLayout({
    title: 'New Message',
    preview: `${senderName || 'Someone'} sent you a message on CrewCall.`,
    buttonText: 'Open Message',
    buttonUrl: actionUrl,
    body: `
      <p>Hi ${recipientName || 'there'},</p>

      <p>
        <strong>${senderName || 'Someone'}</strong> sent you a new CrewCall message.
      </p>

      ${
        jobTitle
          ? `<p><strong>Job:</strong> ${jobTitle}</p>`
          : ''
      }

      ${
        messagePreview
          ? `
            <div style="background:#0f172a;border:1px solid #334155;border-radius:16px;padding:18px;margin:20px 0;">
              ${messagePreview}
            </div>
          `
          : ''
      }

      <p>
        Open CrewCall to reply.
      </p>
    `,
  })
}