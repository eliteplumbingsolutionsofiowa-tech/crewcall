'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DocumentUpload({
  label,
  column,
}: {
  label: string
  column: 'insurance_url' | 'license_url' | 'liability_form_url'
}) {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMessage(null)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const user = session?.user
    if (!user) {
      setMessage('Not logged in')
      setUploading(false)
      return
    }

    const filePath = `${user.id}/${column}-${Date.now()}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file)

    if (uploadError) {
      setMessage(uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    const { error } = await supabase
      .from('profiles')
      .update({
        [column]: data.publicUrl,
      })
      .eq('id', user.id)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Uploaded')
    }

    setUploading(false)
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="text-sm font-semibold">{label}</div>

      <input
        type="file"
        onChange={handleUpload}
        className="mt-2 text-sm"
      />

      {uploading && <div className="text-sm mt-2">Uploading...</div>}
      {message && <div className="text-sm mt-2 text-blue-600">{message}</div>}
    </div>
  )
}