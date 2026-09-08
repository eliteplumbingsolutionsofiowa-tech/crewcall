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

const MAX_AVAILABILITY_LENGTH = 500
const MAX_DURATION_LENGTH = 250
const MAX_NOTE_LENGTH = 4_000
const MAX_BID_CENTS = 1_000_000_000_00

type BidRequest = {
  jobId?: string
  amount?: number | string
  amountCents?: number
  availability?: string | null
  estimatedDuration?: string | null
  note?: string | null
}

async function notifyCompany({
  companyId,
  type,
  title,
  body,
  jobId,
  extraUserIds = [],
}: {
  companyId: string
  type: string
  title: string
  body: string
  jobId: string
  extraUserIds?: string[]
}) {
  if (!supabaseAdmin) return

  try {
    const { data: teamMembers, error: teamError } =
      await supabaseAdmin
        .from('company_team_members')
        .select('user_id')
        .eq('company_id', companyId)
        .eq('status', 'joined')

    if (teamError) {
      console.error(
        'Unable to load company notification recipients:',
        teamError
      )
    }

    const recipientIds = Array.from(
      new Set(
        [
          companyId,
          ...(teamMembers || []).map(
            (member) => member.user_id
          ),
          ...extraUserIds,
        ].filter(
          (userId): userId is string =>
            typeof userId === 'string' &&
            userId.length > 0
        )
      )
    )

    if (recipientIds.length === 0) return

    const now = new Date().toISOString()
    const linkUrl = `/jobs/${jobId}#bids`

    const notifications = recipientIds.map(
      (userId) => ({
        user_id: userId,
        type,
        title,
        body,
        message: body,
        job_id: jobId,
        link_url: linkUrl,
        is_read: false,
        read: false,
        created_at: now,
      })
    )

    const { error: notificationError } =
      await supabaseAdmin
        .from('notifications')
        .insert(notifications as never)

    if (notificationError) {
      console.error(
        'Unable to create bid notification:',
        notificationError
      )
    }
  } catch (notificationError) {
    console.error(
      'Bid notification delivery failed:',
      notificationError
    )
  }
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length).trim() || null
}

function optionalString(
  value: unknown,
  maxLength: number
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  return trimmed.slice(0, maxLength)
}

function parseAmountCents(payload: BidRequest) {
  if (
    typeof payload.amountCents === 'number' &&
    Number.isSafeInteger(payload.amountCents)
  ) {
    return payload.amountCents
  }

  const raw =
    typeof payload.amount === 'number'
      ? payload.amount
      : Number(
          String(payload.amount ?? '')
            .replace(/[$,\s]/g, '')
        )

  if (!Number.isFinite(raw)) {
    return null
  }

  return Math.round(raw * 100)
}

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin || !authClient) {
      return NextResponse.json(
        {
          error:
            'Supabase authentication is not fully configured.',
        },
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

    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')?.trim() || ''
    const mine = url.searchParams.get('mine') === '1'

    const companyContext = await resolveCompanyContext(
      supabaseAdmin,
      user.id
    )

    if (!companyContext.companyId) {
      return NextResponse.json(
        {
          error:
            'A CrewCall company account is required to view contractor bids.',
        },
        { status: 403 }
      )
    }

    if (mine) {
      const { data: myBids, error: myBidsError } =
        await supabaseAdmin
          .from('job_bids')
          .select(`
            id,
            job_id,
            company_id,
            submitted_by,
            amount_cents,
            availability,
            estimated_duration,
            note,
            status,
            created_at,
            updated_at
          `)
          .eq('company_id', companyContext.companyId)
          .order('created_at', { ascending: false })

      if (myBidsError) {
        return NextResponse.json(
          { error: myBidsError.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        role: 'bidder',
        bids: myBids || [],
      })
    }

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing job ID.' },
        { status: 400 }
      )
    }

    const { data: job, error: jobError } =
      await supabaseAdmin
        .from('jobs')
        .select('id, company_id, job_type, status, bid_deadline')
        .eq('id', jobId)
        .maybeSingle()

    if (jobError) {
      return NextResponse.json(
        { error: jobError.message },
        { status: 400 }
      )
    }

    if (!job) {
      return NextResponse.json(
        { error: 'Project not found.' },
        { status: 404 }
      )
    }

    if (job.job_type !== 'bid_request') {
      return NextResponse.json(
        { error: 'This project is not a bid request.' },
        { status: 400 }
      )
    }

    const isProjectCompany =
      job.company_id === companyContext.companyId

    let query = supabaseAdmin
      .from('job_bids')
      .select(`
        id,
        job_id,
        company_id,
        submitted_by,
        amount_cents,
        availability,
        estimated_duration,
        note,
        status,
        created_at,
        updated_at
      `)
      .eq('job_id', jobId)
      .order('amount_cents', { ascending: true })
      .order('created_at', { ascending: true })

    if (!isProjectCompany) {
      query = query.eq(
        'company_id',
        companyContext.companyId
      )
    }

    const { data: rawBids, error: bidsError } = await query

    if (bidsError) {
      return NextResponse.json(
        { error: bidsError.message },
        { status: 400 }
      )
    }

    const bids = rawBids || []

    const companyIds = Array.from(
      new Set(
        bids
          .map((bid) => bid.company_id)
          .filter(
            (companyId): companyId is string =>
              typeof companyId === 'string' &&
              companyId.length > 0
          )
      )
    )

    let companyProfiles: Array<{
      id: string
      company_name: string | null
      full_name: string | null
      trade: string | null
      city: string | null
      state: string | null
      company_verified: boolean | null
      insurance_verified: boolean | null
      rating_average: number | null
      rating_count: number | null
    }> = []

    if (companyIds.length > 0) {
      const {
        data: profileRows,
        error: profileError,
      } = await supabaseAdmin
        .from('profiles')
        .select(`
          id,
          company_name,
          full_name,
          trade,
          city,
          state,
          company_verified,
          insurance_verified,
          rating_average,
          rating_count
        `)
        .in('id', companyIds)

      if (profileError) {
        return NextResponse.json(
          { error: profileError.message },
          { status: 400 }
        )
      }

      companyProfiles = profileRows || []
    }

    const profileByCompanyId = new Map(
      companyProfiles.map((profile) => [
        profile.id,
        profile,
      ])
    )

    const visibleBids = bids.map((bid) => ({
      ...bid,
      company:
        profileByCompanyId.get(bid.company_id) || null,
    }))

    return NextResponse.json({
      success: true,
      role: isProjectCompany ? 'project_owner' : 'bidder',
      canManage:
        isProjectCompany &&
        (
          companyContext.isPlatformAdmin ||
          companyContext.isCompanyOwner ||
          (
            companyContext.isTeamMember &&
            companyContext.teamRole === 'admin'
          )
        ),
      job: {
        id: job.id,
        status: job.status,
        bidDeadline: job.bid_deadline,
      },
      bids: visibleBids,
    })
  } catch (error) {
    console.error('Get job bids error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load bids.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin || !authClient) {
      return NextResponse.json(
        {
          error:
            'Supabase authentication is not fully configured.',
        },
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

    const payload =
      (await request.json().catch(() => null)) as
        | BidRequest
        | null

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid request.' },
        { status: 400 }
      )
    }

    const jobId =
      typeof payload.jobId === 'string'
        ? payload.jobId.trim()
        : ''

    const amountCents = parseAmountCents(payload)

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing job ID.' },
        { status: 400 }
      )
    }

    if (
      amountCents === null ||
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0 ||
      amountCents > MAX_BID_CENTS
    ) {
      return NextResponse.json(
        { error: 'Enter a valid bid amount.' },
        { status: 400 }
      )
    }

    const companyContext = await resolveCompanyContext(
      supabaseAdmin,
      user.id
    )

    if (!companyContext.companyId) {
      return NextResponse.json(
        {
          error:
            'A CrewCall company account is required to submit a bid.',
        },
        { status: 403 }
      )
    }

    const { data: job, error: jobError } =
      await supabaseAdmin
        .from('jobs')
        .select(
          'id, company_id, job_type, status, bid_deadline'
        )
        .eq('id', jobId)
        .maybeSingle()

    if (jobError) {
      return NextResponse.json(
        { error: jobError.message },
        { status: 400 }
      )
    }

    if (!job) {
      return NextResponse.json(
        { error: 'Project not found.' },
        { status: 404 }
      )
    }

    if (job.job_type !== 'bid_request') {
      return NextResponse.json(
        {
          error:
            'This CrewCall job is not accepting contractor bids.',
        },
        { status: 400 }
      )
    }

    if (job.status !== 'open') {
      return NextResponse.json(
        {
          error:
            'This project is no longer accepting bids.',
        },
        { status: 409 }
      )
    }

    if (
      job.company_id === companyContext.companyId
    ) {
      return NextResponse.json(
        {
          error:
            'Your company cannot bid on its own project.',
        },
        { status: 403 }
      )
    }

    if (
      job.bid_deadline &&
      new Date(job.bid_deadline).getTime() < Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            'The bidding deadline for this project has passed.',
        },
        { status: 409 }
      )
    }

    const {
      data: acceptedProjectBid,
      error: acceptedProjectBidError,
    } = await supabaseAdmin
      .from('job_bids')
      .select('id')
      .eq('job_id', job.id)
      .eq('status', 'accepted')
      .maybeSingle()

    if (acceptedProjectBidError) {
      return NextResponse.json(
        { error: acceptedProjectBidError.message },
        { status: 400 }
      )
    }

    if (acceptedProjectBid) {
      return NextResponse.json(
        {
          error:
            'This project already has an accepted bid and is no longer accepting bids.',
        },
        { status: 409 }
      )
    }

    const { data: existingBid, error: existingError } =
      await supabaseAdmin
        .from('job_bids')
        .select('id, status')
        .eq('job_id', jobId)
        .eq('company_id', companyContext.companyId)
        .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 400 }
      )
    }

    if (existingBid) {
      return NextResponse.json(
        {
          error:
            existingBid.status === 'withdrawn'
              ? 'Your company already has a withdrawn bid for this project.'
              : 'Your company has already submitted a bid for this project.',
          bidId: existingBid.id,
        },
        { status: 409 }
      )
    }

    const availability = optionalString(
      payload.availability,
      MAX_AVAILABILITY_LENGTH
    )

    const estimatedDuration = optionalString(
      payload.estimatedDuration,
      MAX_DURATION_LENGTH
    )

    const note = optionalString(
      payload.note,
      MAX_NOTE_LENGTH
    )

    const { data: bid, error: bidError } =
      await supabaseAdmin
        .from('job_bids')
        .insert({
          job_id: jobId,
          company_id: companyContext.companyId,
          submitted_by: user.id,
          amount_cents: amountCents,
          availability,
          estimated_duration: estimatedDuration,
          note,
          status: 'pending',
        })
        .select(
          `
            id,
            job_id,
            company_id,
            submitted_by,
            amount_cents,
            availability,
            estimated_duration,
            note,
            status,
            created_at
          `
        )
        .single()

    if (bidError) {
      if (bidError.code === '23505') {
        return NextResponse.json(
          {
            error:
              'Your company has already submitted a bid for this project.',
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: bidError.message },
        { status: 400 }
      )
    }

    const { data: bidderProfile } =
      await supabaseAdmin
        .from('profiles')
        .select('company_name, full_name')
        .eq('id', companyContext.companyId)
        .maybeSingle()

    const bidderName =
      bidderProfile?.company_name ||
      bidderProfile?.full_name ||
      'A contractor'

    await notifyCompany({
      companyId: job.company_id,
      type: 'job_bid_received',
      title: 'New contractor bid',
      body: `${bidderName} submitted a bid on your project.`,
      jobId: job.id,
    })

    return NextResponse.json(
      {
        success: true,
        bid,
        message: 'Bid submitted successfully.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Submit job bid error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to submit bid.',
      },
      { status: 500 }
    )
  }
}


type BidActionRequest = BidRequest & {
  bidId?: string
  action?: 'edit' | 'withdraw' | 'accept' | 'decline'
}

export async function PATCH(request: Request) {
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

    const payload =
      (await request.json().catch(() => null)) as
        | BidActionRequest
        | null

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid request.' },
        { status: 400 }
      )
    }

    const bidId =
      typeof payload.bidId === 'string'
        ? payload.bidId.trim()
        : ''

    const action = payload.action

    if (!bidId || !action) {
      return NextResponse.json(
        { error: 'Bid ID and action are required.' },
        { status: 400 }
      )
    }

    if (
      action !== 'edit' &&
      action !== 'withdraw' &&
      action !== 'accept' &&
      action !== 'decline'
    ) {
      return NextResponse.json(
        { error: 'Invalid bid action.' },
        { status: 400 }
      )
    }

    const companyContext = await resolveCompanyContext(
      supabaseAdmin,
      user.id
    )

    if (!companyContext.companyId) {
      return NextResponse.json(
        { error: 'A CrewCall company account is required.' },
        { status: 403 }
      )
    }

    const { data: bid, error: bidError } =
      await supabaseAdmin
        .from('job_bids')
        .select(`
          id,
          job_id,
          company_id,
          submitted_by,
          status
        `)
        .eq('id', bidId)
        .maybeSingle()

    if (bidError) {
      return NextResponse.json(
        { error: bidError.message },
        { status: 400 }
      )
    }

    if (!bid) {
      return NextResponse.json(
        { error: 'Bid not found.' },
        { status: 404 }
      )
    }

    const { data: job, error: jobError } =
      await supabaseAdmin
        .from('jobs')
        .select(`
          id,
          company_id,
          job_type,
          status,
          bid_deadline
        `)
        .eq('id', bid.job_id)
        .maybeSingle()

    if (jobError) {
      return NextResponse.json(
        { error: jobError.message },
        { status: 400 }
      )
    }

    if (!job || job.job_type !== 'bid_request') {
      return NextResponse.json(
        { error: 'Bid request project not found.' },
        { status: 404 }
      )
    }

    const isBidCompany =
      bid.company_id === companyContext.companyId

    const isProjectCompany =
      job.company_id === companyContext.companyId

    const canManageProject =
      isProjectCompany &&
      (
        companyContext.isPlatformAdmin ||
        companyContext.isCompanyOwner ||
        (
          companyContext.isTeamMember &&
          companyContext.teamRole === 'admin'
        )
      )

    if (action === 'edit') {
      if (!isBidCompany) {
        return NextResponse.json(
          { error: 'You can only edit your company bid.' },
          { status: 403 }
        )
      }

      if (
        bid.status !== 'pending' &&
        bid.status !== 'withdrawn'
      ) {
        return NextResponse.json(
          { error: 'This bid can no longer be edited.' },
          { status: 409 }
        )
      }

      if (job.status !== 'open') {
        return NextResponse.json(
          { error: 'This project is no longer accepting bids.' },
          { status: 409 }
        )
      }

      if (
        job.bid_deadline &&
        new Date(job.bid_deadline).getTime() <= Date.now()
      ) {
        return NextResponse.json(
          { error: 'The bidding deadline has passed.' },
          { status: 409 }
        )
      }

      const {
        data: acceptedProjectBid,
        error: acceptedProjectBidError,
      } = await supabaseAdmin
        .from('job_bids')
        .select('id')
        .eq('job_id', job.id)
        .eq('status', 'accepted')
        .maybeSingle()

      if (acceptedProjectBidError) {
        return NextResponse.json(
          { error: acceptedProjectBidError.message },
          { status: 400 }
        )
      }

      if (acceptedProjectBid) {
        return NextResponse.json(
          {
            error:
              'This project already has an accepted bid and is no longer accepting bids.',
          },
          { status: 409 }
        )
      }

      const amountCents = parseAmountCents(payload)

      if (
        amountCents === null ||
        !Number.isSafeInteger(amountCents) ||
        amountCents <= 0 ||
        amountCents > MAX_BID_CENTS
      ) {
        return NextResponse.json(
          { error: 'Enter a valid bid amount.' },
          { status: 400 }
        )
      }

      const { data: updatedBid, error: updateError } =
        await supabaseAdmin
          .from('job_bids')
          .update({
            amount_cents: amountCents,
            availability: optionalString(
              payload.availability,
              MAX_AVAILABILITY_LENGTH
            ),
            estimated_duration: optionalString(
              payload.estimatedDuration,
              MAX_DURATION_LENGTH
            ),
            note: optionalString(
              payload.note,
              MAX_NOTE_LENGTH
            ),
            status: 'pending',
            submitted_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bid.id)
          .eq('company_id', companyContext.companyId)
          .select()
          .single()

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        bid: updatedBid,
        message:
          bid.status === 'withdrawn'
            ? 'Bid resubmitted successfully.'
            : 'Bid updated successfully.',
      })
    }

    if (action === 'withdraw') {
      if (!isBidCompany) {
        return NextResponse.json(
          { error: 'You can only withdraw your company bid.' },
          { status: 403 }
        )
      }

      if (bid.status !== 'pending') {
        return NextResponse.json(
          { error: 'Only pending bids can be withdrawn.' },
          { status: 409 }
        )
      }

      const { error: withdrawError } =
        await supabaseAdmin
          .from('job_bids')
          .update({
            status: 'withdrawn',
            updated_at: new Date().toISOString(),
          })
          .eq('id', bid.id)
          .eq('company_id', companyContext.companyId)

      if (withdrawError) {
        return NextResponse.json(
          { error: withdrawError.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Bid withdrawn successfully.',
      })
    }

    if (!canManageProject) {
      return NextResponse.json(
        {
          error:
            'Only an authorized project company administrator can manage bids.',
        },
        { status: 403 }
      )
    }

    if (action === 'decline') {
      if (bid.status !== 'pending') {
        return NextResponse.json(
          { error: 'Only pending bids can be declined.' },
          { status: 409 }
        )
      }

      const { error: declineError } =
        await supabaseAdmin
          .from('job_bids')
          .update({
            status: 'declined',
            updated_at: new Date().toISOString(),
          })
          .eq('id', bid.id)
          .eq('job_id', job.id)

      if (declineError) {
        return NextResponse.json(
          { error: declineError.message },
          { status: 400 }
        )
      }

      await notifyCompany({
        companyId: bid.company_id,
        type: 'job_bid_declined',
        title: 'Bid not selected',
        body: 'Your company bid was not selected for this project.',
        jobId: job.id,
        extraUserIds: bid.submitted_by
          ? [bid.submitted_by]
          : [],
      })

      return NextResponse.json({
        success: true,
        message: 'Bid declined.',
      })
    }

    if (job.status !== 'open') {
      return NextResponse.json(
        { error: 'This project is no longer open.' },
        { status: 409 }
      )
    }

    if (bid.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only a pending bid can be accepted.' },
        { status: 409 }
      )
    }

    const {
      data: otherPendingBids,
      error: otherPendingBidsError,
    } = await supabaseAdmin
      .from('job_bids')
      .select('id, company_id, submitted_by')
      .eq('job_id', job.id)
      .eq('status', 'pending')
      .neq('id', bid.id)

    if (otherPendingBidsError) {
      console.error(
        'Unable to load other pending bids before acceptance:',
        otherPendingBidsError
      )
    }

    /*
     * Accept the selected bid and decline all remaining
     * pending bids atomically inside PostgreSQL.
     *
     * Authorization has already been validated above.
     */
    const {
      data: acceptedBid,
      error: acceptError,
    } = await supabaseAdmin.rpc(
      'accept_job_bid',
      {
        p_job_id: job.id,
        p_bid_id: bid.id,
      }
    )

    if (acceptError) {
      const message = acceptError.message || ''

      if (
        message.includes('BID_ALREADY_ACCEPTED') ||
        acceptError.code === '23505'
      ) {
        return NextResponse.json(
          {
            error:
              'Another bid has already been accepted for this project.',
          },
          { status: 409 }
        )
      }

      if (message.includes('BID_NOT_PENDING')) {
        return NextResponse.json(
          {
            error:
              'This bid is no longer pending and cannot be accepted.',
          },
          { status: 409 }
        )
      }

      if (message.includes('PROJECT_NOT_OPEN')) {
        return NextResponse.json(
          {
            error:
              'This project is no longer open.',
          },
          { status: 409 }
        )
      }

      if (
        message.includes('PROJECT_NOT_FOUND') ||
        message.includes('BID_NOT_FOUND') ||
        message.includes('NOT_BID_REQUEST')
      ) {
        return NextResponse.json(
          {
            error:
              'The bid request could not be found.',
          },
          { status: 404 }
        )
      }

      return NextResponse.json(
        {
          error:
            'CrewCall could not accept this bid. Please try again.',
        },
        { status: 400 }
      )
    }

    await notifyCompany({
      companyId: bid.company_id,
      type: 'job_bid_accepted',
      title: 'Your bid was accepted',
      body: 'Your company bid was accepted for this project.',
      jobId: job.id,
      extraUserIds: bid.submitted_by
        ? [bid.submitted_by]
        : [],
    })

    await Promise.all(
      (otherPendingBids || []).map((otherBid) =>
        notifyCompany({
          companyId: otherBid.company_id,
          type: 'job_bid_declined',
          title: 'Bid not selected',
          body: 'Your company bid was not selected for this project.',
          jobId: job.id,
          extraUserIds: otherBid.submitted_by
            ? [otherBid.submitted_by]
            : [],
        })
      )
    )

    return NextResponse.json({
      success: true,
      bid: acceptedBid,
      acceptedBidId: bid.id,
      message: 'Bid accepted successfully.',
    })
  } catch (error) {
    console.error('Update job bid error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update bid.',
      },
      { status: 500 }
    )
  }
}
