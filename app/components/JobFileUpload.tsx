'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type JobFileCategory =
  | 'job_attachment'
  | 'completion_photo'
  | 'inspection_report'
  | 'permit_document'
  | 'receipt'

type Props = {
  jobId: string
  userId: string
  category?: JobFileCategory
  title?: string
  description?: string
  accept?: string
  buttonLabel?: string
  onUploadComplete?: () => void
}

type JobFileInsert = {
  job_id: string
  uploaded_by: string
  file_name: string
  file_url: string
  file_type: string
  category: JobFileCategory
}

type QueryError = {
  message: string
}

type InsertTable<TInsert> = {
  insert: (
    value: TInsert
  ) => Promise<{ data: null; error: QueryError | null }>
}

function jobFilesTable() {
  return supabase
    .from('job_files') as unknown as InsertTable<JobFileInsert>
}

export default function JobFileUpload({
  jobId,
  userId,
  category = 'job_attachment',
  title = 'Job Attachments',
  description = 'Upload plans, photos, specs, paperwork, or job-related documents.',
  accept,
  buttonLabel = 'Upload Files',
  onUploadComplete,
}: Props) {
  const fileInputRef =
    useRef<HTMLInputElement | null>(null)

  const [uploading, setUploading] =
    useState(false)

  const [message, setMessage] =
    useState<string | null>(null)

  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files ?? []
    )

    if (files.length === 0) return

    setUploading(true)
    setMessage(null)

    try {
      for (const file of files) {
        const extension =
          file.name.split('.').pop() || 'file'

        const safeName = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-zA-Z0-9-_]/g, '-')
          .toLowerCase()

        const filePath =
          `${jobId}/${userId}/${category}/${Date.now()}-${safeName}.${extension}`

        const { error: uploadError } =
          await supabase.storage
            .from('job-files')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: true,
            })

        if (uploadError) {
          throw new Error(
            uploadError.message
          )
        }

        const { data } =
          supabase.storage
            .from('job-files')
            .getPublicUrl(filePath)

        const { error: insertError } =
          await jobFilesTable().insert({
            job_id: jobId,
            uploaded_by: userId,
            file_name: file.name,
            file_url: data.publicUrl,
            file_type:
              file.type || extension,
            category,
          })

        if (insertError) {
          throw new Error(
            insertError.message
          )
        }
      }

      setMessage(
        files.length === 1
          ? 'File uploaded successfully.'
          : `${files.length} files uploaded successfully.`
      )

      onUploadComplete?.()

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Upload failed.'
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-950">
            {title}
          </h3>

          <p className="mt-1 text-sm font-bold text-slate-500">
            {description}
          </p>

          {message ? (
            <p className="mt-3 text-sm font-bold text-blue-700">
              {message}
            </p>
          ) : null}
        </div>

        <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-500">
          {uploading
            ? 'Uploading...'
            : buttonLabel}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={accept}
            disabled={uploading}
            onChange={handleUpload}
            className="hidden"
          />
        </label>
      </div>
    </div>
  )
}
