import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  )
}

const globalForSupabase = globalThis as unknown as {
  supabase?: ReturnType<typeof createClient<Database>>
}

export const supabase =
  globalForSupabase.supabase ??
  createClient<Database>(supabaseUrl, supabaseAnonKey, {
    realtime: {
      params: {
        eventsPerSecond: 5,
      },
    },

    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },

    global: {
      headers: {
        'x-application-name': 'crewcall',
      },
    },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabase = supabase
}