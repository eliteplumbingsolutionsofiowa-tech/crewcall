import { crewCallEmailLayout } from '@/lib/resend'

type ReviewEmailInput = {
  recipientName?: string | null
  reviewerName?: string | null
  rating?: number | null
  jobTitle?: string | null
  reviewText?: string | null
  actionUrl?: string
}

export function ReviewEmail({
  recipientName,
  reviewerName,
  rating,
  jobTitle,
  reviewText,
  actionUrl,
}: ReviewEmailInput) {
  const stars =
    rating && rating > 0
      ? '⭐'.repeat(Math.min(Math.max(Math.round(rating), 1), 5))
      : 'New Review'

  return crewCallEmailLayout({
    title: '⭐ You Received a Review',
    preview: `${reviewerName || 'Someone'} left you a review on CrewCall.`,
    buttonText: 'View Review',
    buttonUrl: actionUrl,
    body: `
      <p>Hi ${recipientName || 'there'},</p>

      <p>
        <strong>${reviewerName || 'Someone'}</strong> left you a review on CrewCall.
      </p>

      <div style="background:#0f172a;border:1px solid #334155;border-radius:16px;padding:18px;margin:20px 0;">
        ${
          jobTitle
            ? `<p style="margin:0 0 10px;"><strong>Job:</strong> ${jobTitle}</p>`
            : ''
        }

        <p style="margin:0 0 10px;">
          <strong>Rating:</strong> ${stars}
          ${rating ? ` (${rating}/5)` : ''}
        </p>

        ${
          reviewText
            ? `<p style="margin:0;"><strong>Review:</strong><br>${reviewText}</p>`
            : ''
        }
      </div>

      <p>
        Thank you for being part of the CrewCall community. Great reviews help
        build your reputation and attract more opportunities.
      </p>
    `,
  })
}