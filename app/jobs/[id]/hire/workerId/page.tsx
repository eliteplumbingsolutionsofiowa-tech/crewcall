'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HireWorkerPage() {
  const params = useParams()
  const router = useRouter()

  const jobId = params.id as string
  const workerId = params.workerId as string

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Hiring worker...')

  useEffect(() => {
    hireWorker()
  }, [])

  async function hireWorker() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage('You must be logged in.')
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('jobs')
      .update({
        worker_id: workerId,
        status: 'assigned',
      })
      .eq('id', jobId)
      .eq('company_id', user.id)

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setMessage('Worker hired successfully.')

    setTimeout(() => {
      router.push(`/jobs/${jobId}`)
    }, 1000)
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">Hire Worker</h1>

        <p className="mt-4 text-gray-700">
          {loading ? 'Please wait...' : message}
        </p>
      </div>
    </main>
  )
}