import { crewCallEmailLayout } from '@/lib/resend'

type InviteEmailInput = {
  workerName?: string | null
  companyName?: string | null
  jobTitle?: string | null
  payRate?: string | null
  location?: string | null
  actionUrl?: string
}

export function InviteEmail({
  workerName,
  companyName,
  jobTitle,
  payRate,
  location,
  actionUrl,
}: InviteEmailInput) {
  return crewCallEmailLayout({
    title: 'You Have a Job Invite',
    preview: `${companyName || 'A company'} invited you to ${jobTitle || 'a job'}.`,
    buttonText: 'View Invite',
    buttonUrl: actionUrl,
    body: `
      <p>Hi ${workerName || 'there'},</p>

      <p>
        <strong>${companyName || 'A company'}</strong> invited you to a CrewCall job.
      </p>

      <div style="background:#0f172a;border:1px solid #334155;border-radius:16px;padding:18px;margin:20px 0;">
        <p style="margin:0 0 8px;"><strong>Job:</strong> ${jobTitle || 'Job'}</p>
        <p style="margin:0 0 8px;"><strong>Pay:</strong> ${payRate || 'Not listed'}</p>
        <p style="margin:0;"><strong>Location:</strong> ${location || 'Not specified'}</p>
      </div>

      <p>
        Open CrewCall to accept, decline, or message the company.
      </p>
    `,
  })
}