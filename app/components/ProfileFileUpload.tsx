'use client'

import { useState } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

import { supabase } from '@/lib/supabase'

type FileCategory =
  | 'profile_photo'
  | 'certification'
  | 'license'
  | 'insurance'

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
  const isNative = Capacitor.isNativePlatform()
  const acceptsPdf = Boolean(accept?.includes('.pdf'))

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
    } = supabase.storage
      .from('profile-files')
      .getPublicUrl(filePath)

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
      await supabase.storage
        .from('profile-files')
        .remove([filePath])

      throw insertError
    }
  }

  async function uploadNativePhoto(source: CameraSource) {
    setUploading(true)
    setMessage(null)

    try {
      const photo = await Camera.getPhoto({
        source,
        resultType: CameraResultType.Uri,
        quality: 85,
        allowEditing: false,
        saveToGallery: false,
        correctOrientation: true,
      })

      if (!photo.webPath) {
        throw new Error('No photo was returned.')
      }

      const response = await fetch(photo.webPath)
      const blob = await response.blob()

      const extension =
        photo.format === 'png'
          ? 'png'
          : photo.format === 'gif'
            ? 'gif'
            : 'jpg'

      const contentType =
        blob.type ||
        (extension === 'png'
          ? 'image/png'
          : extension === 'gif'
            ? 'image/gif'
            : 'image/jpeg')

      const file = new File(
        [blob],
        `CrewCall-${category}-${Date.now()}.${extension}`,
        { type: contentType }
      )

      await uploadOneFile(file)

      setMessage('File uploaded successfully.')
      onUploadComplete?.()
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Photo upload failed.'

      if (
        errorMessage.toLowerCase().includes('cancel') ||
        errorMessage.toLowerCase().includes('user cancelled')
      ) {
        setMessage(null)
      } else {
        setMessage(errorMessage)
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
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
              error instanceof Error
                ? error.message
                : 'Upload failed'
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
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
      <div className="mb-2 sm:mb-4">
        <h3 className="text-sm font-black text-slate-950 sm:text-base">
          {label}
        </h3>

        <p className="mt-1 text-xs font-semibold leading-4 text-slate-500 sm:text-sm sm:leading-5">
          {description}
        </p>
      </div>

      {isNative ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void uploadNativePhoto(CameraSource.Camera)}
            disabled={uploading}
            className="min-h-[72px] rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[100px]"
          >
            {uploading ? 'Working...' : 'Take Photo'}
          </button>

          <button
            type="button"
            onClick={() => void uploadNativePhoto(CameraSource.Photos)}
            disabled={uploading}
            className="min-h-[72px] rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[100px]"
          >
            {uploading ? 'Working...' : 'Choose Photo'}
          </button>

          {acceptsPdf ? (
            <label className="flex min-h-[64px] cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 sm:col-span-2">
              Choose PDF

              <input
                type="file"
                accept=".pdf,application/pdf"
                disabled={uploading}
                onChange={handleUpload}
                className="hidden"
              />
            </label>
          ) : null}
        </div>
      ) : (
        <label className="flex min-h-[72px] cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-3 transition hover:border-blue-400 hover:bg-blue-50 sm:min-h-[120px] sm:flex-col sm:justify-center sm:gap-0 sm:rounded-2xl sm:px-4 sm:py-6 sm:text-center">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xl font-black text-slate-700 shadow-sm sm:mb-2 sm:h-auto sm:w-auto sm:bg-transparent sm:text-2xl sm:shadow-none">
            +
          </div>

          <div className="min-w-0 flex-1 text-left sm:text-center">
            <span className="block text-sm font-black text-slate-800">
              {uploading
                ? 'Uploading...'
                : allowsMultiple
                  ? 'Choose files'
                  : 'Choose file'}
            </span>

            <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-slate-500 sm:mt-1 sm:text-xs">
              {allowsMultiple
                ? 'Select one or multiple files'
                : 'Select a profile image'}
            </span>
          </div>

          <input
            type="file"
            accept={accept}
            multiple={allowsMultiple}
            disabled={uploading}
            onChange={handleUpload}
            className="hidden"
          />
        </label>
      )}

      {message && (
        <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 sm:mt-3 sm:rounded-xl sm:text-sm">
          {message}
        </p>
      )}
    </div>
  )
}
