import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MessageEmail } from '@/emails/MessageEmail'
import { sendCrewCallEmail } from '@/lib/resend'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
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

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://crewcall-tqin.vercel.app'

const MAX_MESSAGE_LENGTH = 5_000

type SendMessageRequest = {
  conversationId?: string
  senderId?: string
  recipientId?: string
  body?: string
  fileUrl?: string | null
  fileName?: string | null
  fileType?: string | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  company_name: string | null
}

type ConversationRow = {
  id: string
  job_id: string | null
  company_id: string | null
  worker_id: string | null
  job:
    | {
        id: string
        title: string | null
      }
    | {
        id: string
        title: string | null
      }[]
    | null
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
    .trim()
}

function normalizeOptionalString(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed || null
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
      (await req.json()) as SendMessageRequest

    const conversationId =
      normalizeOptionalString(
        payload.conversationId
      )

    const requestedSenderId =
      normalizeOptionalString(payload.senderId)

    let recipientId =
      normalizeOptionalString(
        payload.recipientId
      )

    const body =
      normalizeOptionalString(payload.body)

    const fileUrl =
      normalizeOptionalString(payload.fileUrl)

    const fileName =
      normalizeOptionalString(payload.fileName)

    const fileType =
      normalizeOptionalString(payload.fileType)

    if (!conversationId) {
      return NextResponse.json(
        {
          error: 'Missing conversationId.',
        },
        { status: 400 }
      )
    }

    if (
      requestedSenderId &&
      requestedSenderId !== user.id
    ) {
      return NextResponse.json(
        {
          error:
            'You cannot send a message as another user.',
        },
        { status: 403 }
      )
    }

    if (!body && !fileUrl) {
      return NextResponse.json(
        {
          error:
            'A message body or attachment is required.',
        },
        { status: 400 }
      )
    }

    if (
      body &&
      body.length > MAX_MESSAGE_LENGTH
    ) {
      return NextResponse.json(
        {
          error: `Messages cannot exceed ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`,
        },
        { status: 400 }
      )
    }

    const {
      data: conversation,
      error: conversationError,
    } = await adminClient
      .from('conversations')
      .select(
        `
        id,
        job_id,
        company_id,
        worker_id,
        job:jobs (
          id,
          title
        )
      `
      )
      .eq('id', conversationId)
      .maybeSingle<ConversationRow>()

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

    const participants = [
      conversation.company_id,
      conversation.worker_id,
    ].filter(
      (participantId): participantId is string =>
        Boolean(participantId)
    )

    if (!participants.includes(user.id)) {
      return NextResponse.json(
        {
          error:
            'You are not authorized to access this conversation.',
        },
        { status: 403 }
      )
    }

    const automaticRecipientId =
      conversation.company_id === user.id
        ? conversation.worker_id
        : conversation.company_id

    recipientId =
      recipientId || automaticRecipientId

    if (
      !recipientId ||
      recipientId === user.id ||
      !participants.includes(recipientId)
    ) {
      return NextResponse.json(
        {
          error:
            'Recipient is not a valid participant in this conversation.',
        },
        { status: 403 }
      )
    }

    const safeBody =
      body ||
      fileName ||
      fileType ||
      'Attachment'

    const {
      data: message,
      error: messageError,
    } = await adminClient
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        recipient_id: recipientId,
        body: safeBody,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        is_read: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (messageError) {
      return NextResponse.json(
        { error: messageError.message },
        { status: 400 }
      )
    }

    const normalizedJob = Array.isArray(
      conversation.job
    )
      ? conversation.job[0] || null
      : conversation.job || null

    const [
      senderProfileResult,
      recipientProfileResult,
    ] = await Promise.all([
      adminClient
        .from('profiles')
        .select(
          'id, full_name, company_name'
        )
        .eq('id', user.id)
        .maybeSingle<ProfileRow>(),

      adminClient
        .from('profiles')
        .select(
          'id, full_name, company_name'
        )
        .eq('id', recipientId)
        .maybeSingle<ProfileRow>(),
    ])

    const senderProfile =
      senderProfileResult.data

    const recipientProfile =
      recipientProfileResult.data

    const {
      data: recipientAuthData,
      error: recipientAuthError,
    } = await adminClient.auth.admin.getUserById(
      recipientId
    )

    if (recipientAuthError) {
      console.error(
        'Unable to load recipient auth email:',
        recipientAuthError
      )
    }

    const recipientEmail =
      recipientAuthData?.user?.email || null

    const senderName =
      senderProfile?.company_name ||
      senderProfile?.full_name ||
      user.email ||
      'Someone'

    const {
      error: notificationError,
    } = await adminClient
      .from('notifications')
      .insert({
        user_id: recipientId,
        type: 'message',
        title: 'New Message',
        body: `${senderName} sent you a message.`,
        link_url: `/messages/${conversationId}`,
        read: false,
        is_read: false,
        created_at: new Date().toISOString(),
      })

    if (notificationError) {
      console.error(
        'Unable to create message notification:',
        notificationError
      )
    }

    if (recipientEmail) {
      try {
        await sendCrewCallEmail({
          to: recipientEmail,
          subject: `New message from ${senderName}`,
          html: MessageEmail({
            recipientName:
              recipientProfile?.full_name ||
              recipientProfile?.company_name ||
              'CrewCall user',
            senderName,
            jobTitle: normalizedJob?.title,
            messagePreview: safeBody,
            actionUrl: `${appUrl}/messages/${conversationId}`,
          }),
          text: `${senderName} sent you a new CrewCall message.`,
        })
      } catch (emailError) {
        console.error(
          'Unable to send message email:',
          emailError
        )
      }
    }

    return NextResponse.json({
      success: true,
      message,
    })
  } catch (error) {
    console.error(
      'Message send route failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Server error',
      },
      { status: 500 }
    )
  }
}