'use client'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  useParams,
  useRouter,
} from 'next/navigation'

import { supabase } from '@/lib/supabase'
import { CrewButton } from '@/app/components/CrewButton'
import { CrewCard } from '@/app/components/CrewCard'

type Job = {
  id: string
  title: string
  trade: string | null
  location: string | null
  status: string | null
}

type Worker = {
  id: string
  full_name: string | null
  trade: string | null
}

export default function InviteWorkerPage() {
  const params = useParams()
  const router = useRouter()

  const workerId = String(params?.id || '')

  const [worker, setWorker] =
    useState<Worker | null>(null)

  const [jobs, setJobs] =
    useState<Job[]>([])

  const [selectedJobId, setSelectedJobId] =
    useState('')

  const [loading, setLoading] =
    useState(true)

  const [sending, setSending] =
    useState(false)

  const [message, setMessage] =
    useState<string | null>(null)

  const [success, setSuccess] =
    useState(false)


  const loadPage = useCallback(async () => {
    setLoading(true)
    setMessage(null)

    const {
      data: {
        user,
      },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage(
        'You must be logged in.'
      )
      setLoading(false)
      return
    }


    const {
      data: workerData,
      error: workerError,
    } = await supabase
      .from('profiles')
      .select(
        'id, full_name, trade'
      )
      .eq('id', workerId)
      .maybeSingle()


    if (workerError) {
      setMessage(
        workerError.message
      )
      setLoading(false)
      return
    }


    const {
      data: jobData,
      error: jobsError,
    } = await supabase
      .from('jobs')
      .select(
        `
        id,
        title,
        trade,
        location,
        status
        `
      )
      .eq(
        'company_id',
        user.id
      )
      .in(
        'status',
        [
          'open',
          'assigned',
          'in_progress',
        ]
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      )


    if (jobsError) {
      setMessage(
        jobsError.message
      )
      setLoading(false)
      return
    }


    const safeJobs =
      (jobData || []) as Job[]


    setWorker(
      workerData as Worker | null
    )

    setJobs(
      safeJobs
    )

    setSelectedJobId(
      safeJobs[0]?.id || ''
    )

    setLoading(false)

  }, [workerId])


  useEffect(() => {
    loadPage()
  }, [loadPage])


  async function sendInvite() {
    setSending(true)
    setMessage(null)
    setSuccess(false)

    try {

      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession()


      if (!session?.access_token) {
        setMessage(
          'You must be logged in.'
        )
        return
      }


      if (!selectedJobId) {
        setMessage(
          'Select a job first.'
        )
        return
      }


      const response =
        await fetch(
          `/api/jobs/${selectedJobId}/invite`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body: JSON.stringify({
              workerId,
            }),
          }
        )


      const result =
        await response.json()


      if (!response.ok) {
        setMessage(
          result?.error ||
          'Unable to send invite.'
        )
        return
      }


      setSuccess(true)


      window.dispatchEvent(
        new Event(
          'crewcall-refresh-nav'
        )
      )


      setTimeout(() => {
        router.push(
          '/company/invites'
        )
      }, 800)


    } catch (error) {

      console.error(
        'Invite error:',
        error
      )

      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to send invite.'
      )

    } finally {
      setSending(false)
    }
  }


  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
        <p className="text-slate-300">
          Loading invite page...
        </p>
      </main>
    )
  }


  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-8 text-white">

      <div className="mx-auto max-w-3xl space-y-6">

        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
            CrewCall
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Invite Worker
          </h1>

          <p className="mt-3 text-slate-300">
            Invite{' '}
            <span className="font-black text-white">
              {worker?.full_name || 'this worker'}
            </span>
            {' '}
            to one of your active jobs.
          </p>
        </div>


        <CrewCard className="space-y-6 !border-white/10 !bg-slate-900/80 shadow-2xl">

          <div className="rounded-2xl border border-cyan-400/20 bg-slate-950/70 p-5">

            <h2 className="text-2xl font-black text-white">
              {worker?.full_name || 'Worker'}
            </h2>

            <p className="mt-1 font-bold text-cyan-300">
              {worker?.trade || 'Trade not listed'}
            </p>

          </div>


          {jobs.length === 0 ? (

            <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 font-bold text-yellow-100">
              You do not have any open jobs to invite this worker to.
            </div>

          ) : (

            <div className="space-y-3">

              <label className="text-sm font-black text-slate-200">
                Select Job
              </label>


              <select
                value={selectedJobId}
                onChange={(e) =>
                  setSelectedJobId(
                    e.target.value
                  )
                }
                className="
                  w-full rounded-2xl
                  border border-cyan-400/20
                  bg-slate-950
                  px-4 py-3
                  font-bold text-white
                  outline-none
                  focus:border-cyan-300
                "
              >

                {jobs.map((job) => (

                  <option
                    key={job.id}
                    value={job.id}
                  >
                    {job.title}
                    {' - '}
                    {job.location || 'No location'}
                  </option>

                ))}

              </select>

            </div>

          )}


          {message && (

            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 font-bold text-red-100">
              {message}
            </div>

          )}


          {success && (

            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 font-bold text-emerald-100">
              Invite sent successfully.
            </div>

          )}


          <div className="flex flex-wrap gap-3">

            <CrewButton
              onClick={sendInvite}
              disabled={
                sending ||
                jobs.length === 0
              }
            >
              {
                sending
                  ? 'Sending...'
                  : 'Send Invite'
              }
            </CrewButton>


            <CrewButton
              href="/workers"
              variant="ghost"
              className="!text-white hover:!text-cyan-300"
            >
              Back to Workers
            </CrewButton>

          </div>


        </CrewCard>

      </div>

    </main>
  )
}