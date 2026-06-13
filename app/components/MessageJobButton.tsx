'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type ProfileRole = 'company' | 'worker' | string | null

type Profile = {
  id: string
  role: ProfileRole
}

type Conversation = {
  id: string
}

type ConversationInsert = {
  worker_id: string
  company_id: string
  job_id: string | null
}

type Props = {
  targetUserId: string
  jobId?: string | null
  label?: string
  className?: string
}

type QueryError = {
  message: string
}

type MaybeSingleQuery<T> = {
  maybeSingle: () => Promise<{ data: T | null; error: QueryError | null }>
}

type SingleQuery<T> = {
  single: () => Promise<{ data: T | null; error: QueryError | null }>
}

type SelectIdQuery<T> = {
  select: (columns: string) => SingleQuery<T>
}

type EqMaybeQuery<T> = {
  eq: (column: string, value: string) => MaybeSingleQuery<T>
}

type SelectMaybeTable<T> = {
  select: (columns: string) => EqMaybeQuery<T>
}

type ConversationQuery<T> = {
  eq: (column: string, value: string) => ConversationQuery<T>
  maybeSingle: () => Promise<{ data: T | null; error: QueryError | null }>
}

type ConversationTable<T> = {
  select: (columns: string) => ConversationQuery<T>
}

type ConversationInsertTable<TInsert, TReturn> = {
  insert: (value: TInsert) => SelectIdQuery<TReturn>
}

function profilesTable() {
  return supabase.from('profiles') as unknown as SelectMaybeTable<Profile>
}

function conversationsTable() {
  return supabase
    .from('conversations') as unknown as ConversationTable<Conversation>
}

function conversationsInsertTable() {
  return supabase
    .from('conversations') as unknown as ConversationInsertTable<
      ConversationInsert,
      Conversation
    >
}

export default function MessageJobButton({
  targetUserId,
  jobId = null,
  label = 'Message',
  className = '',
}: Props) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function startConversation() {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('Please log in to send a message.')
      setLoading(false)
      return
    }

    const { data: myProfile, error: myProfileError } =
      await profilesTable()
        .select('id, role')
        .eq('id', user.id)
        .maybeSingle()

    if (myProfileError || !myProfile) {
      setMessage(myProfileError?.message || 'Could not load your profile.')
      setLoading(false)
      return
    }

    const { data: targetProfile, error: targetProfileError } =
      await profilesTable()
        .select('id, role')
        .eq('id', targetUserId)
        .maybeSingle()

    if (targetProfileError || !targetProfile) {
      setMessage(
        targetProfileError?.message || 'Could not load the other profile.'
      )
      setLoading(false)
      return
    }

    let workerId: string | null = null
    let companyId: string | null = null

    if (myProfile.role === 'worker' && targetProfile.role === 'company') {
      workerId = myProfile.id
      companyId = targetProfile.id
    } else if (
      myProfile.role === 'company' &&
      targetProfile.role === 'worker'
    ) {
      workerId = targetProfile.id
      companyId = myProfile.id
    } else {
      setMessage('Messages must be between a company and a worker.')
      setLoading(false)
      return
    }

    let query = conversationsTable()
      .select('id')
      .eq('worker_id', workerId)
      .eq('company_id', companyId)

    if (jobId) {
      query = query.eq('job_id', jobId)
    }

    const { data: existingConversation, error: existingError } =
      await query.maybeSingle()

    if (existingError) {
      setMessage(existingError.message)
      setLoading(false)
      return
    }

    if (existingConversation?.id) {
      window.location.href = `/messages/${existingConversation.id}`
      return
    }

    const { data: newConversation, error: createError } =
      await conversationsInsertTable()
        .insert({
          worker_id: workerId,
          company_id: companyId,
          job_id: jobId,
        })
        .select('id')
        .single()

    if (createError) {
      setMessage(createError.message)
      setLoading(false)
      return
    }

    if (newConversation?.id) {
      window.location.href = `/messages/${newConversation.id}`
      return
    }

    setMessage('Could not create conversation.')
    setLoading(false)
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={startConversation}
        disabled={loading}
        className={
          className ||
          'rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50'
        }
      >
        {loading ? 'Opening...' : label}
      </button>

      {message && (
        <p className="text-sm font-bold text-red-600">
          {message}
        </p>
      )}
    </div>
  )
}