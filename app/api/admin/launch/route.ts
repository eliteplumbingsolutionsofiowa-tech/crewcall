import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type SystemCheck = {
  id: string
  label: string
  status: 'ready' | 'warning' | 'missing'
  detail: string
}

type ProfileRoleRow = {
  role: string | null
}

type JobStatusRow = {
  status: string | null
  payment_status: string | null
  payout_status: string | null
}

type ApplicationStatusRow = {
  status: string | null
}

type InviteStatusRow = {
  status: string | null
}

type NotificationRow = {
  read: boolean | null
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function createPublicClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return null
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function check(
  id: string,
  label: string,
  ready: boolean,
  readyDetail: string,
  missingDetail: string,
  warning = false
): SystemCheck {
  return {
    id,
    label,
    status: ready ? 'ready' : warning ? 'warning' : 'missing',
    detail: ready ? readyDetail : missingDetail,
  }
}

async function pageExists(origin: string, pathname: string) {
  try {
    const response = await fetch(`${origin}${pathname}`, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'manual',
    })

    return response.status >= 200 && response.status < 400
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get('authorization')
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : ''

    if (!token) {
      return NextResponse.json(
        { error: 'Missing authorization token.' },
        { status: 401 }
      )
    }

    const adminClient = createAdminClient()
    const publicClient = createPublicClient()

    if (!adminClient || !publicClient) {
      return NextResponse.json(
        {
          error:
            'Supabase environment variables are not fully configured.',
        },
        { status: 500 }
      )
    }

    const {
      data: { user },
      error: userError,
    } = await publicClient.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Your login session is invalid or expired.' },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      )
    }

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Administrator access is required.' },
        { status: 403 }
      )
    }

    const [
      profilesResult,
      jobsResult,
      applicationsResult,
      invitesResult,
      notificationsResult,
    ] = await Promise.all([
      adminClient.from('profiles').select('role'),
      adminClient
        .from('jobs')
        .select('status, payment_status, payout_status'),
      adminClient.from('applications').select('status'),
      adminClient.from('job_invites').select('status'),
      adminClient.from('notifications').select('read'),
    ])

    const databaseErrors = [
      profilesResult.error,
      jobsResult.error,
      applicationsResult.error,
      invitesResult.error,
      notificationsResult.error,
    ].filter(Boolean)

    if (databaseErrors.length > 0) {
      console.warn(
        'Launch Center database warnings:',
        databaseErrors.map((error) => error?.message)
      )
    }

    const profiles = (profilesResult.data || []) as ProfileRoleRow[]
    const jobs = (jobsResult.data || []) as JobStatusRow[]
    const applications = (applicationsResult.data ||
      []) as ApplicationStatusRow[]
    const invites = (invitesResult.data || []) as InviteStatusRow[]
    const notifications = (notificationsResult.data ||
      []) as NotificationRow[]

    const companies = profiles.filter(
      (row) => row.role === 'company'
    ).length

    const workers = profiles.filter(
      (row) => row.role === 'worker'
    ).length

    const admins = profiles.filter(
      (row) => row.role === 'admin'
    ).length

    const openJobs = jobs.filter((row) => row.status === 'open').length

    const assignedJobs = jobs.filter(
      (row) =>
        row.status === 'assigned' || row.status === 'in_progress'
    ).length

    const completedJobs = jobs.filter(
      (row) => row.status === 'completed'
    ).length

    const paidJobs = jobs.filter(
      (row) => row.payment_status === 'paid'
    ).length

    const releasedPayouts = jobs.filter(
      (row) => row.payout_status === 'released'
    ).length

    const hiredApplications = applications.filter(
      (row) => row.status === 'hired'
    ).length

    const pendingInvites = invites.filter(
      (row) => row.status === 'pending'
    ).length

    const unreadNotifications = notifications.filter(
      (row) => row.read === false
    ).length

    const requestUrl = new URL(request.url)
    const origin = requestUrl.origin

    const [
      termsExists,
      privacyExists,
      contactExists,
      pricingExists,
      aboutExists,
      loginExists,
      postJobExists,
      adminExists,
    ] = await Promise.all([
      pageExists(origin, '/terms'),
      pageExists(origin, '/privacy'),
      pageExists(origin, '/contact'),
      pageExists(origin, '/pricing'),
      pageExists(origin, '/about'),
      pageExists(origin, '/login'),
      pageExists(origin, '/post-job'),
      pageExists(origin, '/admin'),
    ])

    const checks: SystemCheck[] = [
      check(
        'supabase',
        'Supabase',
        Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
            process.env.SUPABASE_SERVICE_ROLE_KEY
        ),
        'Database environment is configured.',
        'One or more Supabase environment variables are missing.'
      ),
      check(
        'stripe',
        'Stripe Payments',
        Boolean(
          process.env.STRIPE_SECRET_KEY &&
            process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
        ),
        'Stripe keys are configured.',
        'Stripe keys are missing.'
      ),
      check(
        'stripe-webhook',
        'Stripe Webhook',
        Boolean(process.env.STRIPE_WEBHOOK_SECRET),
        'Stripe webhook secret is configured.',
        'STRIPE_WEBHOOK_SECRET is missing.',
        true
      ),
      check(
        'openai',
        'OpenAI',
        Boolean(process.env.OPENAI_API_KEY),
        'OpenAI API key is configured.',
        'OPENAI_API_KEY is missing.'
      ),
      check(
        'resend',
        'Email Delivery',
        Boolean(process.env.RESEND_API_KEY),
        'Resend email delivery is configured.',
        'RESEND_API_KEY is missing.',
        true
      ),
      check(
        'maps',
        'Google Maps',
        Boolean(
          process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
            process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
        ),
        'Google Maps is configured.',
        'Google Maps browser key is missing.',
        true
      ),
      check(
        'login-page',
        'Authentication Page',
        loginExists,
        'Login page is reachable.',
        'The /login page could not be reached.'
      ),
      check(
        'post-job-page',
        'Job Posting',
        postJobExists,
        'Post Job page is reachable.',
        'The /post-job page could not be reached.'
      ),
      check(
        'admin-page',
        'Admin Dashboard',
        adminExists,
        'Admin dashboard is reachable.',
        'The /admin page could not be reached.'
      ),
      check(
        'terms',
        'Terms of Service',
        termsExists,
        'Terms page is reachable.',
        'Create the /terms page.'
      ),
      check(
        'privacy',
        'Privacy Policy',
        privacyExists,
        'Privacy page is reachable.',
        'Create the /privacy page.'
      ),
      check(
        'contact',
        'Contact and Support',
        contactExists,
        'Contact page is reachable.',
        'Create the /contact page.',
        true
      ),
      check(
        'pricing',
        'Pricing Page',
        pricingExists,
        'Pricing page is reachable.',
        'The /pricing page could not be reached.',
        true
      ),
      check(
        'about',
        'About Page',
        aboutExists,
        'About page is reachable.',
        'The /about page could not be reached.',
        true
      ),
    ]

    const readyChecks = checks.filter(
      (item) => item.status === 'ready'
    ).length

    const readinessPercent = Math.round(
      (readyChecks / checks.length) * 100
    )

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      readinessPercent,
      checks,
      stats: {
        totalProfiles: profiles.length,
        companies,
        workers,
        admins,
        totalJobs: jobs.length,
        openJobs,
        assignedJobs,
        completedJobs,
        paidJobs,
        releasedPayouts,
        totalApplications: applications.length,
        hiredApplications,
        totalInvites: invites.length,
        pendingInvites,
        totalNotifications: notifications.length,
        unreadNotifications,
      },
      databaseWarnings: databaseErrors.map(
        (error) => error?.message || 'Unknown database error'
      ),
    })
  } catch (error) {
    console.error('Launch Center API error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load CrewCall launch readiness.',
      },
      { status: 500 }
    )
  }
}
