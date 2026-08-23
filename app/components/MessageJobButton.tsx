'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: string | null
}

type Conversation = {
  id: string
}

type Props = {
  targetUserId: string
  jobId?: string | null
  label?: string
  className?: string
}

export default function MessageJobButton({
  targetUserId,
  jobId = null,
  label = 'Message Worker',
  className = '',
}: Props) {
  const router = useRouter()
  const t = useTranslations('Messages')
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
      setMessage(t('pleaseLoginToMessage'))
      setLoading(false)
      return
    }

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single<Profile>()

    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', targetUserId)
      .single<Profile>()

    if (!myProfile || !targetProfile) {
      setMessage(t('couldNotLoadProfiles'))
      setLoading(false)
      return
    }

    let workerId: string | null = null
    let companyId: string | null = null

    const myRole = myProfile.role?.toLowerCase()
    const targetRole = targetProfile.role?.toLowerCase()

    if (
      myRole === 'company' &&
      targetRole === 'worker'
    ) {
      companyId = myProfile.id
      workerId = targetProfile.id
    }

    if (
      myRole === 'worker' &&
      targetRole === 'company'
    ) {
      workerId = myProfile.id
      companyId = targetProfile.id
    }

    if (!workerId || !companyId) {
      setMessage(t('unableToStartJobConversation'))
      setLoading(false)
      return
    }

    let query = supabase
      .from('conversations')
      .select('id')
      .eq('worker_id', workerId)
      .eq('company_id', companyId)

    if (jobId) {
      query = query.eq('job_id', jobId)
    }

    const { data: existingConversation } =
      await query.maybeSingle<Conversation>()

    if (existingConversation?.id) {
      router.push(`/messages/${existingConversation.id}`)
      return
    }

    const { data: newConversation, error } =
      await supabase
        .from('conversations')
        .insert({
          worker_id: workerId,
          company_id: companyId,
          job_id: jobId,
        })
        .select('id')
        .single<Conversation>()

    if (error || !newConversation) {
      setMessage(
        error?.message || t('unableToCreateConversation')
      )
      setLoading(false)
      return
    }

    router.push(`/messages/${newConversation.id}`)
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={startConversation}
        disabled={loading}
        className="
          inline-flex
          min-h-12
          items-center
          justify-center
          rounded-2xl
          border
          border-cyan-400/30
          bg-cyan-400
          px-5
          py-3
          text-sm
          font-black
          text-slate-950
          shadow-lg
          shadow-cyan-400/20
          transition
          hover:bg-cyan-300
          disabled:cursor-not-allowed
          disabled:opacity-60
          ${className}
        "
      >
        {loading ? t('opening') : `💬 ${label || t('messageWorker')}`}
      </button>

      {message && (
        <p className="mt-2 text-sm font-bold text-red-300">
          {message}
        </p>
      )}
    </div>
  )
}
