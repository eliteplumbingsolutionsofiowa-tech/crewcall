import { NextResponse } from 'next/server'
import { hasAdminAccess } from '@/lib/admin-access'
import { createClient, type User } from '@supabase/supabase-js'

type ProfileRow = {
  id: string
  role: 'company' | 'worker' | 'admin' | null
  full_name: string | null
  company_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  phone: string | null
  is_admin: boolean | null
  is_online: boolean | null
  last_seen: string | null
  created_at: string | null
}

type SubscriptionRow = {
  id?: string | null
  user_id?: string | null
  profile_id?: string | null
  plan?: string | null
  status?: string | null
  trial_ends_at?: string | null
  current_period_end?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  stripe_price_id?: string | null
}

type SubscriptionSummary = {
  plan: string | null
  status: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
}

type AdminUserResponse = ProfileRow & {
  email: string | null
  email_confirmed: boolean
  email_confirmed_at: string | null
  last_sign_in_at: string | null
  auth_created_at: string | null
  subscription: SubscriptionSummary | null
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
    }
  )
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  const token = authorization.slice(7).trim()

  return token || null
}

async function loadAllAuthUsers(adminClient: any) {
  const users: User[] = []
  const perPage = 1000
  let page = 1

  while (true) {
    const { data, error } =
      await adminClient.auth.admin.listUsers({
        page,
        perPage,
      })

    if (error) {
      throw error
    }

    users.push(...data.users)

    if (data.users.length < perPage) {
      break
    }

    page += 1
  }

  return users
}

function getSubscriptionOwnerId(
  subscription: SubscriptionRow
) {
  return (
    subscription.user_id ||
    subscription.profile_id ||
    subscription.id ||
    null
  )
}

function normalizeSubscription(
  subscription: SubscriptionRow
): SubscriptionSummary {
  return {
    plan: subscription.plan ?? null,
    status: subscription.status ?? null,
    trial_ends_at:
      subscription.trial_ends_at ?? null,
    current_period_end:
      subscription.current_period_end ?? null,
    stripe_customer_id:
      subscription.stripe_customer_id ?? null,
    stripe_subscription_id:
      subscription.stripe_subscription_id ?? null,
    stripe_price_id:
      subscription.stripe_price_id ?? null,
  }
}

async function loadSubscriptions(adminClient: any) {
  const fullResult = await adminClient
    .from('subscriptions')
    .select(
      `
      id,
      user_id,
      profile_id,
      plan,
      status,
      trial_ends_at,
      current_period_end,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_price_id
    `
    )

  if (!fullResult.error) {
    return (fullResult.data ?? []) as SubscriptionRow[]
  }

  console.warn(
    'Admin users route: full subscription query failed:',
    fullResult.error.message
  )

  const commonResult = await adminClient
    .from('subscriptions')
    .select(
      `
      id,
      user_id,
      plan,
      status,
      trial_ends_at,
      current_period_end,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_price_id
    `
    )

  if (!commonResult.error) {
    return (commonResult.data ?? []) as SubscriptionRow[]
  }

  console.warn(
    'Admin users route: common subscription query failed:',
    commonResult.error.message
  )

  const minimalResult = await adminClient
    .from('subscriptions')
    .select(
      `
      id,
      user_id,
      plan,
      status,
      trial_ends_at,
      stripe_customer_id,
      stripe_subscription_id
    `
    )

  if (!minimalResult.error) {
    return (minimalResult.data ?? []) as SubscriptionRow[]
  }

  console.warn(
    'Admin users route: subscriptions could not be loaded:',
    minimalResult.error.message
  )

  return []
}

export async function GET(request: Request) {
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

    const accessToken = getBearerToken(request)

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
      data: { user: requestingUser },
      error: userError,
    } = await authClient.auth.getUser(accessToken)

    if (userError || !requestingUser) {
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
      .select('id, role, is_admin')
      .eq('id', requestingUser.id)
      .maybeSingle()

    if (adminProfileError) {
      return jsonError(
        adminProfileError.message,
        500
      )
    }

    const isAdmin =
  hasAdminAccess(adminProfile)

if (!isAdmin) {
      return jsonError(
        'Admin access only.',
        403
      )
    }

    const [
      profilesResult,
      authUsers,
      subscriptions,
    ] = await Promise.all([
      adminClient
        .from('profiles')
        .select(
          `
          id,
          role,
          full_name,
          company_name,
          trade,
          city,
          state,
          phone,
          is_admin,
          is_online,
          last_seen,
          created_at
        `
        )
        .order('created_at', {
          ascending: false,
        }),
      loadAllAuthUsers(adminClient),
      loadSubscriptions(adminClient),
    ])

    if (profilesResult.error) {
      return jsonError(
        profilesResult.error.message,
        500
      )
    }

    const profiles =
      (profilesResult.data ?? []) as ProfileRow[]

    const authUsersById = new Map(
      authUsers.map((authUser) => [
        authUser.id,
        authUser,
      ])
    )

    const subscriptionsByUserId = new Map<
      string,
      SubscriptionSummary
    >()

    for (const subscription of subscriptions) {
      const ownerId =
        getSubscriptionOwnerId(subscription)

      if (!ownerId) {
        continue
      }

      subscriptionsByUserId.set(
        ownerId,
        normalizeSubscription(subscription)
      )
    }

    const users: AdminUserResponse[] =
      profiles.map((profile) => {
        const authUser =
          authUsersById.get(profile.id)

        const emailConfirmedAt =
          authUser?.email_confirmed_at ?? null

        return {
          ...profile,
          email: authUser?.email ?? null,
          email_confirmed:
            Boolean(emailConfirmedAt),
          email_confirmed_at:
            emailConfirmedAt,
          last_sign_in_at:
            authUser?.last_sign_in_at ?? null,
          auth_created_at:
            authUser?.created_at ?? null,
          subscription:
            subscriptionsByUserId.get(
              profile.id
            ) ?? null,
        }
      })

    return NextResponse.json({
      success: true,
      users,
      count: users.length,
    })
  } catch (error) {
    console.error(
      'Admin users list route error:',
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
