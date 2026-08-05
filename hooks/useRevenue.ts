'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useRevenue() {
  const [total, setTotal] = useState(0)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('jobs')
        .select('worker_payout_amount,payment_status')

      if (error) {
        console.error(error)
        return
      }

      const revenue = (data ?? [])
        .filter(job => job.payment_status === 'paid')
        .reduce(
          (sum, job) => sum + Number(job.worker_payout_amount ?? 0),
          0
        )

      setTotal(revenue)
    }

    load()
  }, [])

  return total
}
