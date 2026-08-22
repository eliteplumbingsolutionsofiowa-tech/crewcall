'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('ProfileFiles')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const allowsMultiple = category !== 'profile_photo'
  const isNative = Capacitor.isNativePlatform()
  const acceptsPdf = Boolean(accept?.includes('.pdf'))

  async function uploadOneFile(file: File) {
    let oldProfilePhotos: Array<{
      id: string
      file_url: string | null
    }> = []

    if (category === 'profile_photo') {
      const { data } = await (supabase as any)
        .from('profile_files')
        .select('id,file_url')
        .eq('user_id', userId)
        .eq('category', 'profile_photo')

      oldProfilePhotos = data || []
    }

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

    if (category === 'profile_photo' && oldProfilePhotos.length > 0) {
      const oldStoragePaths = oldProfilePhotos
        .map((photo) => {
          if (!photo.file_url) return null

          try {
            const url = new URL(photo.file_url)
            return url.pathname.split('/profile-files/')[1] || null
          } catch {
            return null
          }
        })
        .filter((path): path is string => Boolean(path))

      if (oldStoragePaths.length > 0) {
        await supabase.storage
          .from('profile-files')
          .remove(oldStoragePaths)
      }

      const oldIds = oldProfilePhotos.map((photo) => photo.id)

      if (oldIds.length > 0) {
        await (supabase as any)
          .from('profile_files')
          .delete()
          .in('id', oldIds)
      }
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
            ? t('uploadedSuccessfully')
            : t('filesUploadedSuccessfully', { count: uploadedCount })
        )
      } else if (uploadedCount > 0) {
        setMessage(
          t('uploadedWithFailures', { uploaded: uploadedCount, failed: failures.length })
        )
      } else {
        setMessage(failures[0] || t('uploadFailed'))
      }
    } finally {
      setUploading(false)
      input.value = ''
    }
  }

  return (
    <div
      className={
        category === 'profile_photo'
          ? 'rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sm:rounded-2xl sm:p-5'
          : 'rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5'
      }
    >
      <div
        className={
          category === 'profile_photo'
            ? 'mb-1.5 sm:mb-4'
            : 'mb-2 sm:mb-4'
        }
      >
        <h3 className="text-sm font-black text-slate-950 sm:text-base">
          {label}
        </h3>

        <p className="mt-1 text-xs font-semibold leading-4 text-slate-500 sm:text-sm sm:leading-5">
          {description}
        </p>
      </div>

      {isNative ? (
        <div
          className={
            category === 'profile_photo'
              ? 'grid grid-cols-2 gap-2'
              : 'grid gap-2 sm:grid-cols-2'
          }
        >
          <label className="flex min-h-[54px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-black text-slate-800 transition hover:border-blue-400 hover:bg-blue-50 sm:min-h-[100px]">
            {uploading ? 'Working...' : 'Take Photo'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={uploading}
              onChange={handleUpload}
              className="hidden"
            />
          </label>

          <label className="flex min-h-[54px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-black text-slate-800 transition hover:border-blue-400 hover:bg-blue-50 sm:min-h-[100px]">
            {uploading
              ? 'Working...'
              : allowsMultiple
                ? 'Choose Photos'
                : 'Choose Photo'}
            <input
              type="file"
              accept="image/*"
              multiple={allowsMultiple}
              disabled={uploading}
              onChange={handleUpload}
              className="hidden"
            />
          </label>

          {acceptsPdf ? (
            <label className="flex min-h-[50px] cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-black text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 sm:col-span-2">
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
                ? t('uploading')
                : allowsMultiple
                  ? t('chooseFiles')
                  : t('chooseFile')}
            </span>

            <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-slate-500 sm:mt-1 sm:text-xs">
              {allowsMultiple
                ? t('selectMultiple')
                : t('selectProfileImage')}
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
