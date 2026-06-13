'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type JobFile = {
  id: string
  file_name: string | null
  file_url: string | null
  file_type: string | null
  created_at: string
}

type Props = {
  files: JobFile[]
  canDelete?: boolean
  onDeleteComplete?: () => void
}

function getStoragePath(fileUrl: string) {
  try {
    const marker = '/storage/v1/object/public/job-files/'
    const index = fileUrl.indexOf(marker)

    if (index === -1) return null

    return decodeURIComponent(fileUrl.slice(index + marker.length))
  } catch {
    return null
  }
}

function formatDate(date: string) {
  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) return 'Date unavailable'

  return parsed.toLocaleString()
}

function getFileBadge(fileType: string | null, fileName: string | null) {
  const lowerName = fileName?.toLowerCase() || ''

  if (fileType?.startsWith('image/')) return 'Image'
  if (fileType?.includes('pdf') || lowerName.endsWith('.pdf')) return 'PDF'
  if (lowerName.endsWith('.doc') || lowerName.endsWith('.docx')) return 'DOC'
  if (lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx')) return 'XLS'
  if (lowerName.endsWith('.txt')) return 'TXT'

  return 'File'
}

function getFileIcon(fileType: string | null, fileName: string | null) {
  const badge = getFileBadge(fileType, fileName)

  if (badge === 'Image') return '🖼️'
  if (badge === 'PDF') return '📕'
  if (badge === 'DOC') return '📘'
  if (badge === 'XLS') return '📊'
  if (badge === 'TXT') return '📝'

  return '📄'
}

export default function JobFileList({
  files,
  canDelete = false,
  onDeleteComplete,
}: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function deleteFile(file: JobFile) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this uploaded file?'
    )

    if (!confirmed) return

    setDeletingId(file.id)
    setMessage(null)

    try {
      if (file.file_url) {
        const storagePath = getStoragePath(file.file_url)

        if (storagePath) {
          const { error: storageError } = await supabase.storage
            .from('job-files')
            .remove([storagePath])

          if (storageError) {
            setMessage(storageError.message)
            setDeletingId(null)
            return
          }
        }
      }

      const { error: dbError } = await supabase
        .from('job_files')
        .delete()
        .eq('id', file.id)

      if (dbError) {
        setMessage(dbError.message)
        setDeletingId(null)
        return
      }

      onDeleteComplete?.()
    } catch (error: any) {
      setMessage(error?.message || 'Failed to delete file.')
    }

    setDeletingId(null)
  }

  if (files.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl">
          📎
        </div>

        <h3 className="mt-4 text-lg font-black text-white">
          No files uploaded yet
        </h3>

        <p className="mt-2 text-sm font-semibold text-slate-400">
          Uploaded plans, specs, photos, and PDFs will show here.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-black text-white">Uploaded Files</h3>
          <p className="mt-1 text-sm font-semibold text-slate-400">
            Open files in a new tab or remove outdated uploads.
          </p>
        </div>

        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-200">
          {files.length} {files.length === 1 ? 'file' : 'files'}
        </span>
      </div>

      {message && (
        <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-3 text-sm font-bold text-red-200">
          {message}
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {files.map((file) => {
          const isImage = file.file_type?.startsWith('image/')
          const badge = getFileBadge(file.file_type, file.file_name)
          const icon = getFileIcon(file.file_type, file.file_name)

          return (
            <div
              key={file.id}
              className="group overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80 shadow-xl transition hover:-translate-y-1 hover:border-cyan-400/30"
            >
              <a
                href={file.file_url || '#'}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <div className="relative">
                  {isImage && file.file_url ? (
                    <img
                      src={file.file_url}
                      alt={file.file_name || 'Uploaded file'}
                      className="h-44 w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-44 items-center justify-center bg-white/5 text-6xl">
                      {icon}
                    </div>
                  )}

                  <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-xs font-black uppercase tracking-wide text-white backdrop-blur">
                    {badge}
                  </div>
                </div>

                <div className="p-4">
                  <p className="truncate text-sm font-black text-white">
                    {file.file_name || 'Uploaded file'}
                  </p>

                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Uploaded {formatDate(file.created_at)}
                  </p>

                  <p className="mt-3 text-xs font-black uppercase tracking-wide text-cyan-300">
                    Open File →
                  </p>
                </div>
              </a>

              {canDelete && (
                <div className="border-t border-white/10 p-4">
                  <button
                    type="button"
                    onClick={() => deleteFile(file)}
                    disabled={deletingId === file.id}
                    className="w-full rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-500/20 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingId === file.id ? 'Deleting...' : 'Delete File'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}