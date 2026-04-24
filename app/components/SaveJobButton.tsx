'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SaveJobButton({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isWorker, setIsWorker] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadState() {
      setLoading(true)
      setError(null)

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.role !== 'worker') {
        setIsWorker(false)
        setLoading(false)
        return
      }

      setIsWorker(true)

      const { data: existing } = await supabase
        .from('saved_jobs')
        .select('id')
        .eq('worker_id', user.id)
        .eq('job_id', jobId)
        .maybeSingle()

      setSaved(!!existing)
      setLoading(false)
    }

    loadState()
  }, [jobId])

  async function handleToggle() {
    setSaving(true)
    setError(null)

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      setError('You must be logged in.')
      setSaving(false)
      return
    }

    if (saved) {
      const { error: deleteError } = await supabase
        .from('saved_jobs')
        .delete()
        .eq('worker_id', user.id)
        .eq('job_id', jobId)

      if (deleteError) {
        setError(deleteError.message)
        setSaving(false)
        return
      }

      setSaved(false)
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase
      .from('saved_jobs')
      .insert({
        worker_id: user.id,
        job_id: jobId,
      })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setSaved(true)
    setSaving(false)
  }

  if (loading || !isWorker) return null

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={saving}
        className={`rounded-2xl px-5 py-3 text-sm font-medium disabled:opacity-60 ${
          saved
            ? 'border bg-white hover:bg-gray-50'
            : 'border bg-white hover:bg-gray-50'
        }`}
      >
        {saving ? 'Working...' : saved ? 'Saved' : 'Save Job'}
      </button>

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  )
}