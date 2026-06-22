import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MessageEmail } from '@/emails/MessageEmail'
import { sendCrewCallEmail } from '@/lib/resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://crewcall-tqin.vercel.app'

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
  email: string | null
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

export async function POST(req: Request) {
  try {
    const {
      conversationId,
      senderId,
      recipientId,
      body,
      fileUrl,
      fileName,
      fileType,
    } = (await req.json()) as SendMessageRequest

    if (!conversationId || !senderId || !recipientId) {
      return NextResponse.json(
        { error: 'Missing conversationId, senderId, or recipientId.' },
        { status: 400 }
      )
    }

    const safeBody =
      body?.trim() || fileName || fileType || 'Attachment'

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        recipient_id: recipientId,
        body: safeBody,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_type: fileType || null,
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

    const { data: conversation } = await supabase
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

    const normalizedJob = Array.isArray(conversation?.job)
      ? conversation?.job[0] || null
      : conversation?.job || null

    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('id, email, full_name, company_name')
      .eq('id', senderId)
      .maybeSingle<ProfileRow>()

    const { data: recipientProfile } = await supabase
      .from('profiles')
      .select('id, email, full_name, company_name')
      .eq('id', recipientId)
      .maybeSingle<ProfileRow>()

    await supabase.from('notifications').insert({
      user_id: recipientId,
      type: 'message',
      title: 'New Message',
      body: `${senderProfile?.company_name || senderProfile?.full_name || 'Someone'} sent you a message.`,
      message: `${senderProfile?.company_name || senderProfile?.full_name || 'Someone'} sent you a message.`,
      link_url: `/messages/${conversationId}`,
      conversation_id: conversationId,
      job_id: conversation?.job_id || null,
      read: false,
      is_read: false,
      created_at: new Date().toISOString(),
    })

    if (recipientProfile?.email) {
      await sendCrewCallEmail({
        to: recipientProfile.email,
        subject: `New message from ${
          senderProfile?.company_name ||
          senderProfile?.full_name ||
          'CrewCall'
        }`,
        html: MessageEmail({
          recipientName:
            recipientProfile.full_name || recipientProfile.company_name,
          senderName:
            senderProfile?.company_name ||
            senderProfile?.full_name ||
            'Someone',
          jobTitle: normalizedJob?.title,
          messagePreview: safeBody,
          actionUrl: `${appUrl}/messages/${conversationId}`,
        }),
        text: `${
          senderProfile?.company_name ||
          senderProfile?.full_name ||
          'Someone'
        } sent you a new CrewCall message.`,
      })
    }

    return NextResponse.json({
      success: true,
      message,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Server error',
      },
      { status: 500 }
    )
  }
}