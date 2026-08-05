'use client'

import { useEffect } from 'react'
import { registerPushNotifications } from '@/lib/push/register'

export function usePushNotifications() {
  useEffect(() => {
    async function init() {
      try {
        const token =
          await registerPushNotifications()

        if (!token) return

        console.log(
          'Push Token:',
          token
        )

        // TODO:
        // Save token to Supabase here.
      } catch (err) {
        console.error(err)
      }
    }

    init()
  }, [])
}
