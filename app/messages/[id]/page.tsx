'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
  role: 'company' | 'worker' | null
  is_online: boolean | null
  last_seen: string | null
}

type Conversation = {
  id: string
  company_id: string | null
  worker_id: string | null
  job_id: string | null
  created_at: string
  job: {
    id: string
    title: string | null
  } | null
}

type ConversationRow = {
  id: string
  company_id: string | null
  worker_id: string | null
  job_id: string | null
  created_at: string
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

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  recipient_id: string | null
  body: string | null
  file_url: string | null
  file_name: string | null
  file_type: string | null
  is_read: boolean | null
  created_at: string
}

export default function MessageThreadPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = String(params?.id || '')

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [otherTyping, setOtherTyping] = useState(false)

  useEffect(() => {
    loadThread()

    const messageChannel = supabase
      .channel(`messages-thread-polished-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async () => {
          await loadMessagesOnly()
          window.dispatchEvent(new Event('crewcall-refresh-nav'))
        }
      )
      .subscribe()

    const typingChannel = supabase.channel(`typing-polished-${conversationId}`)

    typingChannel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== currentUserId) {
          setOtherTyping(true)

          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
          }

          typingTimeoutRef.current = setTimeout(() => {
            setOtherTyping(false)
          }, 1800)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(messageChannel)
      supabase.removeChannel(typingChannel)

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, currentUserId])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, otherTyping])

  async function loadThread() {
    setLoading(true)
    setErrorMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.replace('/login')
      return
    }

    setCurrentUserId(user.id)

    const { data: convo, error: convoError } = await supabase
      .from('conversations')
      .select(
        `
        id,
        company_id,
        worker_id,
        job_id,
        created_at,
        job:jobs (
          id,
          title
        )
      `
      )
      .eq('id', conversationId)
      .returns<ConversationRow[]>()
      .maybeSingle()

    if (convoError || !convo) {
      setErrorMessage(convoError?.message || 'Conversation not found.')
      setLoading(false)
      return
    }

    const normalizedConvo: Conversation = {
      id: convo.id,
      company_id: convo.company_id,
      worker_id: convo.worker_id,
      job_id: convo.job_id,
      created_at: convo.created_at,
      job: Array.isArray(convo.job) ? convo.job[0] ?? null : convo.job,
    }

    setConversation(normalizedConvo)

    const otherUserId =
      normalizedConvo.company_id === user.id
        ? normalizedConvo.worker_id
        : normalizedConvo.company_id

    if (otherUserId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, role, is_online, last_seen')
        .eq('id', otherUserId)
        .returns<Profile[]>()
        .maybeSingle()

      setOtherProfile(profile ?? null)
    }

    await loadMessagesOnly(user.id)
    setLoading(false)
  }

  async function loadMessagesOnly(userIdOverride?: string) {
    const userId = userIdOverride ?? currentUserId

    const { data, error } = await supabase
      .from('messages')
      .select(
        'id, conversation_id, sender_id, recipient_id, body, file_url, file_name, file_type, is_read, created_at'
      )
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      setErrorMessage(error.message)
      return
    }

    const loadedMessages = (data as Message[]) || []
    setMessages(loadedMessages)

    if (!userId) return

    const unreadIncomingIds = loadedMessages
      .filter(
        (message) =>
          message.recipient_id === userId && message.is_read === false
      )
      .map((message) => message.id)

    if (unreadIncomingIds.length > 0) {
      const { error: readError } = await supabase
        .from('messages')
        .update({ is_read: true } as never)
        .in('id', unreadIncomingIds)

      if (!readError) {
        setMessages((prev) =>
          prev.map((message) =>
            unreadIncomingIds.includes(message.id)
              ? { ...message, is_read: true }
              : message
          )
        )
      }
    }

    window.dispatchEvent(new Event('crewcall-refresh-nav'))
  }

  async function sendTypingSignal() {
    if (!currentUserId) return

    await supabase.channel(`typing-polished-${conversationId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: currentUserId,
      },
    })
  }

  async function uploadSelectedFile() {
    if (!selectedFile || !currentUserId) {
      return {
        fileUrl: null,
        fileName: null,
        fileType: null,
      }
    }

    setUploading(true)

    const fileExt = selectedFile.name.split('.').pop()
    const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '-')
    const filePath = `${conversationId}/${currentUserId}/${Date.now()}-${cleanName}`

    const { error: uploadError } = await supabase.storage
      .from('message-files')
      .upload(filePath, selectedFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: selectedFile.type || undefined,
      })

    if (uploadError) {
      setUploading(false)
      throw new Error(uploadError.message)
    }

    const { data } = supabase.storage
      .from('message-files')
      .getPublicUrl(filePath)

    setUploading(false)

    return {
      fileUrl: data.publicUrl,
      fileName: selectedFile.name,
      fileType: selectedFile.type || fileExt || 'file',
    }
  }

  async function sendMessage() {
    if ((!body.trim() && !selectedFile) || !currentUserId || !conversation) {
      return
    }

    const recipientId =
      conversation.company_id === currentUserId
        ? conversation.worker_id
        : conversation.company_id

    if (!recipientId) {
      setErrorMessage('Could not find the other user for this conversation.')
      return
    }

    setSending(true)
    setErrorMessage(null)

    try {
      const uploaded = await uploadSelectedFile()

      const { error } = await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: currentUserId,
        recipient_id: recipientId,
        body: body.trim() || null,
        file_url: uploaded.fileUrl,
        file_name: uploaded.fileName,
        file_type: uploaded.fileType,
        is_read: false,
      } as never)

      if (error) {
        setErrorMessage(error.message)
        setSending(false)
        setUploading(false)
        return
      }

      setBody('')
      setSelectedFile(null)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      await loadMessagesOnly()
      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    } catch (error: any) {
      setErrorMessage(error?.message || 'File upload failed.')
    }

    setSending(false)
    setUploading(false)
  }

  function scrollToBottom() {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      })
    }, 50)
  }

  function isImageMessage(message: Message) {
    return Boolean(message.file_type?.startsWith('image/'))
  }

  const otherName =
    otherProfile?.company_name || otherProfile?.full_name || 'Conversation'

  const online = isActuallyOnline(otherProfile)

  const groupedMessages = useMemo(() => {
    return messages.map((message, index) => {
      const previous = messages[index - 1]
      const currentDate = dateLabel(message.created_at)
      const previousDate = previous ? dateLabel(previous.created_at) : null
      const showDate = currentDate !== previousDate

      const sameSenderAsPrevious =
        previous &&
        previous.sender_id === message.sender_id &&
        minutesBetween(previous.created_at, message.created_at) < 5

      return {
        message,
        showDate,
        compact: Boolean(sameSenderAsPrevious && !showDate),
      }
    })
  }, [messages])

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-lg font-black text-white">
            Loading conversation...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-3 py-4 pb-36 text-white sm:px-4 sm:py-8 md:pb-10">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="sticky top-[88px] z-30 rounded-[2rem] border border-white/10 bg-slate-950/90 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Link
                href="/messages"
                className="text-xs font-black uppercase tracking-wide !text-cyan-300 no-underline hover:!text-cyan-200"
              >
                ← Back to messages
              </Link>

              <div className="mt-3 flex items-center gap-3">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-xl font-black text-white shadow-lg">
                  {otherName.charAt(0)}
                  <span
                    className={`absolute -right-1 -top-1 h-4 w-4 rounded-full border-4 border-slate-950 ${
                      online ? 'bg-lime-400' : 'bg-slate-500'
                    }`}
                  />
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-black tracking-tight text-white">
                    {otherName}
                  </h1>

                  <p className="truncate text-xs font-bold text-slate-400">
                    {online
                      ? 'Online now'
                      : otherProfile?.last_seen
                        ? `Last seen ${formatRelativeTime(
                            otherProfile.last_seen
                          )}`
                        : 'Offline'}
                    {conversation?.job?.title
                      ? ` • Job: ${conversation.job.title}`
                      : ''}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={scrollToBottom}
              className="hidden rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15 sm:inline-flex"
            >
              Bottom
            </button>
          </div>
        </section>

        {errorMessage && (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-100">
            {errorMessage}
          </div>
        )}

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur">
          <div className="max-h-[68vh] min-h-[460px] space-y-2 overflow-y-auto bg-slate-950/45 p-4 md:p-5">
            {messages.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-[2rem] border border-dashed border-white/15 bg-slate-950/55 p-8 text-center">
                <div>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400/15 text-3xl">
                    ✉
                  </div>

                  <p className="mt-5 text-2xl font-black text-white">
                    No messages yet.
                  </p>

                  <p className="mt-2 text-sm font-bold text-slate-400">
                    Start the conversation below.
                  </p>
                </div>
              </div>
            ) : (
              groupedMessages.map(({ message, showDate, compact }) => {
                const mine = message.sender_id === currentUserId

                return (
                  <div key={message.id}>
                    {showDate && (
                      <div className="my-5 flex justify-center">
                        <span className="rounded-full border border-white/10 bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-300">
                          {dateLabel(message.created_at)}
                        </span>
                      </div>
                    )}

                    <div
                      className={`flex ${
                        mine ? 'justify-end' : 'justify-start'
                      } ${compact ? 'mt-1' : 'mt-4'}`}
                    >
                      <div
                        className={`max-w-[86%] rounded-3xl px-4 py-3 shadow-lg transition-all md:max-w-[72%] ${
                          mine
                            ? 'bg-cyan-400 text-slate-950 shadow-cyan-500/10'
                            : 'border border-white/10 bg-slate-900 text-white'
                        } ${compact ? 'rounded-t-2xl' : ''}`}
                      >
                        {message.body && (
                          <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed">
                            {message.body}
                          </p>
                        )}

                        {message.file_url && (
                          <div className={message.body ? 'mt-3' : ''}>
                            {isImageMessage(message) ? (
                              <button
                                type="button"
                                onClick={() => setPreviewImage(message.file_url)}
                                className="block overflow-hidden rounded-2xl border border-white/20 bg-white/10"
                              >
                                <img
                                  src={message.file_url}
                                  alt={
                                    message.file_name || 'Message attachment'
                                  }
                                  className="max-h-80 w-full object-cover"
                                />
                              </button>
                            ) : (
                              <a
                                href={message.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-black no-underline transition ${
                                  mine
                                    ? 'border-slate-950/10 bg-slate-950/10 !text-slate-950 hover:bg-slate-950/15'
                                    : 'border-white/10 bg-white/10 !text-white hover:bg-white/15'
                                }`}
                              >
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
                                  📎
                                </span>

                                <span className="min-w-0 truncate">
                                  {message.file_name || 'Open attachment'}
                                </span>
                              </a>
                            )}
                          </div>
                        )}

                        <div
                          className={`mt-2 flex items-center gap-2 text-[11px] font-black ${
                            mine ? 'text-slate-800' : 'text-slate-500'
                          }`}
                        >
                          <span>{formatTime(message.created_at)}</span>

                          {mine && (
                            <span>{message.is_read ? 'Read' : 'Sent'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}

            {otherTyping && (
              <div className="mt-4 flex justify-start">
                <div className="rounded-3xl border border-white/10 bg-slate-900 px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="sticky bottom-0 border-t border-white/10 bg-slate-950/95 p-4 backdrop-blur-xl">
            {selectedFile && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-400/25 bg-orange-400/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wide text-orange-200">
                    Attachment Ready
                  </p>

                  <p className="truncate text-sm font-bold text-white">
                    {selectedFile.name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-white/15"
                >
                  Remove
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <textarea
                value={body}
                onChange={(event) => {
                  setBody(event.target.value)
                  sendTypingSignal()
                }}
                placeholder="Type your message..."
                rows={2}
                className="min-h-20 flex-1 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-400/10"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    sendMessage()
                  }
                }}
              />

              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null
                    setSelectedFile(file)
                  }}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-white/15"
                >
                  Attach
                </button>

                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={
                    sending || uploading || (!body.trim() && !selectedFile)
                  }
                  className="rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending || uploading ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {previewImage && (
        <button
          type="button"
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
        >
          <img
            src={previewImage}
            alt="Message preview"
            className="max-h-[90vh] max-w-full rounded-3xl object-contain shadow-2xl"
          />
        </button>
      )}
    </main>
  )
}

function isActuallyOnline(profile: Profile | null) {
  if (!profile?.is_online || !profile.last_seen) return false
  return Date.now() - new Date(profile.last_seen).getTime() < 90_000
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()

  if (Number.isNaN(date.getTime())) return 'recently'

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`

  return `${days}d ago`
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function dateLabel(value: string) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (sameDay(date, today)) return 'Today'
  if (sameDay(date, yesterday)) return 'Yesterday'

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function minutesBetween(a: string, b: string) {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 60000
}