'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type FileCategory = 'profile_photo' | 'certification' | 'license' | 'insurance'

type Props = {
  userId: string
  category: FileCategory
  label: string
  description: string
  accept?: string
  onUploadComplete?: () => void
}

type ProfileFileInsert = {
  user_id: string
  category: FileCategory
  file_name: string
  file_url: string
  file_type: string
}

type QueryError = {
  message: string
}

type InsertTable<TInsert> = {
  insert: (
    value: TInsert
  ) => Promise<{ data: null; error: QueryError | null }>
}

function profileFilesTable() {
  return supabase
    .from('profile_files') as unknown as InsertTable<ProfileFileInsert>
}

export default function ProfileFileUpload({
  userId,
  category,
  label,
  description,
  accept,
  onUploadComplete,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) return

    setUploading(true)
    setMessage(null)

    try {
      const fileExt = file.name.split('.').pop() || 'file'
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const filePath = `${userId}/${category}/${Date.now()}-${safeFileName}`

      const { error: uploadError } = await supabase.storage
        .from('profile-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || undefined,
        })

      if (uploadError) {
        setMessage(uploadError.message)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('profile-files').getPublicUrl(filePath)

      const insertPayload: ProfileFileInsert = {
        user_id: userId,
        category,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type || fileExt,
      }

      const { error: insertError } =
        await profileFilesTable().insert(insertPayload)

      if (insertError) {
        setMessage(insertError.message)
        return
      }

      setMessage('File uploaded successfully.')
      onUploadComplete?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-black text-slate-900">{label}</h3>

        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50">
        <span className="text-sm font-black text-slate-800">
          {uploading ? 'Uploading...' : 'Choose file'}
        </span>

        <span className="mt-1 text-xs font-semibold text-slate-500">
          PDF, image, or document
        </span>

        <input
          type="file"
          accept={accept}
          disabled={uploading}
          onChange={handleUpload}
          className="hidden"
        />
      </label>

      {message && (
        <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
          {message}
        </p>
      )}
    </div>
  )
}