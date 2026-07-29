'use client'

import { useEffect, useState } from 'react'
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
  const id = params.id as string

  const [conversation, setConversation] =
    useState<Conversation | null>(null)

  const [messages, setMessages] =
    useState<Message[]>([])

  const [text, setText] =
    useState('')

  const [userId, setUserId] =
    useState<string | null>(null)

  const [error, setError] =
    useState<string | null>(null)

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Please log in.')
      return
    }

    setUserId(user.id)

    const { data: convo, error: convoError } =
      await supabase
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
      setError('You do not have access to this conversation.')
      return
    }

    setConversation(convo)

    const { data: messageData } =
      await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', {
          ascending: true,
        })

    setMessages(messageData || [])
  }

  async function sendMessage() {
    if (!text.trim() || !userId) return

    const { error } =
      await supabase
        .from('messages')
        .insert({
          conversation_id: id,
          sender_id: userId,
          body: text.trim(),
        })

    if (!error) {
      setText('')
      load()
    }
  }

  useEffect(() => {
    load()
  }, [id])

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

          {conversation && (
            <p className="mt-2 text-slate-400">
              Job conversation
            </p>
          )}
        </div>


        <div className="min-h-[400px] rounded-3xl border border-white/10 bg-slate-900/60 p-6 space-y-4">

          {messages.length === 0 && (
            <p className="text-slate-400">
              No messages yet.
            </p>
          )}

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

        </div>


        <div className="flex gap-3">

          <input
            value={text}
            onChange={(e)=>setText(e.target.value)}
            placeholder="Type message..."
            className="flex-1 rounded-2xl bg-white/10 px-5 py-3 text-white outline-none"
          />

          <button
            onClick={sendMessage}
            className="rounded-2xl bg-blue-500 px-6 font-black"
          >
            Send
          </button>

        </div>

      </div>
    </main>
  )
}
