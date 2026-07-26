import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getEnv(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Missing ${name}`)
  }

  return value
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || ''

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null
  }

  return authorization.slice(7).trim() || null
}

export async function POST(request: Request) {
  try {
    const accessToken = getBearerToken(request)

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 },
      )
    }

    const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    const cronSecret = getEnv('CRON_SECRET')

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired session.' },
        { status: 401 },
      )
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error(
        'AI recruiter heartbeat profile error:',
        profileError,
      )

      return NextResponse.json(
        {
          success: false,
          error: 'Could not verify your CrewCall account.',
        },
        { status: 500 },
      )
    }

    if (
      !profile ||
      !['company', 'admin'].includes(String(profile.role || ''))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Company or admin access required.',
        },
        { status: 403 },
      )
    }

    const cronUrl = new URL(
      '/api/cron/auto-recruit',
      request.url,
    )

    const cronResponse = await fetch(cronUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
      cache: 'no-store',
    })

    const cronPayload = await cronResponse
      .json()
      .catch(() => null)

    if (!cronResponse.ok) {
      console.error(
        'AI recruiter heartbeat processor error:',
        cronPayload,
      )

      return NextResponse.json(
        {
          success: false,
          error:
            cronPayload?.error ||
            'AI recruiting could not be processed.',
        },
        { status: cronResponse.status },
      )
    }

    return NextResponse.json({
      success: true,
      processedAt: new Date().toISOString(),
      result: cronPayload,
    })
  } catch (error) {
    console.error('AI recruiter heartbeat error:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'AI recruiter heartbeat failed.',
      },
      { status: 500 },
    )
  }
}
