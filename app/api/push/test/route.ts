import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendApnsPush } from '@/lib/push/apns'

export const runtime = 'nodejs'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY

if (
  !supabaseUrl ||
  !supabaseAnonKey ||
  !supabaseServiceRoleKey
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
  supabaseServiceRoleKey,
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
        {
          error:
            userError?.message ||
            'Unable to verify user.',
        },
        { status: 401 }
      )
    }

    const {
      data: tokens,
      error: tokenError,
    } = await adminClient
      .from('device_tokens')
      .select('id, token, platform')
      .eq('user_id', user.id)
      .eq('platform', 'ios')

    if (tokenError) {
      return NextResponse.json(
        { error: tokenError.message },
        { status: 400 }
      )
    }

    if (!tokens?.length) {
      return NextResponse.json(
        {
          error:
            'No registered iOS device token found.',
        },
        { status: 404 }
      )
    }

    const results = []

    for (const device of tokens) {
      const result = await sendApnsPush({
        deviceToken: device.token,
        title: 'CrewCall Test',
        body:
          'Push notifications are working on your iPhone.',
        url: '/notifications',
        badge: 1,
      })

      results.push({
        deviceId: device.id,
        status: result.status,
        response: result.body,
      })
    }

    return NextResponse.json({
      success: results.every(
        (result) => result.status === 200
      ),
      results,
    })
  } catch (error) {
    console.error(
      'CrewCall APNs test failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to send test push.',
      },
      { status: 500 }
    )
  }
}
