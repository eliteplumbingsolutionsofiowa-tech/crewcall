'use client'

import { useEffect, useState } from 'react'
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

function isImageFile(file: ProfileFile) {
  const type = file.file_type?.toLowerCase() || ''
  const name = file.file_name?.toLowerCase() || ''

  return (
    type.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(name)
  )
}

export default function ProfileFileList({
  files,
  canDelete = false,
  onDeleteComplete,
}: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [viewingFile, setViewingFile] = useState<ProfileFile | null>(null)

  useEffect(() => {
    if (!viewingFile) return

    const handleBack = () => {
      setViewingFile(null)
    }

    window.history.pushState(
      { crewcallProfileFileViewer: true },
      '',
      window.location.href
    )

    window.addEventListener('popstate', handleBack)

    return () => {
      window.removeEventListener('popstate', handleBack)
    }
  }, [viewingFile])

  function openFile(file: ProfileFile) {
    if (!file.file_url) return
    setViewingFile(file)
  }

  function closeViewer() {
    if (!viewingFile) return
    window.history.back()
  }

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
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center sm:rounded-2xl sm:px-5 sm:py-8">
        <p className="text-sm font-bold text-slate-600">
          No documents uploaded yet.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2 sm:space-y-3">
        {message && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800 sm:px-4 sm:py-3">
            {message}
          </div>
        )}

        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:rounded-2xl sm:p-4"
          >
            {file.file_url && isImageFile(file) ? (
              <button
                type="button"
                onClick={() => openFile(file)}
                className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white sm:h-16 sm:w-16"
              >
                <img
                  src={file.file_url}
                  alt={displayFileName(file)}
                  className="h-full w-full object-cover"
                />
              </button>
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[11px] font-black text-slate-500 sm:h-16 sm:w-16">
                FILE
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-950">
                {displayFileName(file)}
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-blue-700">
                  {categoryLabel(file.category)}
                </span>

                {file.created_at && (
                  <span className="text-[11px] font-semibold text-slate-500">
                    {new Date(file.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="mt-2 flex gap-2">
                {file.file_url && (
                  <button
                    type="button"
                    onClick={() => openFile(file)}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white transition hover:bg-blue-700"
                  >
                    View
                  </button>
                )}

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => deleteFile(file)}
                    disabled={deletingId === file.id}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    {deletingId === file.id ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {viewingFile?.file_url && (
        <div className="fixed inset-0 z-[9999] flex h-[100dvh] flex-col overflow-hidden bg-black">
          <div className="relative z-20 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-3 pb-2 pt-[max(8px,env(safe-area-inset-top))] text-white sm:px-4 sm:pb-3 sm:pt-[max(12px,env(safe-area-inset-top))]">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">
                {displayFileName(viewingFile)}
              </p>

              <p className="text-xs font-semibold text-slate-400">
                {categoryLabel(viewingFile.category)}
              </p>
            </div>

            <button
              type="button"
              onClick={closeViewer}
              className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-950 shadow-lg sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
            >
              ← Back
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden bg-black">
            {isImageFile(viewingFile) ? (
              <div className="flex h-full w-full items-center justify-center overflow-auto p-4 sm:p-5">
                <img
                  src={viewingFile.file_url}
                  alt={displayFileName(viewingFile)}
                  className="block h-auto max-h-[72dvh] w-auto max-w-[92vw] rounded-lg object-contain sm:max-h-[calc(100dvh-100px)] sm:max-w-full sm:rounded-none"
                />
              </div>
            ) : (
              <iframe
                src={viewingFile.file_url}
                title={displayFileName(viewingFile)}
                className="h-full w-full border-0 bg-white"
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}
