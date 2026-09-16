import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

type CreateProjectBody = {
  title?: string
  trade?: string
  location?: string
  description?: string
  bid_deadline?: string | null
  work_deadline?: string | null
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length).trim() || null
}

async function authenticateHomeowner(request: Request) {
  if (!supabaseAdmin || !authClient) {
    return {
      error: NextResponse.json(
        { error: 'Supabase authentication is not fully configured.' },
        { status: 500 }
      ),
      user: null,
    }
  }

  const token = getBearerToken(request)

  if (!token) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      ),
      user: null,
    }
  }

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token)

  if (userError || !user) {
    return {
      error: NextResponse.json(
        { error: 'Invalid or expired session.' },
        { status: 401 }
      ),
      user: null,
    }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return {
      error: NextResponse.json(
        { error: 'Unable to verify homeowner account.' },
        { status: 500 }
      ),
      user: null,
    }
  }

  if (!profile || profile.role !== 'homeowner') {
    return {
      error: NextResponse.json(
        { error: 'A CrewCall homeowner account is required.' },
        { status: 403 }
      ),
      user: null,
    }
  }

  return {
    error: null,
    user,
  }
}

export async function GET(request: Request) {
  try {
    const auth = await authenticateHomeowner(request)

    if (auth.error || !auth.user || !supabaseAdmin) {
      return auth.error || NextResponse.json({ error: 'Authentication failed.' }, { status: 401 })
    }

    const { data: projects, error } = await supabaseAdmin
      .from('jobs')
      .select(`
        id,
        title,
        trade,
        location,
        description,
        status,
        job_type,
        bid_deadline,
        work_deadline,
        created_at
      `)
      .eq('company_id', auth.user.id)
      .eq('job_type', 'bid_request')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    const projectIds = (projects || []).map((project) => project.id)

    const bidCounts = new Map<string, number>()

    if (projectIds.length > 0) {
      const { data: bids, error: bidsError } = await supabaseAdmin
        .from('job_bids')
        .select('job_id')
        .in('job_id', projectIds)

      if (bidsError) {
        return NextResponse.json(
          { error: bidsError.message },
          { status: 400 }
        )
      }

      for (const bid of bids || []) {
        bidCounts.set(
          bid.job_id,
          (bidCounts.get(bid.job_id) || 0) + 1
        )
      }
    }

    return NextResponse.json({
      success: true,
      projects: (projects || []).map((project) => ({
        ...project,
        bid_count: bidCounts.get(project.id) || 0,
      })),
    })
  } catch (error) {
    console.error('Get homeowner projects error:', error)

    return NextResponse.json(
      { error: 'Unable to load homeowner projects.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateHomeowner(request)

    if (auth.error || !auth.user || !supabaseAdmin) {
      return auth.error || NextResponse.json({ error: 'Authentication failed.' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as
      | CreateProjectBody
      | null

    if (!body) {
      return NextResponse.json(
        { error: 'Invalid request.' },
        { status: 400 }
      )
    }

    const title = String(body.title || '').trim()
    const trade = String(body.trade || '').trim()
    const location = String(body.location || '').trim()
    const description = String(body.description || '').trim()

    if (
      title.length < 2 ||
      trade.length < 2 ||
      location.length < 2 ||
      description.length < 6
    ) {
      return NextResponse.json(
        { error: 'Please complete all required project fields.' },
        { status: 400 }
      )
    }

    if (!body.bid_deadline) {
      return NextResponse.json(
        { error: 'Bid deadline is required.' },
        { status: 400 }
      )
    }

    const parsedBidDeadline = new Date(body.bid_deadline)

    if (
      Number.isNaN(parsedBidDeadline.getTime()) ||
      parsedBidDeadline.getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: 'Bid deadline must be in the future.' },
        { status: 400 }
      )
    }

    let workDeadline: string | null = null

    if (body.work_deadline) {
      const parsedWorkDeadline = new Date(body.work_deadline)

      if (Number.isNaN(parsedWorkDeadline.getTime())) {
        return NextResponse.json(
          { error: 'Project deadline is invalid.' },
          { status: 400 }
        )
      }

      workDeadline = parsedWorkDeadline.toISOString()
    }

    const { data: project, error: createError } = await supabaseAdmin
      .from('jobs')
      .insert({
        company_id: auth.user.id,
        title,
        trade,
        location,
        description,
        pay_rate: '',
        job_type: 'bid_request',
        status: 'open',
        bid_deadline: parsedBidDeadline.toISOString(),
        work_deadline: workDeadline,
      })
      .select('id')
      .single()

    if (createError) {
      console.error('Create homeowner project failed:', createError)

      return NextResponse.json(
        { error: 'Unable to post this project.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      id: project.id,
    })
  } catch (error) {
    console.error('Create homeowner project error:', error)

    return NextResponse.json(
      { error: 'Unable to post this project.' },
      { status: 500 }
    )
  }
}
