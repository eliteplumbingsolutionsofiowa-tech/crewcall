'use client'

import { supabase } from '@/lib/supabase'

export async function crewCallAuthedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  if (!session?.access_token) {
    throw new Error('Authentication required.')
  }

  const headers =
    new Headers(init.headers || {})

  if (!headers.has('Authorization')) {
    headers.set(
      'Authorization',
      `Bearer ${session.access_token}`
    )
  }

  return fetch(input, {
    ...init,
    headers,
  })
}
