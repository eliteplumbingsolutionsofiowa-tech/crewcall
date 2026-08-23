import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

type ReadRequest = {
  notificationId?: string
  notificationIds?: string[]
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
            'Unable to verify user.',
        },
        { status: 401 }
      )
    }

    const payload =
      (await req.json()) as ReadRequest

    const ids = [
      ...(payload.notificationId
        ? [payload.notificationId]
        : []),
      ...(Array.isArray(payload.notificationIds)
        ? payload.notificationIds
        : []),
    ].filter(Boolean)

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'No notification IDs provided.' },
        { status: 400 }
      )
    }

    const { error } = await adminClient
      .from('notifications')
      .update({
        is_read: true,
        read: true,
      })
      .eq('user_id', user.id)
      .in('id', ids)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      updatedIds: ids,
    })
  } catch (error) {
    console.error(
      'Notification read route failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to mark notification read.',
      },
      { status: 500 }
    )
  }
}
