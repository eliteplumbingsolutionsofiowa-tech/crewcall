import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type NotificationRequest = {
  title?: unknown
  message?: unknown
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
    }
  )
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
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
      return jsonError(
        'The server is missing required Supabase environment variables.',
        500
      )
    }

    const authorization =
      request.headers.get('authorization')

    if (
      !authorization ||
      !authorization.startsWith('Bearer ')
    ) {
      return jsonError('Missing authorization token.', 401)
    }

    const accessToken = authorization.slice(7).trim()

    if (!accessToken) {
      return jsonError('Missing authorization token.', 401)
    }

    const authClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(accessToken)

    if (userError || !user) {
      return jsonError(
        userError?.message ||
          'Your login session could not be verified.',
        401
      )
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    const { data: adminProfile, error: adminError } =
      await adminClient
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .maybeSingle()

    if (adminError) {
      return jsonError(adminError.message, 500)
    }

    if (adminProfile?.role !== 'admin') {
      return jsonError('Admin access only.', 403)
    }

    const { id: recipientId } = await context.params

    if (!recipientId) {
      return jsonError('Missing recipient ID.', 400)
    }

    const body =
      (await request.json()) as NotificationRequest

    const title =
      typeof body.title === 'string'
        ? body.title.trim()
        : ''

    const message =
      typeof body.message === 'string'
        ? body.message.trim()
        : ''

    if (!title) {
      return jsonError(
        'Notification title is required.',
        400
      )
    }

    if (!message) {
      return jsonError(
        'Notification message is required.',
        400
      )
    }

    if (title.length > 100) {
      return jsonError(
        'Notification title must be 100 characters or fewer.',
        400
      )
    }

    if (message.length > 500) {
      return jsonError(
        'Notification message must be 500 characters or fewer.',
        400
      )
    }

    const { data: recipient, error: recipientError } =
      await adminClient
        .from('profiles')
        .select('id')
        .eq('id', recipientId)
        .maybeSingle()

    if (recipientError) {
      return jsonError(recipientError.message, 500)
    }

    if (!recipient) {
      return jsonError('Recipient not found.', 404)
    }

    const { data: notification, error: insertError } =
      await adminClient
        .from('notifications')
        .insert({
          user_id: recipientId,
          title,
          message,
          read: false,
        })
        .select('id, user_id, title, message, read')
        .single()

    if (insertError) {
      return jsonError(insertError.message, 500)
    }

    return NextResponse.json({
      success: true,
      notification,
    })
  } catch (error) {
    console.error(
      'Admin notification route error:',
      error
    )

    return jsonError(
      error instanceof Error
        ? error.message
        : 'Unexpected server error.',
      500
    )
  }
}