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

function categoryLabel(category: string | null) {
  switch (category) {
    case 'profile_photo':
      return 'Profile Photo'
    case 'license':
      return 'License'
    case 'certification':
      return 'Certification'
    case 'insurance':
      return 'Insurance'
    default:
      return 'Profile Document'
  }
}

function displayFileName(file: ProfileFile) {
  const name = file.file_name?.trim()

  if (!name || name.toLowerCase().startsWith('unknown')) {
    return categoryLabel(file.category)
  }

  return name
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

      onDeleteComplete?.()
    } catch (error: unknown) {
      setMessage(
        error instanceof Error ? error.message : 'Could not delete file.'
      )
    } finally {
      setDeletingId(null)
    }
  }

  if (!files.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
        <p className="text-sm font-bold text-slate-600">
          No documents uploaded yet.
        </p>
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
          className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950">
              {displayFileName(file)}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-blue-700">
                {categoryLabel(file.category)}
              </span>

              {file.created_at && (
                <span className="text-xs font-semibold text-slate-500">
                  {new Date(file.created_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {file.file_url && (
              <a
                href={file.file_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700"
              >
                View
              </a>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={() => deleteFile(file)}
                disabled={deletingId === file.id}
                className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:opacity-60"
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
