import { crewCallEmailLayout } from '@/lib/resend'

type ApplicantEmailInput = {
  companyName?: string | null
  workerName?: string | null
  jobTitle?: string | null
  requestedPay?: string | null
  message?: string | null
  actionUrl?: string
}

export function ApplicantEmail({
  companyName,
  workerName,
  jobTitle,
  requestedPay,
  message,
  actionUrl,
}: ApplicantEmailInput) {
  const safeCompanyName = companyName || 'there'
  const safeWorkerName = workerName || 'A worker'
  const safeJobTitle = jobTitle || 'your job'
  const safeRequestedPay = requestedPay || 'Not provided'

  return crewCallEmailLayout({
    title: 'New Applicant',
    preview: `${safeWorkerName} applied to ${safeJobTitle}.`,
    buttonText: 'View Applicant',
    buttonUrl: actionUrl,
    body: `
      <p style="margin:0 0 16px;">Hi ${safeCompanyName},</p>

      <p style="margin:0 0 16px;">
        <strong style="color:#ffffff;">${safeWorkerName}</strong> applied to:
      </p>

      <p style="margin:0 0 16px;font-size:20px;font-weight:900;color:#ffffff;">
        ${safeJobTitle}
      </p>

      <p style="margin:0 0 16px;">
        <strong style="color:#ffffff;">Requested pay:</strong> ${safeRequestedPay}
      </p>

      ${
        message
          ? `<p style="margin:0 0 16px;"><strong style="color:#ffffff;">Message:</strong><br />${message}</p>`
          : ''
      }

      <p style="margin:0;">
        Review the applicant in CrewCall and decide whether to hire, message, or keep reviewing applicants.
      </p>
    `,
  })
}