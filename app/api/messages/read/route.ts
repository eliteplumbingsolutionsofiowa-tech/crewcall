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
  conversationId?: string
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

    const conversationId =
      typeof payload.conversationId === 'string'
        ? payload.conversationId.trim()
        : ''

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing conversationId.' },
        { status: 400 }
      )
    }

    const {
      data: conversation,
      error: conversationError,
    } = await adminClient
      .from('conversations')
      .select('id, company_id, worker_id')
      .eq('id', conversationId)
      .maybeSingle()

    if (conversationError) {
      return NextResponse.json(
        { error: conversationError.message },
        { status: 400 }
      )
    }

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found.' },
        { status: 404 }
      )
    }

    if (
      conversation.company_id !== user.id &&
      conversation.worker_id !== user.id
    ) {
      return NextResponse.json(
        {
          error:
            'You are not authorized to access this conversation.',
        },
        { status: 403 }
      )
    }

    const { error: updateError } =
      await adminClient
        .from('messages')
        .update({
          is_read: true,
        })
        .eq('conversation_id', conversationId)
        .eq('recipient_id', user.id)
        .eq('is_read', false)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error(
      'Message read route failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to mark messages read.',
      },
      { status: 500 }
    )
  }
}
