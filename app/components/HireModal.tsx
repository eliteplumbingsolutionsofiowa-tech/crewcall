'use client'

import { useEffect } from 'react'

type Applicant = {
  id: string
  worker_id: string
  worker?: {
    full_name?: string | null
    trade?: string | null
  } | null
}

export default function HireModal({
  open,
  applicant,
  jobTitle,
  onCancel,
  onConfirm,
}: {
  open: boolean
  applicant: Applicant | null
  jobTitle: string
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }

    if (open) {
      window.addEventListener('keydown', handleEscape)
    }

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [open, onCancel])

  if (!open || !applicant) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
        <h2 className="text-2xl font-black text-white">
          Confirm Hire
        </h2>

        <p className="mt-3 text-sm text-slate-300">
          You are about to hire:
        </p>

        <div className="mt-4 rounded-2xl bg-white/5 p-4">
          <p className="text-lg font-black text-white">
            {applicant.worker?.full_name || 'Unknown Worker'}
          </p>

          <p className="text-sm text-slate-400">
            {applicant.worker?.trade || 'No trade listed'}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Job: {jobTitle}
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            className="flex-1 rounded-2xl bg-green-500 px-4 py-3 text-sm font-black text-white hover:bg-green-400"
          >
            Hire Worker
          </button>
        </div>
      </div>
    </div>
  )
}