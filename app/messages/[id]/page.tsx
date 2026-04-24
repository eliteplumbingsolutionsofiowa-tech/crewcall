'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Conversation = {
  id: string
  worker_id: string
  company_id: string
  job_id: string | null
}

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

export default function ConversationPage() {
  const routeParams = useParams()
  const conversationId = routeParams?.id as string

  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadConversation() {
      if (!conversationId) return

      setLoading(true)
      setErrorMessage(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      setUserId(user?.id ?? null)

      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .select('id, worker_id, company_id, job_id')
        .eq('id', conversationId)
        .single()

      if (conversationError || !conversationData) {
        setErrorMessage('Could not load conversation.')
        setLoading(false)
        return
      }

      setConversation(conversationData)

      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (messageError) {
        setErrorMessage('Could not load messages.')
        setMessages([])
      } else {
        setMessages(messageData || [])
      }

      setLoading(false)
    }

    loadConversation()
  }, [conversationId])

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
          const newRow = payload.new as Message

          setMessages((prev) => {
            const exists = prev.some((msg) => msg.id === newRow.id)
            if (exists) return prev
            return [...prev, newRow]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  async function handleSendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!newMessage.trim() || !userId || !conversationId) return

    const messageText = newMessage.trim()

    setSending(true)
    setErrorMessage(null)
    setNewMessage('')

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: userId,
      body: messageText,
    })

    if (error) {
      setErrorMessage('Could not send message.')
      setNewMessage(messageText)
    }

    setSending(false)
  }

  if (loading) {
    return <div className="p-6">Loading conversation...</div>
  }

  if (!conversation) {
    return <div className="p-6">Conversation not found.</div>
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-80px)] max-w-4xl flex-col p-4">
      <div className="mb-4 rounded-2xl border bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Conversation</h1>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="flex-1 overflow-y-auto rounded-2xl border bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-gray-500">No messages yet.</p>
          ) : (
            messages.map((message) => {
              const isMine = message.sender_id === userId

              return (
                <div
                  key={message.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      isMine
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    <p
                      className={`mt-2 text-xs ${
                        isMine ? 'text-blue-100' : 'text-gray-500'
                      }`}
                    >
                      {new Date(message.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <form
        onSubmit={handleSendMessage}
        className="mt-4 flex gap-2 rounded-2xl border bg-white p-3 shadow-sm"
      >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </main>
  )
}