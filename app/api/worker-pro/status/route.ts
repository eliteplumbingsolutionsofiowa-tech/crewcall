import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error('Missing required Supabase environment variables.')
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  const token = authorization.slice('Bearer '.length).trim()
  return token || null
}

export async function GET(request: Request) {
  try {
    const accessToken = getBearerToken(request)

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authorization token required.' },
        { status: 401 }
      )
    }

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unable to verify the authenticated user.' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const workerId = url.searchParams.get('workerId')?.trim()

    if (!workerId) {
      return NextResponse.json(
        { error: 'Worker ID required.' },
        { status: 400 }
      )
    }

    const { data: worker, error: workerError } = await adminClient
      .from('profiles')
      .select('id,role')
      .eq('id', workerId)
      .maybeSingle()

    if (workerError) {
      throw workerError
    }

    if (!worker || worker.role !== 'worker') {
      return NextResponse.json({ isWorkerPro: false })
    }

    const { data: subscription, error: subscriptionError } =
      await adminClient
        .from('subscriptions')
        .select('plan,status')
        .eq('user_id', workerId)
        .maybeSingle()

    if (subscriptionError) {
      throw subscriptionError
    }

    const isWorkerPro =
      subscription?.plan === 'worker_pro' &&
      ['active', 'trialing', 'past_due'].includes(
        subscription.status || ''
      )

    return NextResponse.json({ isWorkerPro })
  } catch (error) {
    console.error('Worker Pro status lookup failed:', error)

    return NextResponse.json(
      { error: 'Unable to load Worker Pro status.' },
      { status: 500 }
    )
  }
}
