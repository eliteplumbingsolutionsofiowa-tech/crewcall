import { crewCallEmailLayout } from '@/lib/resend'

type HiredEmailInput = {
  workerName?: string | null
  companyName?: string | null
  jobTitle?: string | null
  payRate?: string | null
  startDate?: string | null
  location?: string | null
  actionUrl?: string
}

export function HiredEmail({
  workerName,
  companyName,
  jobTitle,
  payRate,
  startDate,
  location,
  actionUrl,
}: HiredEmailInput) {
  return crewCallEmailLayout({
    title: '🎉 You Were Hired!',
    preview: `${companyName || 'A company'} hired you for ${jobTitle || 'a job'}.`,
    buttonText: 'View Job',
    buttonUrl: actionUrl,
    body: `
      <p>Hi ${workerName || 'there'},</p>

      <p>
        Congratulations! <strong>${companyName || 'A company'}</strong>
        selected you for the following job:
      </p>

      <div style="background:#0f172a;border:1px solid #334155;border-radius:16px;padding:18px;margin:20px 0;">
        <p style="margin:0 0 8px;"><strong>Job:</strong> ${jobTitle || 'Job'}</p>
        <p style="margin:0 0 8px;"><strong>Pay:</strong> ${payRate || 'Not listed'}</p>
        <p style="margin:0 0 8px;"><strong>Start:</strong> ${startDate || 'TBD'}</p>
        <p style="margin:0;"><strong>Location:</strong> ${location || 'Not specified'}</p>
      </div>

      <p>
        Log in to CrewCall to message the company, review the job details,
        and prepare for your upcoming work.
      </p>
    `,
  })
}