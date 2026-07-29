'use client'

import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const db = supabase as any

const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000
const TAB_LOCK_DURATION_MS = 90 * 1000
const STORAGE_KEY = 'crewcall-ai-recruiter-heartbeat'

type RecruitingJob = {
  id: string
  ai_recruiting: boolean | null
  ai_recruiting_complete: boolean | null
  ai_last_invite_at: string | null
  ai_next_action_at: string | null
  ai_attempt_count: number | null
  assigned_worker_id: string | null
  status: string | null
}

type AutoRecruitResponse = {
  success?: boolean
  invitedWorker?: {
    id: string
    name: string
  }
  message?: string
  error?: string
}

function normalizeStatus(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function getStoredHeartbeatTime() {
  if (typeof window === 'undefined') {
    return 0
  }

  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

function storeHeartbeatTime(value: number) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // localStorage may be unavailable in private browsing modes.
  }
}

export default function AIRecruiterHeartbeat() {
  const runningRef = useRef(false)

  const runHeartbeat = useCallback(async () => {
    if (runningRef.current) {
      return
    }

    if (
      typeof document !== 'undefined' &&
      document.visibilityState !== 'visible'
    ) {
      return
    }

    const now = Date.now()
    const previousHeartbeat = getStoredHeartbeatTime()

    if (now - previousHeartbeat < TAB_LOCK_DURATION_MS) {
      return
    }

    storeHeartbeatTime(now)
    runningRef.current = true

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.user) {
        return
      }

      const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('id, role')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profileError || !profile) {
        return
      }

      if (!['company', 'admin'].includes(String(profile.role || ''))) {
        return
      }

      let jobsQuery = db
        .from('jobs')
        .select(
          `
            id,
            ai_recruiting,
            ai_recruiting_complete,
            ai_last_invite_at,
            ai_next_action_at,
            ai_attempt_count,
            assigned_worker_id,
            status
          `,
        )
        .eq('ai_recruiting', true)
        .eq('ai_recruiting_complete', false)
        .is('assigned_worker_id', null)
        .order('ai_last_invite_at', {
          ascending: true,
          nullsFirst: true,
        })
        .limit(10)

      if (String(profile.role) !== 'admin') {
        jobsQuery = jobsQuery.eq('company_id', session.user.id)
      }

      const { data: jobsData, error: jobsError } = await jobsQuery

      if (jobsError) {
        console.error(
          'AI recruiter heartbeat could not load jobs:',
          jobsError,
        )
        return
      }

      const recruitingJobs = (jobsData || []) as RecruitingJob[]

      const eligibleJob = recruitingJobs.find((job) => {
        const status = normalizeStatus(job.status)

        const nextAction = job.ai_next_action_at
          ? new Date(job.ai_next_action_at).getTime()
          : 0

        const actionReady =
          !nextAction || Date.now() >= nextAction

        return (
          job.ai_recruiting === true &&
          job.ai_recruiting_complete !== true &&
          !job.assigned_worker_id &&
          actionReady &&
          ![
            'assigned',
            'in_progress',
            'completed',
            'closed',
            'cancelled',
            'canceled',
          ].includes(status)
        )
      })

      if (!eligibleJob) {
        return
      }

      const response = await fetch(
        `/api/jobs/${eligibleJob.id}/auto-recruit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'send_next',
          }),
        },
      )

      const payload = (await response
        .json()
        .catch(() => null)) as AutoRecruitResponse | null

      if (!response.ok) {
        const expectedMessages = [
          'wait',
          'delay',
          'not due',
          'no available',
          'complete',
          'already assigned',
          'not recruiting',
        ]

        const message = String(
          payload?.error || payload?.message || '',
        ).toLowerCase()

        const expectedResult = expectedMessages.some((phrase) =>
          message.includes(phrase),
        )

        if (!expectedResult) {
          console.error(
            'AI recruiter heartbeat failed:',
            payload?.error ||
              payload?.message ||
              `Request failed with status ${response.status}`,
          )
        }

        return
      }

      if (payload?.invitedWorker) {
        console.info(
          `CrewCall AI Recruiter invited ${payload.invitedWorker.name}.`,
        )

        window.dispatchEvent(
          new CustomEvent('crewcall-ai-recruiter-advanced', {
            detail: {
              jobId: eligibleJob.id,
              worker: payload.invitedWorker,
            },
          }),
        )
      }
    } catch (error) {
      console.error('AI recruiter heartbeat error:', error)
    } finally {
      runningRef.current = false
    }
  }, [])

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void runHeartbeat()
    }, 2500)

    const interval = window.setInterval(() => {
      void runHeartbeat()
    }, HEARTBEAT_INTERVAL_MS)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runHeartbeat()
      }
    }

    const handleFocus = () => {
      void runHeartbeat()
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )
    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(interval)

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
      window.removeEventListener('focus', handleFocus)
    }
  }, [runHeartbeat])

  return null
}
