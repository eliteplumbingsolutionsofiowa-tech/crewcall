import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { resolveCompanyContext } from '@/lib/company-context'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getEnv(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Missing ${name}`)
  }

  return value
}

const stripeSecretKey = getEnv('STRIPE_SECRET_KEY')
const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseAnonKey = getEnv(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
)
const supabaseServiceRoleKey = getEnv(
  'SUPABASE_SERVICE_ROLE_KEY'
)

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://usecrewcall.com'
).replace(/\/$/, '')

const stripe = new Stripe(stripeSecretKey)

const authClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

const adminClient = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

type CheckoutRequest = {
  jobId?: string
}

type JobRow = {
  id: string
  title: string | null
  pay_rate: string | null
  payment_status: string | null
  company_id: string | null
  assigned_worker_id: string | null
  status: string | null
  stripe_checkout_session_id: string | null
}

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get('authorization')

  if (
    !authorization ||
    !authorization.startsWith('Bearer ')
  ) {
    return null
  }

  const token = authorization
    .slice('Bearer '.length)
    .trim()

  return token || null
}

function normalizeString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed || null
}

function parseDollarAmount(value: unknown) {
  if (value === null || value === undefined) {
    return 0
  }

  const raw = String(value).trim()

  if (!raw) {
    return 0
  }

  // Reject obvious letter/number mistakes like 100o or 1OOO
  if (/[a-zA-Z]/.test(raw.replace(/\b(day|hr|hour|total|per)\b/gi, ''))) {
    return 0
  }

  const cleaned = raw.replace(/[$,\s]/g, '')

  const amount = Number(cleaned)

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return 0
  }

  return amount
}

export async function POST(req: Request) {
  try {
    const accessToken = getBearerToken(req)

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authorization token required.' },
        { status: 401 }
      )
    }

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            userError?.message ||
            'Unable to verify the authenticated user.',
        },
        { status: 401 }
      )
    }

    const body =
      (await req.json().catch(() => null)) as
        | CheckoutRequest
        | null

    const jobId = normalizeString(body?.jobId)

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing job ID.' },
        { status: 400 }
      )
    }

    const { data: job, error: jobError } =
      await adminClient
        .from('jobs')
        .select(
          `
          id,
          title,
          pay_rate,
          payment_status,
          company_id,
          assigned_worker_id,
          status,
          stripe_checkout_session_id
        `
        )
        .eq('id', jobId)
        .maybeSingle<JobRow>()

    if (jobError) {
      return NextResponse.json(
        { error: jobError.message },
        { status: 400 }
      )
    }

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found.' },
        { status: 404 }
      )
    }

    const companyContext =
      await resolveCompanyContext(
        adminClient,
        user.id
      )

    const canManagePayments =
      companyContext.isPlatformAdmin ||
      companyContext.isCompanyOwner ||
      (
        companyContext.isTeamMember &&
        companyContext.companyId === job.company_id &&
        companyContext.teamRole === 'admin'
      )

    if (
      !canManagePayments ||
      (
        !companyContext.isPlatformAdmin &&
        companyContext.companyId !== job.company_id
      )
    ) {
      return NextResponse.json(
        {
          error:
            'You do not have permission to pay for this job.',
        },
        { status: 403 }
      )
    }

    if (!job.assigned_worker_id) {
      return NextResponse.json(
        {
          error:
            'A worker must be assigned before payment.',
        },
        { status: 409 }
      )
    }

    if (
      job.status !== 'assigned' &&
      job.status !== 'in_progress' &&
      job.status !== 'completed'
    ) {
      return NextResponse.json(
        {
          error:
            'This job is not ready for payment.',
        },
        { status: 409 }
      )
    }

    if (job.payment_status === 'paid') {
      return NextResponse.json(
        {
          error:
            'This job has already been paid.',
          alreadyPaid: true,
        },
        { status: 409 }
      )
    }

    if (
      job.payment_status === 'pending' &&
      job.stripe_checkout_session_id
    ) {
      try {
        const existingSession =
          await stripe.checkout.sessions.retrieve(
            job.stripe_checkout_session_id
          )

        if (
          existingSession.status === 'open' &&
          existingSession.url
        ) {
          return NextResponse.json({
            url: existingSession.url,
            reused: true,
          })
        }

        if (
          existingSession.payment_status ===
          'paid'
        ) {
          const paymentIntentId =
            typeof existingSession.payment_intent ===
            'string'
              ? existingSession.payment_intent
              : existingSession.payment_intent?.id ||
                null

          const { error: reconcileError } =
            await adminClient
              .from('jobs')
              .update({
                payment_status: 'paid',
                paid: true,
                paid_at: new Date().toISOString(),
                stripe_payment_intent_id:
                  paymentIntentId,
                stripe_checkout_session_id:
                  existingSession.id,
              })
              .eq('id', job.id)
              .neq('payment_status', 'paid')

          if (reconcileError) {
            console.error(
              'Stripe payment reconciliation failed:',
              {
                jobId: job.id,
                sessionId: existingSession.id,
                error: reconcileError,
              }
            )

            return NextResponse.json(
              {
                error:
                  'Stripe confirms payment, but CrewCall could not update the job.',
              },
              { status: 500 }
            )
          }

          console.log(
            'CrewCall reconciled paid Stripe session:',
            {
              jobId: job.id,
              sessionId: existingSession.id,
              paymentIntentId,
            }
          )

          return NextResponse.json({
            success: true,
            alreadyPaid: true,
            reconciled: true,
            paymentStatus: 'paid',
          })
        }
      } catch (sessionError) {
        console.error(
          'Unable to reuse existing Stripe checkout session:',
          sessionError
        )
      }
    }

    const grossAmount = parseDollarAmount(
      job.pay_rate
    )

    if (grossAmount <= 0) {
      return NextResponse.json(
        {
          error:
            'This job does not have a valid pay amount.',
        },
        { status: 400 }
      )
    }

    const amountInCents = Math.round(
      grossAmount * 100
    )

    if (amountInCents < 50) {
      return NextResponse.json(
        {
          error:
            'The payment amount is below Stripe’s minimum.',
        },
        { status: 400 }
      )
    }

    const session =
      await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          payment_method_types: ['card'],
          client_reference_id: job.id,
          customer_email: user.email || undefined,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: 'usd',
                unit_amount: amountInCents,
                product_data: {
                  name:
                    job.title ||
                    'CrewCall Job Payment',
                  description: `Payment for CrewCall job ${job.id}`,
                },
              },
            },
          ],
          metadata: {
            jobId: job.id,
            companyId: job.company_id || user.id,
            actorUserId: user.id,
            workerId:
              job.assigned_worker_id,
            amountCents: String(
              amountInCents
            ),
          },
          payment_intent_data: {
            metadata: {
              jobId: job.id,
              companyId: job.company_id || user.id,
              actorUserId: user.id,
              workerId:
                job.assigned_worker_id,
              amountCents: String(
                amountInCents
              ),
            },
          },
          success_url: `${siteUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/jobs/${job.id}/pay`,
        },
        {
          idempotencyKey:
            `crewcall-job-checkout-${job.id}-${amountInCents}`,
        }
      )

    const { error: updateError } =
      await adminClient
        .from('jobs')
        .update({
          payment_status: 'pending',
          stripe_checkout_session_id:
            session.id,
        })
        .eq('id', job.id)
        .eq('company_id', job.company_id)
        .neq('payment_status', 'paid')

    if (updateError) {
      console.error(
        'Stripe checkout created but job update failed:',
        {
          jobId: job.id,
          sessionId: session.id,
          error: updateError,
        }
      )

      return NextResponse.json(
        {
          error:
            'Checkout was created, but CrewCall could not save it. Contact support before retrying.',
          sessionId: session.id,
        },
        { status: 500 }
      )
    }

    if (!session.url) {
      return NextResponse.json(
        {
          error:
            'Stripe did not return a checkout URL.',
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    })
  } catch (error) {
    console.error(
      'Stripe checkout route failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create Stripe checkout session.',
      },
      { status: 500 }
    )
  }
}