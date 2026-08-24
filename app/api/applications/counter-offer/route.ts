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
    .trim()
}

type CounterOfferRequest = {
  applicationId?: string
  counterOffer?: string
  message?: string | null
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
        { error: 'Unable to verify user.' },
        { status: 401 }
      )
    }

    const body =
      (await req.json()) as CounterOfferRequest

    const applicationId =
      typeof body.applicationId === 'string'
        ? body.applicationId.trim()
        : ''

    const counterOffer =
      typeof body.counterOffer === 'string'
        ? body.counterOffer.trim()
        : ''

    const negotiationMessage =
      typeof body.message === 'string'
        ? body.message.trim() || null
        : null

    if (!applicationId || !counterOffer) {
      return NextResponse.json(
        {
          error:
            'Missing applicationId or counterOffer.',
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

    const rawJob = application.jobs

    const job = Array.isArray(rawJob)
      ? rawJob[0] || null
      : rawJob || null

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found.' },
        { status: 404 }
      )
    }

    if (job.company_id !== user.id) {
      return NextResponse.json(
        {
          error:
            'You are not authorized to counter this application.',
        },
        { status: 403 }
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

    const { error: updateError } =
      await adminClient
        .from('applications')
        .update({
          company_counter_offer: counterOffer,
          negotiation_message:
            negotiationMessage,
          negotiation_status: 'open',
        })
        .eq('id', applicationId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    const notificationBody =
      `You received a counter offer for ${
        job.title || 'a CrewCall job'
      }.`

    const { error: notificationError } =
      await adminClient
        .from('notifications')
        .insert({
          user_id: application.worker_id,
          type: 'counter_offer',
          title: 'New Counter Offer',
          body: notificationBody,
          link_url:
            `/worker/applications`,
          read: false,
          is_read: false,
          created_at:
            new Date().toISOString(),
        })

    if (notificationError) {
      console.error(
        'Unable to create counter offer notification:',
        notificationError
      )
    }

    const {
      data: devices,
      error: devicesError,
    } = await adminClient
      .from('device_tokens')
      .select('id, token')
      .eq('user_id', application.worker_id)
      .eq('platform', 'ios')

    if (devicesError) {
      console.error(
        'Unable to load counter offer push devices:',
        devicesError
      )
    }

    for (const device of devices || []) {
      try {
        const result = await sendApnsPush({
          deviceToken: device.token,
          title: 'New Counter Offer',
          body: notificationBody,
          url: '/worker/applications',
          badge: 1,
        })

        if (result.status !== 200) {
          console.error(
            'APNs counter offer push failed:',
            {
              deviceId: device.id,
              status: result.status,
              response: result.body,
            }
          )
        }
      } catch (pushError) {
        console.error(
          'Unable to send counter offer push:',
          pushError
        )
      }
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error(
      'Counter offer route failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to send counter offer.',
      },
      { status: 500 }
    )
  }
}
