'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Message = {
  id: string
  body: string
  sender_id: string
  created_at: string | null
}

type Conversation = {
  id: string
  job_id: string | null
  worker_id: string
  company_id: string
}

export default function MessageConversationPage() {
  const params = useParams()
  const id = String(params.id || '')

  const [conversation, setConversation] =
    useState<Conversation | null>(null)

  const [messages, setMessages] =
    useState<Message[]>([])

  const [text, setText] = useState('')

  const [userId, setUserId] =
    useState<string | null>(null)

  const [error, setError] =
    useState<string | null>(null)

  const [sending, setSending] =
    useState(false)

  const [otherTyping, setOtherTyping] =
    useState(false)

  const typingTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)

  const typingChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null)

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Please log in.')
      return
    }

    setUserId(user.id)

    const {
      data: convo,
      error: convoError,
    } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single()

    if (convoError || !convo) {
      setError('Conversation not found.')
      return
    }

    if (
      convo.worker_id !== user.id &&
      convo.company_id !== user.id
    ) {
      setError(
        'You do not have access to this conversation.'
      )
      return
    }

    setConversation(convo as Conversation)

    const {
      data: messageData,
      error: messageError,
    } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', {
        ascending: true,
      })

    if (messageError) {
      setError(messageError.message)
      return
    }

    setMessages((messageData as Message[]) || [])
  }

  async function sendTypingState(
    typing: boolean
  ) {
    if (
      !userId ||
      !typingChannelRef.current
    ) {
      return
    }

    await typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: userId,
        typing,
      },
    })
  }

  function handleTextChange(
    value: string
  ) {
    setText(value)

    void sendTypingState(
      value.trim().length > 0
    )

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current)
    }

    typingTimerRef.current =
      setTimeout(() => {
        void sendTypingState(false)
      }, 1200)
  }

  async function sendMessage() {
    const cleanText = text.trim()

    if (
      !cleanText ||
      !userId ||
      sending
    ) {
      return
    }

    setSending(true)
    setError(null)

    try {
      const {
        data,
        error: sendError,
      } = await supabase
        .from('messages')
        .insert({
          conversation_id: id,
          sender_id: userId,
          body: cleanText,
        })
        .select(
          'id, body, sender_id, created_at'
        )
        .single()

      if (sendError) {
        throw sendError
      }

      if (data) {
        setMessages((current) => {
          if (
            current.some(
              (message) =>
                message.id === data.id
            )
          ) {
            return current
          }

          return [
            ...current,
            data as Message,
          ]
        })
      }

      setText('')
      void sendTypingState(false)

      if (typingTimerRef.current) {
        clearTimeout(
          typingTimerRef.current
        )
        typingTimerRef.current = null
      }

      window.dispatchEvent(
        new Event(
          'crewcall-refresh-messages'
        )
      )
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : 'Unable to send message.'
      )
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  useEffect(() => {
    if (!userId || !id) {
      return
    }

    const channel = supabase
      .channel(
        `crewcall-conversation-${id}`
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const newMessage =
            payload.new as Message

          setMessages((current) => {
            if (
              current.some(
                (message) =>
                  message.id ===
                  newMessage.id
              )
            ) {
              return current
            }

            return [
              ...current,
              newMessage,
            ]
          })

          window.dispatchEvent(
            new Event(
              'crewcall-refresh-messages'
            )
          )
        }
      )
      .on(
        'broadcast',
        {
          event: 'typing',
        },
        ({ payload }) => {
          if (
            payload?.user_id !== userId
          ) {
            setOtherTyping(
              Boolean(payload?.typing)
            )
          }
        }
      )
      .subscribe()

    typingChannelRef.current =
      channel

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(
          typingTimerRef.current
        )
      }

      typingChannelRef.current =
        null

      void supabase.removeChannel(
        channel
      )
    }
  }, [id, userId])

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-6">
          {error}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-3xl font-black">
            CrewCall Messages
          </h1>

          {conversation ? (
            <p className="mt-2 text-slate-400">
              Job conversation
            </p>
          ) : null}
        </div>

        <div className="min-h-[400px] space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6">
          {messages.length === 0 ? (
            <p className="text-slate-400">
              No messages yet.
            </p>
          ) : null}

          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.sender_id === userId
                  ? 'ml-auto max-w-md rounded-2xl bg-blue-600 p-4'
                  : 'max-w-md rounded-2xl bg-white/10 p-4'
              }
            >
              {message.body}
            </div>
          ))}

          {otherTyping ? (
            <div className="max-w-fit rounded-2xl bg-white/5 px-4 py-2 text-sm font-bold text-cyan-300">
              Typing...
            </div>
          ) : null}
        </div>

        <div>
          <div className="flex gap-3">
            <input
              value={text}
              onChange={(event) =>
                handleTextChange(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey
                ) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
              placeholder="Type message..."
              className="flex-1 rounded-2xl bg-white/10 px-5 py-3 text-white outline-none focus:ring-2 focus:ring-cyan-400/40"
            />

            <button
              type="button"
              onClick={() =>
                void sendMessage()
              }
              disabled={
                sending || !text.trim()
              }
              className="rounded-2xl bg-blue-500 px-6 font-black transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending
                ? 'Sending...'
                : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
