'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
  role: string | null
}

type Job = {
  id: string
  title: string | null
  location: string | null
  trade: string | null
  pay_rate: string | null
}

type Conversation = {
  id: string
  worker_id: string
  company_id: string
  job_id: string | null
  jobs: Job | null
}

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const conversationId = String(params.id || '')

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [deletingThread, setDeletingThread] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [otherUser, setOtherUser] = useState<Profile | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')

  useEffect(() => {
    loadChat()
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as Message

          setMessages((prev) => {
            if (prev.some((msg) => msg.id === incoming.id)) return prev
            return [...prev, incoming]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const deleted = payload.old as Message
          setMessages((prev) => prev.filter((msg) => msg.id !== deleted.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  async function loadChat() {
    setLoading(true)
    setErrorMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setErrorMessage('You must be logged in to view this conversation.')
      setLoading(false)
      return
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profileData) {
      setErrorMessage('Profile not found.')
      setLoading(false)
      return
    }

    setCurrentUser(profileData as Profile)

    const { data: conversationData, error: conversationError } = await supabase
      .from('conversations')
      .select(`
        id,
        worker_id,
        company_id,
        job_id,
        jobs (
          id,
          title,
          location,
          trade,
          pay_rate
        )
      `)
      .eq('id', conversationId)
      .maybeSingle()

    if (conversationError || !conversationData) {
      setErrorMessage(conversationError?.message || 'Conversation not found.')
      setLoading(false)
      return
    }

    const normalizedConversation = {
      ...conversationData,
      jobs: Array.isArray((conversationData as any).jobs)
        ? (conversationData as any).jobs[0]
        : (conversationData as any).jobs,
    } as Conversation

    const allowed =
      normalizedConversation.worker_id === user.id ||
      normalizedConversation.company_id === user.id

    if (!allowed) {
      setErrorMessage('You do not have access to this conversation.')
      setLoading(false)
      return
    }

    setConversation(normalizedConversation)

    const otherUserId =
      normalizedConversation.worker_id === user.id
        ? normalizedConversation.company_id
        : normalizedConversation.worker_id

    const { data: otherProfileData } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, role')
      .eq('id', otherUserId)
      .maybeSingle()

    setOtherUser((otherProfileData as Profile) || null)

    const { data: messageRows, error: messageError } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, body, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (messageError) {
      setErrorMessage(messageError.message)
      setLoading(false)
      return
    }

    setMessages((messageRows || []) as Message[])
    setLoading(false)
  }

  async function sendMessage() {
    const body = newMessage.trim()

    if (!body || !currentUser || !conversation) return

    setSending(true)
    setErrorMessage(null)

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: currentUser.id,
      body,
    })

    if (error) {
      setErrorMessage(error.message)
      setSending(false)
      return
    }

    setNewMessage('')
    setSending(false)
  }

  async function deleteMessage(messageId: string) {
    const { error } = await supabase.from('messages').delete().eq('id', messageId)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setMessages((prev) => prev.filter((message) => message.id !== messageId))
  }

  async function deleteThread() {
    if (!conversation) return

    const confirmDelete = window.confirm(
      'Delete this entire conversation? This will remove all messages in this chat.'
    )

    if (!confirmDelete) return

    setDeletingThread(true)
    setErrorMessage(null)

    const { error: messageDeleteError } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversation.id)

    if (messageDeleteError) {
      setErrorMessage(messageDeleteError.message)
      setDeletingThread(false)
      return
    }

    const { error: conversationDeleteError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversation.id)

    if (conversationDeleteError) {
      setErrorMessage(conversationDeleteError.message)
      setDeletingThread(false)
      return
    }

    router.push('/messages')
  }

  const otherName =
    otherUser?.full_name || otherUser?.company_name || 'Conversation'

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-slate-600">Loading chat...</div>
        </div>
      </main>
    )
  }

  if (errorMessage && !conversation) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <div className="text-red-600">{errorMessage}</div>

          <Link
            href="/messages"
            className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Back to Messages
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-8 py-7 text-white">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <Link
                  href="/messages"
                  className="text-sm font-medium text-blue-100 hover:text-white"
                >
                  ← Back to Messages
                </Link>

                <h1 className="mt-3 text-3xl font-bold tracking-tight">
                  {otherName}
                </h1>

                <p className="mt-2 text-sm text-slate-200">
                  {conversation?.jobs?.title || 'General conversation'}
                  {conversation?.jobs?.location
                    ? ` • ${conversation.jobs.location}`
                    : ''}
                </p>
              </div>

              <button
                onClick={deleteThread}
                disabled={deletingThread}
                className="rounded-xl border border-red-300/40 bg-red-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500/30 disabled:opacity-60"
              >
                {deletingThread ? 'Deleting...' : 'Delete Chat'}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="border-b border-red-200 bg-red-50 px-8 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
            <section className="flex min-h-[620px] flex-col border-r border-slate-200">
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                {messages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                    <h2 className="text-xl font-semibold text-slate-900">
                      No messages yet
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Send the first message to start the conversation.
                    </p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const mine = message.sender_id === currentUser?.id

                    return (
                      <div
                        key={message.id}
                        className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${
                            mine
                              ? 'bg-blue-600 text-white'
                              : 'border border-slate-200 bg-white text-slate-900'
                          }`}
                        >
                          <div
                            className={`mb-1 text-xs font-semibold ${
                              mine ? 'text-blue-100' : 'text-slate-500'
                            }`}
                          >
                            {mine ? 'You' : otherName}
                          </div>

                          <p className="whitespace-pre-wrap text-sm leading-6">
                            {message.body}
                          </p>

                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span
                              className={`text-[11px] ${
                                mine ? 'text-blue-100' : 'text-slate-400'
                              }`}
                            >
                              {formatDateTime(message.created_at)}
                            </span>

                            {mine && (
                              <button
                                onClick={() => deleteMessage(message.id)}
                                className="text-[11px] font-semibold text-blue-100 hover:text-white"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}

                <div ref={bottomRef} />
              </div>

              <div className="border-t border-slate-200 bg-white p-4">
                <div className="flex gap-3">
                  <textarea
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        sendMessage()
                      }
                    }}
                    placeholder="Type your message..."
                    className="min-h-[52px] flex-1 resize-none rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  <button
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </section>

            <aside className="space-y-4 bg-slate-50 p-6">
              <InfoBox label="Chat With" value={otherName} />
              <InfoBox label="Role" value={otherUser?.role || 'Not listed'} />
              <InfoBox
                label="Job"
                value={conversation?.jobs?.title || 'General conversation'}
              />
              <InfoBox
                label="Trade"
                value={conversation?.jobs?.trade || 'Not listed'}
              />
              <InfoBox
                label="Location"
                value={conversation?.jobs?.location || 'Not listed'}
              />
              <InfoBox
                label="Pay"
                value={conversation?.jobs?.pay_rate || 'Not listed'}
              />

              {conversation?.jobs?.id && (
                <Link
                  href={`/jobs/${conversation.jobs.id}`}
                  className="block rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  View Job
                </Link>
              )}
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}