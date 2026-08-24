import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendApnsPush } from '@/lib/push/apns'

export const runtime = 'nodejs'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY

if (
  !supabaseUrl ||
  !supabaseAnonKey ||
  !serviceRoleKey
) {
  throw new Error(
    'Missing required Supabase environment variables.'
  )
}

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
  serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

type CounterResponseRequest = {
  applicationId?: string
  action?: 'accept' | 'decline'
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

  return authorization
    .slice('Bearer '.length)
    .trim() || null
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
    } = await authClient.auth.getUser(
      accessToken
    )

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unable to verify user.' },
        { status: 401 }
      )
    }

    const body =
      (await req.json()) as CounterResponseRequest

    const applicationId =
      typeof body.applicationId === 'string'
        ? body.applicationId.trim()
        : ''

    const action = body.action

    if (
      !applicationId ||
      (action !== 'accept' &&
        action !== 'decline')
    ) {
      return NextResponse.json(
        {
          error:
            'Missing applicationId or valid action.',
        },
        { status: 400 }
      )
    }

    const {
      data: application,
      error: applicationError,
    } = await adminClient
      .from('applications')
      .select(
        `
        id,
        job_id,
        worker_id,
        status,
        requested_pay_rate,
        company_counter_offer,
        negotiation_status,
        jobs (
          id,
          title,
          company_id
        )
      `
      )
      .eq('id', applicationId)
      .maybeSingle()

    if (applicationError) {
      return NextResponse.json(
        { error: applicationError.message },
        { status: 400 }
      )
    }

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found.' },
        { status: 404 }
      )
    }

    if (application.worker_id !== user.id) {
      return NextResponse.json(
        {
          error:
            'You are not authorized to respond to this counter offer.',
        },
        { status: 403 }
      )
    }

    const rawJob = application.jobs

    const job = Array.isArray(rawJob)
      ? rawJob[0] || null
      : rawJob || null

    if (!job?.company_id) {
      return NextResponse.json(
        { error: 'Job not found.' },
        { status: 404 }
      )
    }

    if (
      application.status === 'hired' ||
      application.status === 'rejected' ||
      application.status === 'withdrawn' ||
      application.status === 'not_selected'
    ) {
      return NextResponse.json(
        {
          error:
            'This application is no longer open for negotiation.',
        },
        { status: 409 }
      )
    }

    if (!application.company_counter_offer) {
      return NextResponse.json(
        {
          error:
            'There is no company counter offer to respond to.',
        },
        { status: 409 }
      )
    }

    if (
      application.negotiation_status ===
      'accepted'
    ) {
      if (action === 'accept') {
        return NextResponse.json({
          success: true,
          alreadyAccepted: true,
          agreedRate:
            application.requested_pay_rate ||
            application.company_counter_offer,
        })
      }

      return NextResponse.json(
        {
          error:
            'This counter offer has already been accepted.',
        },
        { status: 409 }
      )
    }

    if (
      application.negotiation_status ===
      'declined'
    ) {
      if (action === 'decline') {
        return NextResponse.json({
          success: true,
          alreadyDeclined: true,
        })
      }

      return NextResponse.json(
        {
          error:
            'This counter offer has already been declined.',
        },
        { status: 409 }
      )
    }

    const agreedRate =
      application.company_counter_offer

    const update =
      action === 'accept'
        ? {
            requested_pay_rate: agreedRate,
            negotiation_status: 'accepted',
            negotiation_message:
              'Worker accepted company counter offer.',
          }
        : {
            negotiation_status: 'declined',
            negotiation_message:
              'Worker declined company counter offer.',
          }

    const { error: updateError } =
      await adminClient
        .from('applications')
        .update(update)
        .eq('id', application.id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    const title =
      action === 'accept'
        ? 'Counter Offer Accepted'
        : 'Counter Offer Declined'

    const notificationBody =
      action === 'accept'
        ? `Your counter offer of $${agreedRate} for "${
            job.title || 'your CrewCall job'
          }" was accepted.`
        : `Your counter offer for "${
            job.title || 'your CrewCall job'
          }" was declined.`

    const linkUrl =
      `/my-jobs/${job.id}/applicants`

    const { error: notificationError } =
      await adminClient
        .from('notifications')
        .insert({
          user_id: job.company_id,
          type:
            action === 'accept'
              ? 'counter_offer_accepted'
              : 'counter_offer_declined',
          title,
          body: notificationBody,
          link_url: linkUrl,
          read: false,
          is_read: false,
          created_at:
            new Date().toISOString(),
        })

    if (notificationError) {
      console.error(
        'Unable to create counter response notification:',
        notificationError
      )
    }

    try {
      const {
        data: companyDevices,
        error: companyDevicesError,
      } = await adminClient
        .from('device_tokens')
        .select('id, token')
        .eq('user_id', job.company_id)
        .eq('platform', 'ios')

      if (companyDevicesError) {
        console.error(
          'Unable to load counter response push devices:',
          companyDevicesError
        )
      } else {
        for (
          const device of companyDevices || []
        ) {
          try {
            const result =
              await sendApnsPush({
                deviceToken: device.token,
                title,
                body: notificationBody,
                url: linkUrl,
                badge: 1,
              })

            if (result.status !== 200) {
              console.error(
                'Counter response push failed:',
                {
                  deviceId: device.id,
                  status: result.status,
                  response: result.body,
                }
              )
            }
          } catch (pushError) {
            console.error(
              'Unable to send counter response push:',
              pushError
            )
          }
        }
      }
    } catch (pushError) {
      console.error(
        'Counter response push delivery failed:',
        pushError
      )
    }

    return NextResponse.json({
      success: true,
      action,
      agreedRate:
        action === 'accept'
          ? agreedRate
          : null,
    })
  } catch (error) {
    console.error(
      'Counter response route failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to respond to counter offer.',
      },
      { status: 500 }
    )
  }
}
