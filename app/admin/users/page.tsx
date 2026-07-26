'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type SubscriptionSummary = {
  plan: string | null
  status: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
}

type AdminUser = {
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
  email: string | null
  email_confirmed: boolean
  email_confirmed_at: string | null
  last_sign_in_at: string | null
  auth_created_at: string | null
  subscription: SubscriptionSummary | null
}

type ApiResponse = {
  success?: boolean
  users?: AdminUser[]
  count?: number
  error?: string
}

type UserCounts = {
  total: number
  companies: number
  workers: number
  admins: number
  activeSubscriptions: number
  trialing: number
  unverified: number
  online: number
}

type RoleFilter =
  | 'all'
  | 'company'
  | 'worker'
  | 'admin'

type SubscriptionFilter =
  | 'all'
  | 'active'
  | 'trialing'
  | 'inactive'
  | 'none'

type VerificationFilter =
  | 'all'
  | 'verified'
  | 'unverified'

const emptyCounts: UserCounts = {
  total: 0,
  companies: 0,
  workers: 0,
  admins: 0,
  activeSubscriptions: 0,
  trialing: 0,
  unverified: 0,
  online: 0,
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState('')
  const [hasAdminAccess, setHasAdminAccess] =
    useState<boolean | null>(null)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] =
    useState<RoleFilter>('all')
  const [
    subscriptionFilter,
    setSubscriptionFilter,
  ] = useState<SubscriptionFilter>('all')
  const [
    verificationFilter,
    setVerificationFilter,
  ] = useState<VerificationFilter>('all')
  const [onlineOnly, setOnlineOnly] =
    useState(false)

  const loadUsers = useCallback(async () => {
    setRefreshing(true)
    setMessage('')

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        throw sessionError
      }

      if (!session?.access_token) {
        setHasAdminAccess(false)
        setUsers([])
        setMessage(
          'You must be logged in to access admin users.'
        )
        return
      }

      const response = await fetch(
        '/api/admin/users',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: 'no-store',
        }
      )

      const payload =
        (await response.json()) as ApiResponse

      if (!response.ok) {
        if (
          response.status === 401 ||
          response.status === 403
        ) {
          setHasAdminAccess(false)
        }

        throw new Error(
          payload.error ||
            'Unable to load users.'
        )
      }

      setUsers(payload.users ?? [])
      setHasAdminAccess(true)
    } catch (error) {
      setUsers([])
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load users.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const counts = useMemo<UserCounts>(() => {
    if (!users.length) {
      return emptyCounts
    }

    return {
      total: users.length,

      companies: users.filter(
        (user) => user.role === 'company'
      ).length,

      workers: users.filter(
        (user) => user.role === 'worker'
      ).length,

      admins: users.filter(
        (user) =>
          user.role === 'admin' ||
          user.is_admin === true
      ).length,

      activeSubscriptions: users.filter(
        (user) =>
          normalizeStatus(
            user.subscription?.status
          ) === 'active'
      ).length,

      trialing: users.filter(
        (user) =>
          normalizeStatus(
            user.subscription?.status
          ) === 'trialing'
      ).length,

      unverified: users.filter(
        (user) => !user.email_confirmed
      ).length,

      online: users.filter((user) =>
        isActuallyOnline(user)
      ).length,
    }
  }, [users])

  const filteredUsers = useMemo(() => {
    const term = search
      .trim()
      .toLowerCase()

    return users.filter((user) => {
      const searchableValues = [
        user.id,
        user.email,
        user.full_name,
        user.company_name,
        user.role,
        user.trade,
        user.city,
        user.state,
        user.phone,
        user.subscription?.plan,
        user.subscription?.status,
        user.subscription
          ?.stripe_customer_id,
        user.subscription
          ?.stripe_subscription_id,
      ]

      const searchableText =
        searchableValues
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

      const matchesSearch =
        !term ||
        searchableText.includes(term)

      const matchesRole =
        roleFilter === 'all'
          ? true
          : roleFilter === 'admin'
            ? user.role === 'admin' ||
              user.is_admin === true
            : user.role === roleFilter

      const subscriptionStatus =
        normalizeStatus(
          user.subscription?.status
        )

      const matchesSubscription =
        subscriptionFilter === 'all'
          ? true
          : subscriptionFilter === 'none'
            ? !user.subscription
            : subscriptionFilter ===
                'inactive'
              ? Boolean(
                  user.subscription
                ) &&
                ![
                  'active',
                  'trialing',
                ].includes(
                  subscriptionStatus
                )
              : subscriptionStatus ===
                subscriptionFilter

      const matchesVerification =
        verificationFilter === 'all'
          ? true
          : verificationFilter ===
              'verified'
            ? user.email_confirmed
            : !user.email_confirmed

      const matchesOnline =
        !onlineOnly ||
        isActuallyOnline(user)

      return (
        matchesSearch &&
        matchesRole &&
        matchesSubscription &&
        matchesVerification &&
        matchesOnline
      )
    })
  }, [
    users,
    search,
    roleFilter,
    subscriptionFilter,
    verificationFilter,
    onlineOnly,
  ])

  function resetFilters() {
    setSearch('')
    setRoleFilter('all')
    setSubscriptionFilter('all')
    setVerificationFilter('all')
    setOnlineOnly(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl shadow-black/20 backdrop-blur">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
            CrewCall Admin
          </p>

          <h1 className="mt-3 text-3xl font-black">
            Loading users...
          </h1>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-cyan-400" />
          </div>
        </div>
      </main>
    )
  }

  if (hasAdminAccess === false) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-400/20 bg-red-500/10 p-8 shadow-2xl shadow-black/20">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-red-300">
            Access denied
          </p>

          <h1 className="mt-3 text-3xl font-black text-white">
            Admin access required
          </h1>

          <p className="mt-3 text-sm font-semibold leading-6 text-red-100/80">
            {message ||
              'This page is only available to CrewCall admins.'}
          </p>

          <Link
            href="/admin"
            className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
          >
            Back to Admin
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <Link
                  href="/admin"
                  className="text-sm font-black text-cyan-300 transition hover:text-cyan-200"
                >
                  ← Back to Admin
                </Link>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  CrewCall Admin
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                  Users
                </h1>

                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
                  Review accounts, signup
                  emails, verification,
                  subscriptions, Stripe
                  connections, presence, and
                  recent login activity.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadUsers()
                }
                disabled={refreshing}
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing
                  ? 'Refreshing...'
                  : 'Refresh Users'}
              </button>
            </div>
          </div>

          <div className="space-y-6 p-6 md:p-8">
            {message && (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100">
                {message}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <AdminUserStat
                label="Total"
                value={counts.total}
              />

              <AdminUserStat
                label="Companies"
                value={counts.companies}
              />

              <AdminUserStat
                label="Workers"
                value={counts.workers}
              />

              <AdminUserStat
                label="Admins"
                value={counts.admins}
              />

              <AdminUserStat
                label="Active"
                value={
                  counts.activeSubscriptions
                }
              />

              <AdminUserStat
                label="Trials"
                value={counts.trialing}
              />

              <AdminUserStat
                label="Unverified"
                value={counts.unverified}
              />

              <AdminUserStat
                label="Online"
                value={counts.online}
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(320px,1fr)_180px_200px_190px_auto]">
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search email, name, company, phone or ID..."
                  className="min-w-0 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                />

                <select
                  value={roleFilter}
                  onChange={(event) =>
                    setRoleFilter(
                      event.target
                        .value as RoleFilter
                    )
                  }
                  className="min-w-0 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none focus:border-cyan-300/50"
                >
                  <option value="all">
                    All roles
                  </option>
                  <option value="company">
                    Companies
                  </option>
                  <option value="worker">
                    Workers
                  </option>
                  <option value="admin">
                    Admins
                  </option>
                </select>

                <select
                  value={
                    subscriptionFilter
                  }
                  onChange={(event) =>
                    setSubscriptionFilter(
                      event.target
                        .value as SubscriptionFilter
                    )
                  }
                  className="min-w-0 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none focus:border-cyan-300/50"
                >
                  <option value="all">
                    All subscriptions
                  </option>
                  <option value="active">
                    Active
                  </option>
                  <option value="trialing">
                    Trialing
                  </option>
                  <option value="inactive">
                    Inactive
                  </option>
                  <option value="none">
                    No subscription
                  </option>
                </select>

                <select
                  value={
                    verificationFilter
                  }
                  onChange={(event) =>
                    setVerificationFilter(
                      event.target
                        .value as VerificationFilter
                    )
                  }
                  className="min-w-0 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none focus:border-cyan-300/50"
                >
                  <option value="all">
                    All email status
                  </option>
                  <option value="verified">
                    Verified
                  </option>
                  <option value="unverified">
                    Unverified
                  </option>
                </select>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  Reset
                </button>
              </div>

              <div className="mt-4 flex justify-start lg:justify-end">
                <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/10">
                  <input
                    type="checkbox"
                    checked={onlineOnly}
                    onChange={(event) =>
                      setOnlineOnly(
                        event.target.checked
                      )
                    }
                    className="h-4 w-4 shrink-0 accent-cyan-400"
                  />

                  <span className="whitespace-nowrap">
                    Show online users only
                  </span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-slate-400">
                Showing{' '}
                <span className="text-white">
                  {filteredUsers.length}
                </span>{' '}
                of{' '}
                <span className="text-white">
                  {users.length}
                </span>{' '}
                users
              </p>

              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Auth email and subscription
                data are admin-only
              </p>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-8 text-center">
                <p className="text-xl font-black text-white">
                  No users found.
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-400">
                  Try changing your search
                  or filters.
                </p>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-5 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {filteredUsers.map(
                  (user) => (
                    <AdminUserCard
                      key={user.id}
                      user={user}
                    />
                  )
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function AdminUserCard({
  user,
}: {
  user: AdminUser
}) {
  const displayName =
    user.company_name ||
    user.full_name ||
    user.email ||
    'Unnamed User'

  const online =
    isActuallyOnline(user)

  const subscriptionStatus =
    normalizeStatus(
      user.subscription?.status
    )

  const subscriptionLabel =
    user.subscription?.plan
      ? formatLabel(
          user.subscription.plan
        )
      : 'No plan'

  const trialDays =
    getTrialDaysRemaining(
      user.subscription?.trial_ends_at
    )

  return (
    <article className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-xl shadow-black/10 transition hover:border-cyan-300/30">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 text-3xl font-black text-white shadow-lg">
          {displayName
            .charAt(0)
            .toUpperCase()}

          <span
            className={`absolute -right-1 -top-1 h-5 w-5 rounded-full border-4 border-slate-950 ${
              online
                ? 'bg-lime-400'
                : 'bg-slate-500'
            }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 truncate text-2xl font-black text-white">
              {displayName}
            </h2>

            <Badge
              label={
                user.role || 'No role'
              }
            />

            {(user.is_admin ||
              user.role ===
                'admin') && (
              <Badge
                label="Admin"
                tone="cyan"
              />
            )}
          </div>

          <p className="mt-1 break-all text-sm font-bold text-cyan-200">
            {user.email ||
              'No signup email found'}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge
              label={
                user.email_confirmed
                  ? 'Email verified'
                  : 'Email unverified'
              }
              tone={
                user.email_confirmed
                  ? 'green'
                  : 'amber'
              }
            />

            <Badge
              label={subscriptionLabel}
              tone="blue"
            />

            <Badge
              label={
                user.subscription
                  ? formatLabel(
                      subscriptionStatus ||
                        'unknown'
                    )
                  : 'No subscription'
              }
              tone={subscriptionTone(
                subscriptionStatus,
                Boolean(
                  user.subscription
                )
              )}
            />
          </div>

          <p
            className={`mt-3 text-xs font-black uppercase tracking-wide ${
              online
                ? 'text-lime-300'
                : 'text-slate-500'
            }`}
          >
            {presenceLabel(user)}
          </p>

          <div className="mt-5 grid gap-3 text-sm font-semibold text-slate-300 sm:grid-cols-2">
            <InfoItem
              label="Trade"
              value={
                user.trade ||
                'Not listed'
              }
            />

            <InfoItem
              label="Phone"
              value={
                formatPhone(
                  user.phone
                ) || 'Not listed'
              }
            />

            <InfoItem
              label="Location"
              value={
                [
                  user.city,
                  user.state,
                ]
                  .filter(Boolean)
                  .join(', ') ||
                'Not listed'
              }
            />

            <InfoItem
              label="Joined"
              value={formatDateTime(
                user.auth_created_at ||
                  user.created_at
              )}
            />

            <InfoItem
              label="Last login"
              value={formatDateTime(
                user.last_sign_in_at
              )}
            />

            <InfoItem
              label="Email confirmed"
              value={formatDateTime(
                user.email_confirmed_at
              )}
            />

            <InfoItem
              label="Trial"
              value={
                subscriptionStatus ===
                  'trialing' &&
                trialDays !== null
                  ? `${trialDays} day${
                      trialDays === 1
                        ? ''
                        : 's'
                    } remaining`
                  : 'Not trialing'
              }
            />

            <InfoItem
              label="Period end"
              value={formatDateTime(
                user.subscription
                  ?.current_period_end
              )}
            />
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              User ID
            </p>

            <p className="mt-1 break-all font-mono text-xs text-slate-300">
              {user.id}
            </p>

            {user.subscription
              ?.stripe_customer_id && (
              <>
                <p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-500">
                  Stripe customer
                </p>

                <p className="mt-1 break-all font-mono text-xs text-slate-300">
                  {
                    user.subscription
                      .stripe_customer_id
                  }
                </p>
              </>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Link
              href={`/profile?user=${user.id}`}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-white/15"
            >
              Profile
            </Link>

            <Link
              href={`/messages?user=${user.id}`}
              className="rounded-2xl bg-blue-500 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-blue-400"
            >
              Message
            </Link>

            <Link
              href={`/admin/users/${user.id}`}
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-cyan-300"
            >
              Manage
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}

function AdminUserStat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-3 text-3xl font-black text-white">
        {value}
      </p>
    </div>
  )
}

function InfoItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <p>
      <span className="text-cyan-300">
        {label}:
      </span>{' '}
      {value}
    </p>
  )
}

function Badge({
  label,
  tone = 'slate',
}: {
  label: string
  tone?:
    | 'slate'
    | 'cyan'
    | 'green'
    | 'amber'
    | 'blue'
    | 'red'
}) {
  const classes = {
    slate:
      'border-white/10 bg-white/10 text-slate-200',

    cyan:
      'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',

    green:
      'border-lime-400/20 bg-lime-400/10 text-lime-200',

    amber:
      'border-amber-400/20 bg-amber-400/10 text-amber-200',

    blue:
      'border-blue-400/20 bg-blue-400/10 text-blue-200',

    red:
      'border-red-400/20 bg-red-400/10 text-red-200',
  }[tone]

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${classes}`}
    >
      {label}
    </span>
  )
}

function subscriptionTone(
  status: string,
  hasSubscription: boolean
):
  | 'slate'
  | 'green'
  | 'amber'
  | 'blue'
  | 'red' {
  if (!hasSubscription) {
    return 'slate'
  }

  if (status === 'active') {
    return 'green'
  }

  if (status === 'trialing') {
    return 'blue'
  }

  if (
    status === 'past_due' ||
    status === 'unpaid'
  ) {
    return 'amber'
  }

  if (
    status === 'canceled' ||
    status ===
      'incomplete_expired'
  ) {
    return 'red'
  }

  return 'slate'
}

function normalizeStatus(
  value: string | null | undefined
) {
  return (
    value
      ?.trim()
      .toLowerCase() || ''
  )
}

function formatLabel(
  value: string | null | undefined
) {
  if (!value) {
    return 'Unknown'
  }

  return value
    .replace(/[_-]+/g, ' ')
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    )
}

function isActuallyOnline(
  profile: AdminUser | null
) {
  if (
    !profile?.is_online ||
    !profile.last_seen
  ) {
    return false
  }

  const lastSeen = new Date(
    profile.last_seen
  ).getTime()

  if (Number.isNaN(lastSeen)) {
    return false
  }

  return (
    Date.now() - lastSeen <
    90_000
  )
}

function presenceLabel(
  profile: AdminUser | null
) {
  if (isActuallyOnline(profile)) {
    return 'Online now'
  }

  if (!profile?.last_seen) {
    return 'Offline'
  }

  return `Last seen ${formatRelativeTime(
    profile.last_seen
  )}`
}

function formatDateTime(
  value: string | null | undefined
) {
  if (!value) {
    return 'Not listed'
  }

  const date = new Date(value)

  if (
    Number.isNaN(date.getTime())
  ) {
    return 'Not listed'
  }

  return date.toLocaleString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }
  )
}

function formatRelativeTime(
  value: string
) {
  const date = new Date(value)
  const timestamp = date.getTime()

  if (
    Number.isNaN(timestamp)
  ) {
    return 'recently'
  }

  const difference = Math.max(
    0,
    Date.now() - timestamp
  )

  const seconds = Math.floor(
    difference / 1000
  )

  const minutes = Math.floor(
    seconds / 60
  )

  const hours = Math.floor(
    minutes / 60
  )

  const days = Math.floor(
    hours / 24
  )

  if (seconds < 60) {
    return 'just now'
  }

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  if (hours < 24) {
    return `${hours}h ago`
  }

  return `${days}d ago`
}

function getTrialDaysRemaining(
  value: string | null | undefined
) {
  if (!value) {
    return null
  }

  const trialEnd = new Date(
    value
  ).getTime()

  if (Number.isNaN(trialEnd)) {
    return null
  }

  const millisecondsRemaining =
    trialEnd - Date.now()

  return Math.max(
    0,
    Math.ceil(
      millisecondsRemaining /
        (1000 * 60 * 60 * 24)
    )
  )
}

function formatPhone(
  value: string | null
) {
  if (!value) {
    return ''
  }

  const digits = value.replace(
    /\D/g,
    ''
  )

  if (digits.length === 10) {
    return `(${digits.slice(
      0,
      3
    )}) ${digits.slice(
      3,
      6
    )}-${digits.slice(6)}`
  }

  if (
    digits.length === 11 &&
    digits.startsWith('1')
  ) {
    return `+1 (${digits.slice(
      1,
      4
    )}) ${digits.slice(
      4,
      7
    )}-${digits.slice(7)}`
  }

  return value
}
