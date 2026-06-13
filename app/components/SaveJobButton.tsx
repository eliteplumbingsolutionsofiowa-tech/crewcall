'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  jobId: string
}

type ProfileRole = {
  role: 'company' | 'worker' | null
}

type SavedJobRow = {
  id: string
}

type SavedJobInsert = {
  job_id: string
  worker_id: string
}

export default function SaveJobButton({ jobId }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isWorker, setIsWorker] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadSavedStatus() {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!isMounted) return

      if (!user) {
        setUserId(null)
        setIsWorker(false)
        setIsSaved(false)
        setLoading(false)
        return
      }

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle<ProfileRole>()

      if (!isMounted) return

      if (profile?.role !== 'worker') {
        setIsWorker(false)
        setIsSaved(false)
        setLoading(false)
        return
      }

      setIsWorker(true)

      const { data: savedJob } = await supabase
        .from('saved_jobs')
        .select('id')
        .match({
          job_id: jobId,
          worker_id: user.id,
        })
        .maybeSingle<SavedJobRow>()

      if (!isMounted) return

      setIsSaved(Boolean(savedJob))
      setLoading(false)
    }

    loadSavedStatus()

    return () => {
      isMounted = false
    }
  }, [jobId])

  async function toggleSaved() {
    if (!userId || saving) return

    setSaving(true)

    try {
      if (isSaved) {
        const { error } = await supabase
          .from('saved_jobs')
          .delete()
          .match({
            job_id: jobId,
            worker_id: userId,
          })

        if (!error) {
          setIsSaved(false)
        }

        return
      }

      const payload: SavedJobInsert = {
        job_id: jobId,
        worker_id: userId,
      }

      const { error } = await supabase.from('saved_jobs').insert(payload)

      if (!error) {
        setIsSaved(true)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading || !isWorker) return null

  return (
    <button
      type="button"
      onClick={toggleSaved}
      disabled={saving}
      className={`rounded-2xl px-4 py-2 text-sm font-black shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
        isSaved
          ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      }`}
    >
      {saving ? 'Saving...' : isSaved ? 'Saved' : 'Save Job'}
    </button>
  )
}