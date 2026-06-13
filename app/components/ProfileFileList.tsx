'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type ProfileFile = {
  id: string
  category: string | null
  file_name: string | null
  file_url: string | null
  file_type: string | null
  created_at: string
}

type Props = {
  files: ProfileFile[]
  canDelete?: boolean
  onDeleteComplete?: () => void
}

export default function ProfileFileList({
  files,
  canDelete = false,
  onDeleteComplete,
}: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function deleteFile(file: ProfileFile) {
    if (!file.file_url) return

    const confirmed = window.confirm(
      'Are you sure you want to delete this file?'
    )

    if (!confirmed) return

    setDeletingId(file.id)
    setMessage(null)

    try {
      const url = new URL(file.file_url)
      const pathParts = url.pathname.split('/profile-files/')
      const storagePath = pathParts[1]

      if (storagePath) {
        await supabase.storage.from('profile-files').remove([storagePath])
      }

      const { error } = await supabase
        .from('profile_files')
        .delete()
        .eq('id', file.id)

      if (error) throw error

      setMessage('File deleted.')

      if (onDeleteComplete) onDeleteComplete()
    } catch (error: any) {
      setMessage(error?.message || 'Could not delete file.')
    } finally {
      setDeletingId(null)
    }
  }

  if (!files.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">No files uploaded yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {message && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
          {message}
        </div>
      )}

      {files.map((file) => (
        <div
          key={file.id}
          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div>
            <p className="text-sm font-black text-slate-900">
              {file.file_name || 'Uploaded file'}
            </p>

            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {file.category || 'profile file'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {file.file_url && (
              <a
                href={file.file_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700"
              >
                View file
              </a>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={() => deleteFile(file)}
                disabled={deletingId === file.id}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingId === file.id ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}