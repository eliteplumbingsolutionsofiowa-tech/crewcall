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

  const allowsMultiple = category !== 'profile_photo'

  async function uploadOneFile(file: File) {
    const fileExt = file.name.split('.').pop() || 'file'
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')

    const uniquePrefix = `${Date.now()}-${crypto.randomUUID()}`
    const filePath =
      `${userId}/${category}/${uniquePrefix}-${safeFileName}`

    const { error: uploadError } = await supabase.storage
      .from('profile-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })

    if (uploadError) {
      throw uploadError
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
      await supabase.storage.from('profile-files').remove([filePath])
      throw insertError
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const selectedFiles = Array.from(input.files || [])

    if (!selectedFiles.length) return

    const filesToUpload = allowsMultiple
      ? selectedFiles
      : selectedFiles.slice(0, 1)

    setUploading(true)
    setMessage(null)

    let uploadedCount = 0
    const failures: string[] = []

    try {
      for (const file of filesToUpload) {
        try {
          await uploadOneFile(file)
          uploadedCount += 1
        } catch (error) {
          failures.push(
            `${file.name}: ${
              error instanceof Error ? error.message : 'Upload failed'
            }`
          )
        }
      }

      if (uploadedCount > 0) {
        onUploadComplete?.()
      }

      if (failures.length === 0) {
        setMessage(
          uploadedCount === 1
            ? 'File uploaded successfully.'
            : `${uploadedCount} files uploaded successfully.`
        )
      } else if (uploadedCount > 0) {
        setMessage(
          `${uploadedCount} uploaded. ${failures.length} failed.`
        )
      } else {
        setMessage(failures[0] || 'Upload failed.')
      }
    } finally {
      setUploading(false)
      input.value = ''
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-black text-slate-950">
          {label}
        </h3>

        <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">
          {description}
        </p>
      </div>

      <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50">
        <div className="mb-2 text-2xl">+</div>

        <span className="text-sm font-black text-slate-800">
          {uploading
            ? 'Uploading...'
            : allowsMultiple
              ? 'Choose files'
              : 'Choose file'}
        </span>

        <span className="mt-1 text-xs font-semibold text-slate-500">
          {allowsMultiple
            ? 'Select one or multiple PDF, image, or document files'
            : 'Select a profile image'}
        </span>

        <input
          type="file"
          accept={accept}
          multiple={allowsMultiple}
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
