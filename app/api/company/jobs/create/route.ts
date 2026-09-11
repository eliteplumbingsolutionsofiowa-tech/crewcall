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

type CreateJobBody = {
  title?: string
  trade?: string
  location?: string
  pay_rate?: string
  description?: string
  job_type?: 'worker_job' | 'bid_request'
  bid_deadline?: string | null
  work_deadline?: string | null
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

    const companyId =
      companyContext.companyId ||
      (companyContext.isPlatformAdmin ? user.id : null)

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company access required.' },
        { status: 403 }
      )
    }

    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from('profiles')
        .select('first_job_used_at')
        .eq('id', companyId)
        .maybeSingle()

    if (profileError) {
      console.error(
        'Posting eligibility profile lookup failed:',
        profileError
      )

      return NextResponse.json(
        { error: 'Unable to check posting access.' },
        { status: 500 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'Company profile not found.' },
        { status: 404 }
      )
    }

    const { data: subscriptions, error: subscriptionError } =
      await supabaseAdmin
        .from('subscriptions')
        .select(
          'plan, status, stripe_subscription_id'
        )
        .eq('user_id', companyId)
        .eq('plan', 'founding_member')

    if (subscriptionError) {
      console.error(
        'Posting eligibility subscription lookup failed:',
        subscriptionError
      )

      return NextResponse.json(
        { error: 'Unable to check posting access.' },
        { status: 500 }
      )
    }

    const membershipActive = Boolean(
      subscriptions?.some(
        (subscription) =>
          Boolean(subscription.stripe_subscription_id) &&
          (subscription.status === 'active' ||
            subscription.status === 'trialing')
      )
    )

    const firstJobUsedAt =
      profile.first_job_used_at || null

    const firstJobAvailable = !firstJobUsedAt

    const canPost =
      companyContext.isPlatformAdmin ||
      firstJobAvailable ||
      membershipActive

    return NextResponse.json({
      success: true,
      canPost,
      firstJobAvailable,
      membershipActive,
      firstJobUsedAt,
      isPlatformAdmin:
        companyContext.isPlatformAdmin,
    })
  } catch (error) {
    console.error(
      'Posting eligibility API error:',
      error
    )

    return NextResponse.json(
      { error: 'Unable to check posting access.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
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

    const companyId =
      companyContext.companyId ||
      (companyContext.isPlatformAdmin ? user.id : null)

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company access required.' },
        { status: 403 }
      )
    }

    const body = (await request.json()) as CreateJobBody

    const title = String(body.title || '').trim()
    const trade = String(body.trade || '').trim()
    const location = String(body.location || '').trim()
    const payRate = String(body.pay_rate || '').trim()
    const description = String(body.description || '').trim()
    const jobType =
      body.job_type === 'bid_request'
        ? 'bid_request'
        : 'worker_job'

    if (
      title.length < 2 ||
      trade.length < 2 ||
      location.length < 2 ||
      description.length < 6
    ) {
      return NextResponse.json(
        { error: 'Please complete all required job fields.' },
        { status: 400 }
      )
    }

    if (jobType === 'worker_job' && !payRate) {
      return NextResponse.json(
        { error: 'Pay rate is required.' },
        { status: 400 }
      )
    }

    let bidDeadline: string | null = null

    if (jobType === 'bid_request') {
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

      bidDeadline = parsedBidDeadline.toISOString()
    }

    const workDeadline =
      jobType === 'bid_request' && body.work_deadline
        ? String(body.work_deadline).trim()
        : null

    const { data: jobId, error: createError } =
      await supabaseAdmin.rpc(
        'create_company_job_with_entitlement',
        {
          p_company_id: companyId,
          p_title: title,
          p_trade: trade,
          p_location: location,
          p_pay_rate: jobType === 'bid_request' ? '' : payRate,
          p_description: description,
          p_job_type: jobType,
          p_bid_deadline: bidDeadline,
          p_work_deadline: workDeadline,
          p_bypass_membership: companyContext.isPlatformAdmin,
        }
      )

    if (createError) {
      const message = createError.message || ''

      if (message.includes('COMPANY_MEMBERSHIP_REQUIRED')) {
        return NextResponse.json(
          {
            error:
              'Your first CrewCall job was free. Upgrade your company membership to post another job.',
            code: 'COMPANY_MEMBERSHIP_REQUIRED',
          },
          { status: 402 }
        )
      }

      if (message.includes('COMPANY_PROFILE_NOT_FOUND')) {
        return NextResponse.json(
          { error: 'Company profile not found.' },
          { status: 404 }
        )
      }

      console.error('Create company job RPC failed:', createError)

      return NextResponse.json(
        { error: 'Unable to post this job.' },
        { status: 500 }
      )
    }

    if (!jobId) {
      return NextResponse.json(
        { error: 'CrewCall did not return a job ID.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      id: jobId,
    })
  } catch (error) {
    console.error('Create company job API error:', error)

    return NextResponse.json(
      { error: 'Unable to post this job.' },
      { status: 500 }
    )
  }
}
