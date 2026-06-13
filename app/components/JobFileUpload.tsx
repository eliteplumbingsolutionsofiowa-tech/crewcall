'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  jobId: string
  userId: string
  onUploadComplete?: () => void
}

type JobFileInsert = {
  job_id: string
  uploaded_by: string
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

function jobFilesTable() {
  return supabase.from('job_files') as unknown as InsertTable<JobFileInsert>
}

export default function JobFileUpload({
  jobId,
  userId,
  onUploadComplete,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files ?? [])

    if (files.length === 0) return

    setUploading(true)
    setMessage(null)

    try {
      for (const file of files) {
        const extension = file.name.split('.').pop() || 'file'

        const safeName = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-zA-Z0-9-_]/g, '-')
          .toLowerCase()

        const filePath = `${jobId}/${userId}/${Date.now()}-${safeName}.${extension}`

        const { error: uploadError } = await supabase.storage
          .from('job-files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
          })

        if (uploadError) {
          throw new Error(uploadError.message)
        }

        const { data } = supabase.storage
          .from('job-files')
          .getPublicUrl(filePath)

        const { error: insertError } = await jobFilesTable().insert({
          job_id: jobId,
          uploaded_by: userId,
          file_name: file.name,
          file_url: data.publicUrl,
          file_type: file.type || extension,
        })

        if (insertError) {
          throw new Error(insertError.message)
        }
      }

      setMessage('File uploaded successfully.')

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
            Job Attachments
          </h3>

          <p className="mt-1 text-sm font-bold text-slate-500">
            Upload plans, photos, specs, paperwork, or
            job-related documents.
          </p>

          {message && (
            <p className="mt-3 text-sm font-bold text-blue-700">
              {message}
            </p>
          )}
        </div>

        <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-500">
          {uploading ? 'Uploading...' : 'Upload Files'}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            disabled={uploading}
            onChange={handleUpload}
            className="hidden"
          />
        </label>
      </div>
    </div>
  )
}