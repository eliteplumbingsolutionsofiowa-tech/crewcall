'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function MessageProfileButton({
  profileId,
}: {
  profileId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleMessage() {
    setLoading(true)
    setError(null)

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      setError('You must be logged in.')
      setLoading(false)
      return
    }

    if (user.id === profileId) {
      setError('You cannot message yourself.')
      setLoading(false)
      return
    }

    const { data: myProfile, error: myProfileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (myProfileError || !myProfile) {
      setError(myProfileError?.message || 'Could not load your profile.')
      setLoading(false)
      return
    }

    const { data: targetProfile, error: targetProfileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', profileId)
      .maybeSingle()

    if (targetProfileError || !targetProfile) {
      setError(targetProfileError?.message || 'Could not load that profile.')
      setLoading(false)
      return
    }

    let workerId: string | null = null
    let companyId: string | null = null

    if (myProfile.role === 'worker' && targetProfile.role === 'company') {
      workerId = myProfile.id
      companyId = targetProfile.id
    } else if (myProfile.role === 'company' && targetProfile.role === 'worker') {
      workerId = targetProfile.id
      companyId = myProfile.id
    } else {
      setError('Messages can only be started between a worker and a company.')
      setLoading(false)
      return
    }

    const { data: existing, error: existingError } = await supabase
      .from('conversations')
      .select('id')
      .eq('worker_id', workerId)
      .eq('company_id', companyId)
      .is('job_id', null)
      .maybeSingle()

    if (existingError) {
      setError(existingError.message)
      setLoading(false)
      return
    }

    if (existing?.id) {
      router.push(`/messages/${existing.id}`)
      return
    }

    const { data: created, error: createError } = await supabase
      .from('conversations')
      .insert({
        worker_id: workerId,
        company_id: companyId,
        job_id: null,
      })
      .select('id')
      .single()

    if (createError || !created?.id) {
      setError(createError?.message || 'Failed to create conversation.')
      setLoading(false)
      return
    }

    const { error: messageError } = await supabase.from('messages').insert({
      conversation_id: created.id,
      sender_id: user.id,
      body: 'Hi, I’d like to connect.',
    })

    if (messageError) {
      setError(messageError.message)
      setLoading(false)
      return
    }

    router.push(`/messages/${created.id}`)
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleMessage}
        disabled={loading}
        className="rounded-2xl border px-5 py-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? 'Opening...' : 'Message'}
      </button>

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  )
}