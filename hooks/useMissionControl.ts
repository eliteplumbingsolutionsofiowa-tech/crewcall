'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type MissionControlData = {
  workers: number
  companies: number
  openJobs: number
  activeJobs: number
  completedJobs: number
  paidJobs: number
  loading: boolean
}

export function useMissionControl() {
  const [data, setData] = useState<MissionControlData>({
    workers: 0,
    companies: 0,
    openJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    paidJobs: 0,
    loading: true,
  })

  useEffect(() => {
    async function load() {
      const [profilesResult, jobsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('role'),

        supabase
          .from('jobs')
          .select('status,payment_status'),
      ])

      const profiles = profilesResult.data ?? []
      const jobs = jobsResult.data ?? []

      setData({
        workers: profiles.filter(p => p.role === 'worker').length,
        companies: profiles.filter(p => p.role === 'company').length,
        openJobs: jobs.filter(j => j.status === 'open').length,
        activeJobs: jobs.filter(j => j.status === 'in_progress').length,
        completedJobs: jobs.filter(j => j.status === 'completed').length,
        paidJobs: jobs.filter(j => j.payment_status === 'paid').length,
        loading: false,
      })
    }

    load()
  }, [])

  return data
}
