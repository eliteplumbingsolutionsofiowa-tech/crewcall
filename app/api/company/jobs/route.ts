import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveCompanyContext } from '@/lib/company-context'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null

const authClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length).trim()
}

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin || !authClient) {
      return NextResponse.json(
        { error: 'Supabase authentication is not fully configured.' },
        { status: 500 }
      )
    }

    const token = getBearerToken(request)

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      )
    }

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session.' },
        { status: 401 }
      )
    }

    const companyContext = await resolveCompanyContext(
      supabaseAdmin,
      user.id
    )

    if (!companyContext.companyId) {
      return NextResponse.json(
        { error: 'Company access required.' },
        { status: 403 }
      )
    }

    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from('jobs')
      .select(`
        id,
        title,
        description,
        trade,
        location,
        pay_rate,
        start_date,
        status,
        payment_status,
        payout_status,
        company_id,
        assigned_worker_id,
        completion_status,
        completion_submitted_at,
        created_at
      `)
      .eq('company_id', companyContext.companyId)
      .order('created_at', { ascending: false })

    if (jobsError) {
      return NextResponse.json(
        { error: jobsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      companyId: companyContext.companyId,
      jobs: jobs || [],
    })
  } catch (error) {
    console.error('Company jobs API error:', error)

    return NextResponse.json(
      { error: 'Unable to load company jobs.' },
      { status: 500 }
    )
  }
}
