'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type DocumentColumn =
  | 'insurance_document_url'
  | 'license_document_url'
  | 'certification_document_url'
  | 'liability_form_url'

type DocumentUploadProps = {
  label: string
  description?: string
  column: DocumentColumn | string
  bucket?: string
  accept?: string
  onUploaded?: () => void
}

type QueryError = {
  message: string
}

type DocumentUpdate = Record<string, string>

type UpdateEqQuery = {
  eq: (
    column: string,
    value: string
  ) => Promise<{ data: null; error: QueryError | null }>
}

type UpdateTable<TUpdate> = {
  update: (value: TUpdate) => UpdateEqQuery
}

function profilesUpdateTable() {
  return supabase.from('profiles') as unknown as UpdateTable<DocumentUpdate>
}

export default function DocumentUpload({
  label,
  description = '',
  column,
  bucket = 'profile-files',
  accept = '.pdf,.png,.jpg,.jpeg,.webp',
  onUploaded,
}: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) return

    setUploading(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('Please log in before uploading documents.')
      setUploading(false)
      return
    }

    const fileExt = file.name.split('.').pop() || 'file'

    const cleanName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .toLowerCase()

    const filePath = `${user.id}/${column}/${Date.now()}-${cleanName}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      setMessage(uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)

    const { error: updateError } = await profilesUpdateTable()
      .update({
        [column]: data.publicUrl,
      })
      .eq('id', user.id)

    if (updateError) {
      setMessage(updateError.message)
      setUploading(false)
      return
    }

    setMessage('Document uploaded successfully.')
    setUploading(false)

    onUploaded?.()

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-black text-slate-950">{label}</h3>

          {description && (
            <p className="mt-1 text-sm font-bold text-slate-500">
              {description}
            </p>
          )}

          {message && (
            <p className="mt-3 text-sm font-bold text-blue-700">{message}</p>
          )}
        </div>

        <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-500">
          {uploading ? 'Uploading...' : 'Upload'}

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            disabled={uploading}
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>
    </div>
  )
}