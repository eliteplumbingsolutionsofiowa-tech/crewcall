import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY
const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing required Supabase server environment variables.'
  )
}

const adminClient = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

function getBearerToken(request: Request) {
  const auth = request.headers.get('authorization')

  if (!auth?.startsWith('Bearer ')) {
    return null
  }

  return auth.slice('Bearer '.length).trim() || null
}

function storagePathFromPublicUrl(
  urlValue: string | null,
  bucket: string
) {
  if (!urlValue) return null

  try {
    const url = new URL(urlValue)
    const marker = `/${bucket}/`
    const parts = url.pathname.split(marker)

    return parts[1] || null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const accessToken = getBearerToken(request)

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authorization token required.' },
        { status: 401 }
      )
    }

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unable to verify your account.' },
        { status: 401 }
      )
    }

    const { data: subscription } = await adminClient
      .from('subscriptions')
      .select(
        'stripe_subscription_id, stripe_customer_id, status'
      )
      .eq('user_id', user.id)
      .maybeSingle()

    if (
      subscription?.stripe_subscription_id &&
      stripeSecretKey
    ) {
      const stripe = new Stripe(stripeSecretKey)

      try {
        const currentSubscription =
          await stripe.subscriptions.retrieve(
            subscription.stripe_subscription_id
          )

        if (
          currentSubscription.status !== 'canceled' &&
          currentSubscription.status !== 'incomplete_expired'
        ) {
          await stripe.subscriptions.cancel(
            subscription.stripe_subscription_id
          )
        }
      } catch (stripeError) {
        console.error(
          'Unable to cancel Stripe subscription before account deletion:',
          stripeError
        )

        return NextResponse.json(
          {
            error:
              'We could not cancel your active subscription. Your account has not been deleted. Please try again.',
          },
          { status: 502 }
        )
      }
    }

    const { data: profileFiles, error: profileFilesError } =
      await adminClient
        .from('profile_files')
        .select('id, file_url')
        .eq('user_id', user.id)

    if (profileFilesError) {
      throw profileFilesError
    }

    const profileStoragePaths = (profileFiles || [])
      .map((file) =>
        storagePathFromPublicUrl(
          file.file_url,
          'profile-files'
        )
      )
      .filter((value): value is string => Boolean(value))

    if (profileStoragePaths.length > 0) {
      const { error: storageError } =
        await adminClient.storage
          .from('profile-files')
          .remove(profileStoragePaths)

      if (storageError) {
        throw storageError
      }
    }

    const { data: jobFiles, error: jobFilesError } =
      await adminClient
        .from('job_files')
        .select('id, file_url')
        .eq('uploaded_by', user.id)

    if (jobFilesError) {
      throw jobFilesError
    }

    const jobStoragePaths = (jobFiles || [])
      .map((file) =>
        storagePathFromPublicUrl(
          file.file_url,
          'job-files'
        )
      )
      .filter((value): value is string => Boolean(value))

    if (jobStoragePaths.length > 0) {
      const { error: storageError } =
        await adminClient.storage
          .from('job-files')
          .remove(jobStoragePaths)

      if (storageError) {
        throw storageError
      }
    }

    const { error: assignedWorkerError } =
      await adminClient
        .from('jobs')
        .update({
          assigned_worker_id: null,
        })
        .eq('assigned_worker_id', user.id)

    if (assignedWorkerError) {
      throw assignedWorkerError
    }

    const { error: recipientError } =
      await adminClient
        .from('messages')
        .update({
          recipient_id: null,
        })
        .eq('recipient_id', user.id)

    if (recipientError) {
      throw recipientError
    }

    const { error: deleteUserError } =
      await adminClient.auth.admin.deleteUser(
        user.id,
        false
      )

    if (deleteUserError) {
      throw deleteUserError
    }

    return NextResponse.json({
      success: true,
      message:
        'Your CrewCall account and associated personal data have been permanently deleted.',
    })
  } catch (error) {
    console.error(
      'Permanent account deletion failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to permanently delete account.',
      },
      { status: 500 }
    )
  }
}
