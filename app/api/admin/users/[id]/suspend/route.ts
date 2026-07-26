import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type SuspensionRequest = {
  action?: unknown
  reason?: unknown
}

type SuspensionAction = 'suspend' | 'reactivate'

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
    }
  )
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey
    ) {
      return jsonError(
        'The server is missing required Supabase environment variables.',
        500
      )
    }

    const authorization =
      request.headers.get('authorization')

    if (
      !authorization ||
      !authorization.startsWith('Bearer ')
    ) {
      return jsonError(
        'Missing authorization token.',
        401
      )
    }

    const accessToken = authorization
      .slice(7)
      .trim()

    if (!accessToken) {
      return jsonError(
        'Missing authorization token.',
        401
      )
    }

    const authClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(
      accessToken
    )

    if (userError || !user) {
      return jsonError(
        userError?.message ||
          'Your login session could not be verified.',
        401
      )
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    const {
      data: adminProfile,
      error: adminProfileError,
    } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (adminProfileError) {
      return jsonError(
        adminProfileError.message,
        500
      )
    }

    if (adminProfile?.role !== 'admin') {
      return jsonError(
        'Admin access only.',
        403
      )
    }

    const { id: recipientId } =
      await context.params

    if (!recipientId) {
      return jsonError(
        'Missing user ID.',
        400
      )
    }

    if (recipientId === user.id) {
      return jsonError(
        'You cannot suspend your own administrator account.',
        400
      )
    }

    let requestBody: SuspensionRequest

    try {
      requestBody =
        (await request.json()) as SuspensionRequest
    } catch {
      return jsonError(
        'Invalid request body.',
        400
      )
    }

    const action =
      requestBody.action === 'suspend' ||
      requestBody.action === 'reactivate'
        ? requestBody.action
        : null

    const reason =
      typeof requestBody.reason === 'string'
        ? requestBody.reason.trim()
        : ''

    if (!action) {
      return jsonError(
        'Action must be either suspend or reactivate.',
        400
      )
    }

    if (
      action === 'suspend' &&
      !reason
    ) {
      return jsonError(
        'A suspension reason is required.',
        400
      )
    }

    if (reason.length > 500) {
      return jsonError(
        'Suspension reason must be 500 characters or fewer.',
        400
      )
    }

    const {
      data: recipient,
      error: recipientError,
    } = await adminClient
      .from('profiles')
      .select(`
        id,
        role,
        full_name,
        company_name,
        is_suspended,
        suspended_at,
        suspension_reason,
        suspended_by
      `)
      .eq('id', recipientId)
      .maybeSingle()

    if (recipientError) {
      return jsonError(
        recipientError.message,
        500
      )
    }

    if (!recipient) {
      return jsonError(
        'User not found.',
        404
      )
    }

    if (
      action === 'suspend' &&
      recipient.role === 'admin'
    ) {
      return jsonError(
        'Administrator accounts cannot be suspended from this page.',
        400
      )
    }

    if (
      action === 'suspend' &&
      recipient.is_suspended
    ) {
      return jsonError(
        'This user is already suspended.',
        400
      )
    }

    if (
      action === 'reactivate' &&
      !recipient.is_suspended
    ) {
      return jsonError(
        'This user is not currently suspended.',
        400
      )
    }

    const now = new Date().toISOString()

    const previousState = {
      is_suspended:
        recipient.is_suspended,
      suspended_at:
        recipient.suspended_at,
      suspension_reason:
        recipient.suspension_reason,
      suspended_by:
        recipient.suspended_by,
    }

    const profileUpdate =
      action === 'suspend'
        ? {
            is_suspended: true,
            suspended_at: now,
            suspension_reason: reason,
            suspended_by: user.id,
          }
        : {
            is_suspended: false,
            suspended_at: null,
            suspension_reason: null,
            suspended_by: null,
          }

    const {
      data: updatedProfile,
      error: updateError,
    } = await adminClient
      .from('profiles')
      .update(profileUpdate)
      .eq('id', recipientId)
      .select(`
        id,
        role,
        full_name,
        company_name,
        is_suspended,
        suspended_at,
        suspension_reason,
        suspended_by
      `)
      .single()

    if (updateError) {
      return jsonError(
        updateError.message,
        500
      )
    }

    const targetName =
      recipient.company_name ||
      recipient.full_name ||
      'CrewCall User'

    const auditAction =
      action === 'suspend'
        ? 'user_suspended'
        : 'user_reactivated'

    const auditDetails =
      action === 'suspend'
        ? `Suspended ${targetName}. Reason: ${reason}`
        : `Reactivated ${targetName}.`

    const {
      error: auditError,
    } = await adminClient
      .from('admin_audit_logs')
      .insert({
        admin_id: user.id,
        target_user_id: recipientId,
        action: auditAction,
        details: auditDetails,
        metadata: {
          previous_state: previousState,
          new_state: {
            is_suspended:
              updatedProfile.is_suspended,
            suspended_at:
              updatedProfile.suspended_at,
            suspension_reason:
              updatedProfile.suspension_reason,
            suspended_by:
              updatedProfile.suspended_by,
          },
          reason:
            action === 'suspend'
              ? reason
              : null,
        },
      })

    if (auditError) {
      console.error(
        'Admin audit log error:',
        auditError
      )

      const {
        error: rollbackError,
      } = await adminClient
        .from('profiles')
        .update(previousState)
        .eq('id', recipientId)

      if (rollbackError) {
        console.error(
          'Suspension rollback error:',
          rollbackError
        )
      }

      return jsonError(
        'The account change was not completed because the audit log could not be saved.',
        500
      )
    }

    const notificationTitle =
      action === 'suspend'
        ? 'Account Suspended'
        : 'Account Reactivated'

    const notificationBody =
      action === 'suspend'
        ? `Your CrewCall account has been suspended. Reason: ${reason}`
        : 'Your CrewCall account has been reactivated. You may now use CrewCall normally.'

    const {
      error: notificationError,
    } = await adminClient
      .from('notifications')
      .insert({
        user_id: recipientId,
        title: notificationTitle,
        body: notificationBody,
        type: 'general',
        is_read: false,
      })

    if (notificationError) {
      console.error(
        'Suspension notification error:',
        notificationError
      )
    }

    return NextResponse.json({
      success: true,
      action,
      profile: updatedProfile,
      message:
        action === 'suspend'
          ? 'User suspended successfully and the action was recorded.'
          : 'User reactivated successfully and the action was recorded.',
    })
  } catch (error) {
    console.error(
      'Admin suspension route error:',
      error
    )

    return jsonError(
      error instanceof Error
        ? error.message
        : 'Unexpected server error.',
      500
    )
  }
}