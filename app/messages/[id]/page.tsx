'use client'

import {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
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
  optimistic?: boolean
  failed?: boolean
}

type MessageInsert = {
  conversation_id: string
  sender_id: string
  recipient_id: string
  body: string
  file_url: string | null
  file_name: string | null
  file_type: string | null
  is_read: boolean
}

type MessageUpdate = {
  is_read: boolean
}

type DraftAttachment = {
  file: File
  previewUrl: string | null
}

type UploadResult = {
  fileUrl: string | null
  fileName: string | null
  fileType: string | null
}

type MessageStatus = 'idle' | 'sending' | 'uploading'

const MAX_FILE_SIZE_MB = 20
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

const MESSAGE_SELECT =
  'id, conversation_id, sender_id, recipient_id, body, file_url, file_name, file_type, is_read, created_at'

export default function MessageThreadPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = String(params?.id || '')

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const localTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [attachment, setAttachment] = useState<DraftAttachment | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<MessageStatus>('idle')
  const [uploadPercent, setUploadPercent] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [otherTyping, setOtherTyping] = useState(false)
  const [draggingOver, setDraggingOver] = useState(false)

  const sending = status === 'sending'
  const uploading = status === 'uploading'

  const otherName =
    otherProfile?.company_name || otherProfile?.full_name || 'Conversation'

  const online = isActuallyOnline(otherProfile)

  const recipientId = useMemo(() => {
    if (!conversation || !currentUserId) return null

    return conversation.company_id === currentUserId
      ? conversation.worker_id
      : conversation.company_id
  }, [conversation, currentUserId])

  const groupedMessages = useMemo(() => {
    return messages.map((message, index) => {
      const previous = messages[index - 1]
      const currentDate = dateLabel(message.created_at)
      const previousDate = previous ? dateLabel(previous.created_at) : null
      const showDate = currentDate !== previousDate

      const compact = Boolean(
        previous &&
          previous.sender_id === message.sender_id &&
          minutesBetween(previous.created_at, message.created_at) < 5 &&
          !showDate
      )

      return {
        message,
        showDate,
        compact,
      }
    })
  }, [messages])

  const loadMessagesOnly = useCallback(
    async (userIdOverride?: string) => {
      const userId = userIdOverride ?? currentUserId

      const { data, error } = await supabase
        .from('messages')
        .select(MESSAGE_SELECT)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .returns<Message[]>()

      if (error) {
        setErrorMessage(error.message)
        return
      }

      const loadedMessages = data || []

      setMessages((previous) => {
        const optimisticMessages = previous.filter(
          (message) => message.optimistic && !message.failed
        )

        return [...loadedMessages, ...optimisticMessages].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      })

      if (!userId) return

      const unreadIncomingIds = loadedMessages
        .filter(
          (message) =>
            message.recipient_id === userId && message.is_read === false
        )
        .map((message) => message.id)

      if (unreadIncomingIds.length > 0) {
        const updateValue: MessageUpdate = {
          is_read: true,
        }

        const { error: readError } = await supabase
          .from('messages')
          .update(updateValue)
          .in('id', unreadIncomingIds)

        if (!readError) {
          setMessages((previous) =>
            previous.map((message) =>
              unreadIncomingIds.includes(message.id)
                ? { ...message, is_read: true }
                : message
            )
          )
        }
      }

      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    },
    [conversationId, currentUserId]
  )

  const loadThread = useCallback(async () => {
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

    const allowed =
      normalizedConvo.company_id === user.id ||
      normalizedConvo.worker_id === user.id

    if (!allowed) {
      setErrorMessage('You do not have permission to view this conversation.')
      setLoading(false)
      return
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
  }, [conversationId, loadMessagesOnly, router])

  useEffect(() => {
    loadThread()
  }, [loadThread])

  useEffect(() => {
    if (!conversationId) return

    const messageChannel = supabase
      .channel(`messages-thread-live-${conversationId}`)
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

    return () => {
      supabase.removeChannel(messageChannel)
    }
  }, [conversationId, loadMessagesOnly])

  useEffect(() => {
    if (!conversationId) return

    const typingChannel = supabase.channel(`typing-live-${conversationId}`)

    typingChannel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId && payload.userId !== currentUserId) {
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
      supabase.removeChannel(typingChannel)

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      if (localTypingTimeoutRef.current) {
        clearTimeout(localTypingTimeoutRef.current)
      }
    }
  }, [conversationId, currentUserId])

  useEffect(() => {
    scrollToBottom('smooth')
  }, [messages.length, otherTyping])

  useEffect(() => {
    autoGrowTextarea()
  }, [body])

  useEffect(() => {
    return () => {
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl)
      }
    }
  }, [attachment?.previewUrl])

  async function sendTypingSignal() {
    if (!currentUserId) return

    if (localTypingTimeoutRef.current) {
      clearTimeout(localTypingTimeoutRef.current)
    }

    localTypingTimeoutRef.current = setTimeout(async () => {
      await supabase.channel(`typing-live-${conversationId}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId: currentUserId,
        },
      })
    }, 150)
  }

  function autoGrowTextarea() {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`
  }

  function scrollToBottom(behavior: ScrollBehavior = 'auto') {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({
        behavior,
        block: 'end',
      })
    }, 40)
  }

  function setDraftAttachment(file: File | null) {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl)
    }

    if (!file) {
      setAttachment(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`Attachment must be under ${MAX_FILE_SIZE_MB}MB.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setAttachment({
      file,
      previewUrl: file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : null,
    })

    setErrorMessage(null)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    setDraftAttachment(file)
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const file = Array.from(event.clipboardData.items)
      .find((item) => item.kind === 'file')
      ?.getAsFile()

    if (file) {
      setDraftAttachment(file)
    }
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setDraggingOver(true)
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setDraggingOver(false)
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setDraggingOver(false)

    const file = event.dataTransfer.files?.[0] || null
    setDraftAttachment(file)
  }

  async function uploadAttachment(
    draftAttachment: DraftAttachment | null
  ): Promise<UploadResult> {
    if (!draftAttachment?.file || !currentUserId) {
      return {
        fileUrl: null,
        fileName: null,
        fileType: null,
      }
    }

    setStatus('uploading')
    setUploadPercent(10)

    const file = draftAttachment.file
    const fileExt = file.name.split('.').pop()
    const cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '-')
    const filePath = `${conversationId}/${currentUserId}/${Date.now()}-${cleanName}`

    setUploadPercent(35)

    const { error: uploadError } = await supabase.storage
      .from('message-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    setUploadPercent(85)

    const { data } = supabase.storage
      .from('message-files')
      .getPublicUrl(filePath)

    setUploadPercent(100)

    return {
      fileUrl: data.publicUrl,
      fileName: file.name,
      fileType: file.type || fileExt || 'file',
    }
  }

  async function sendMessage() {
    if ((!body.trim() && !attachment) || !currentUserId || !conversation) return

    if (!recipientId) {
      setErrorMessage('Could not find the other user for this conversation.')
      return
    }

    const draftBody = body.trim()
    const draftAttachment = attachment
    const optimisticId = `optimistic-${Date.now()}`

    setStatus('sending')
    setErrorMessage(null)
    setUploadPercent(0)

    const optimisticMessage: Message = {
      id: optimisticId,
      conversation_id: conversation.id,
      sender_id: currentUserId,
      recipient_id: recipientId,
      body: draftBody || null,
      file_url: draftAttachment?.previewUrl || null,
      file_name: draftAttachment?.file.name || null,
      file_type: draftAttachment?.file.type || null,
      is_read: false,
      created_at: new Date().toISOString(),
      optimistic: true,
    }

    setMessages((previous) => [...previous, optimisticMessage])
    setBody('')
    setDraftAttachment(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    try {
      const uploaded = await uploadAttachment(draftAttachment)

      const fallbackBody =
        uploaded.fileName || uploaded.fileType || 'Attachment'

      const insertValue: MessageInsert = {
        conversation_id: conversation.id,
        sender_id: currentUserId,
        recipient_id: recipientId,
        body: draftBody || fallbackBody,
        file_url: uploaded.fileUrl,
        file_name: uploaded.fileName,
        file_type: uploaded.fileType,
        is_read: false,
      }

      const { error } = await supabase.from('messages').insert(insertValue)

      if (error) {
        throw new Error(error.message)
      }

      setMessages((previous) =>
        previous.filter((message) => message.id !== optimisticId)
      )

      await loadMessagesOnly()
      window.dispatchEvent(new Event('crewcall-refresh-nav'))
    } catch (error) {
      const safeMessage =
        error instanceof Error ? error.message : 'Message failed to send.'

      setErrorMessage(safeMessage)

      setMessages((previous) =>
        previous.map((message) =>
          message.id === optimisticId
            ? {
                ...message,
                failed: true,
              }
            : message
        )
      )
    }

    setStatus('idle')
    setUploadPercent(0)
  }

  async function copyMessage(message: Message) {
    const text = message.body || message.file_url || ''
    if (!text) return

    await navigator.clipboard.writeText(text)
    setErrorMessage(null)
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  function isImageMessage(message: Message) {
    return Boolean(message.file_type?.startsWith('image/'))
  }

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
    <main
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen px-3 py-4 pb-36 text-white sm:px-4 sm:py-8 md:pb-10"
    >
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
              onClick={() => scrollToBottom('smooth')}
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

        {draggingOver && (
          <div className="rounded-[2rem] border-2 border-dashed border-cyan-300 bg-cyan-400/10 p-8 text-center text-lg font-black text-cyan-100">
            Drop attachment here
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
                            ? message.failed
                              ? 'bg-red-500 text-white shadow-red-500/10'
                              : 'bg-cyan-400 text-slate-950 shadow-cyan-500/10'
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
                                onClick={() =>
                                  setPreviewImage(message.file_url)
                                }
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
                            <span>
                              {message.failed
                                ? 'Failed'
                                : message.optimistic
                                  ? 'Sending'
                                  : message.is_read
                                    ? 'Read'
                                    : 'Sent'}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {(message.body || message.file_url) && (
                            <button
                              type="button"
                              onClick={() => copyMessage(message)}
                              className={`text-[11px] font-black underline-offset-2 hover:underline ${
                                mine ? 'text-slate-800' : 'text-slate-400'
                              }`}
                            >
                              Copy
                            </button>
                          )}

                          {message.file_url && (
                            <a
                              href={message.file_url}
                              download={message.file_name || true}
                              target="_blank"
                              rel="noreferrer"
                              className={`text-[11px] font-black underline-offset-2 hover:underline ${
                                mine ? 'text-slate-800' : 'text-slate-400'
                              }`}
                            >
                              Download
                            </a>
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
            {uploading && (
              <div className="mb-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-cyan-400 transition-all"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
            )}

            {attachment && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-400/25 bg-orange-400/10 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {attachment.previewUrl ? (
                    <img
                      src={attachment.previewUrl}
                      alt={attachment.file.name}
                      className="h-14 w-14 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-xl">
                      📎
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wide text-orange-200">
                      Attachment Ready
                    </p>

                    <p className="truncate text-sm font-bold text-white">
                      {attachment.file.name}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDraftAttachment(null)}
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-white/15"
                >
                  Remove
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(event) => {
                  setBody(event.target.value)
                  sendTypingSignal()
                }}
                onPaste={handlePaste}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Type your message..."
                rows={2}
                className="min-h-20 flex-1 resize-none rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-400/10"
              />

              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
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
                    sending || uploading || (!body.trim() && !attachment)
                  }
                  className="rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending || uploading ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs font-bold text-slate-500">
              Press Enter to send. Shift + Enter makes a new line. You can also
              paste or drag files into this chat.
            </p>
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