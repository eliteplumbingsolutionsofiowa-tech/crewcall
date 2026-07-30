from pathlib import Path

path = Path("app/stripe/success/page.tsx")

text = path.read_text()

text = text.replace(
"""    const { data, error } = await jobsSelectTable()
      .select(
        `
        id,
        title,
        payment_status,
        payout_status,
        status,
        company_id,
        assigned_worker_id
      `
      )
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle()
""",
"""    const { data, error } = await jobsSelectTable()
      .select(
        `
        id,
        title,
        payment_status,
        payout_status,
        status,
        company_id,
        assigned_worker_id
      `
      )
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle()
"""
)

text = text.replace(
"""    setJob({
      ...foundJob,
      payment_status: 'paid',
      payout_status: 'released',
      status: 'completed',
    })
""",
"""    setJob({
      ...foundJob,
      payment_status: 'paid',
      payout_status: 'not_released',
      status: 'completed',
    })
"""
)

text = text.replace(
"""                    ✓ Payout Released
""",
"""                    ✓ Payment Secured
"""
)

text = text.replace(
"""                  Payment secured. Complete the job to release worker payout.
""",
"""                  Payment secured. Complete the job to release worker payout.
"""
)

path.write_text(text)

print("Fixed Stripe success payout status")
