import { crewCallEmailLayout } from '@/lib/resend'

type PaymentEmailInput = {
  workerName?: string | null
  companyName?: string | null
  jobTitle?: string | null
  amount?: string | null
  actionUrl?: string
}

export function PaymentEmail({
  workerName,
  companyName,
  jobTitle,
  amount,
  actionUrl,
}: PaymentEmailInput) {
  return crewCallEmailLayout({
    title: '💰 Payment Sent',
    preview: `${companyName || 'A company'} has sent your payment.`,
    buttonText: 'View Payment',
    buttonUrl: actionUrl,
    body: `
      <p>Hi ${workerName || 'there'},</p>

      <p>
        Great news! Your payment has been sent through CrewCall.
      </p>

      <div style="background:#0f172a;border:1px solid #334155;border-radius:16px;padding:18px;margin:20px 0;">
        <p style="margin:0 0 8px;"><strong>Company:</strong> ${companyName || 'Company'}</p>
        <p style="margin:0 0 8px;"><strong>Job:</strong> ${jobTitle || 'Job'}</p>
        <p style="margin:0;"><strong>Amount:</strong> ${amount || 'See CrewCall'}</p>
      </div>

      <p>
        Your payout will be processed according to your connected Stripe account.
      </p>

      <p>
        Thank you for using CrewCall.
      </p>
    `,
  })
}