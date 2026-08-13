import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error('Missing required Supabase environment variables.')
}

const authClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

const adminClient = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length).trim()
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req)

    if (!token) {
      return NextResponse.json(
        { error: 'Authorization required.' },
        { status: 401 }
      )
    }

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token)

    if (userError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unable to verify your account.' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const inviteId =
      typeof body?.inviteId === 'string'
        ? body.inviteId.trim()
        : ''

    if (!inviteId) {
      return NextResponse.json(
        { error: 'Missing invitation ID.' },
        { status: 400 }
      )
    }

    const { data: invite, error: inviteError } =
      await adminClient
        .from('company_team_members')
        .select(
          'id,company_id,branch_id,email,role,status,user_id'
        )
        .eq('id', inviteId)
        .maybeSingle()

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message },
        { status: 400 }
      )
    }

    if (!invite) {
      return NextResponse.json(
        { error: 'Invitation not found.' },
        { status: 404 }
      )
    }

    if (
      String(invite.email || '').trim().toLowerCase() !==
      user.email.trim().toLowerCase()
    ) {
      return NextResponse.json(
        {
          error:
            'This invitation was sent to a different email address.',
        },
        { status: 403 }
      )
    }

    if (
      invite.user_id === user.id &&
      invite.status !== 'invited'
    ) {
      return NextResponse.json({
        success: true,
        alreadyAccepted: true,
      })
    }

    if (
      invite.user_id &&
      invite.user_id !== user.id
    ) {
      return NextResponse.json(
        {
          error:
            'This invitation has already been accepted by another account.',
        },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()

    const { error: updateError } =
      await adminClient
        .from('company_team_members')
        .update({
          user_id: user.id,
          status: 'joined',
          joined_at: now,
          updated_at: now,
        })
        .eq('id', invite.id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      companyId: invite.company_id,
      branchId: invite.branch_id,
      role: invite.role,
    })
  } catch (error) {
    console.error('Team invitation acceptance failed:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Server error',
      },
      { status: 500 }
    )
  }
}
