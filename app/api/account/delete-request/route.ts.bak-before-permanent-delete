import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendCrewCallEmail } from '@/lib/resend'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
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

function getBearerToken(request: Request) {
  const auth = request.headers.get('authorization')

  if (!auth?.startsWith('Bearer ')) {
    return null
  }

  return auth.slice('Bearer '.length).trim() || null
}

export async function POST(req: Request) {
  try {
    const accessToken = getBearerToken(req)

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authorization token required.' },
        { status: 401 }
      )
    }

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unable to verify your account.' },
        { status: 401 }
      )
    }

    await sendCrewCallEmail({
      to: 'support@crewcall.app',
      subject: 'CrewCall account deletion request',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>Account deletion requested</h2>
          <p><strong>User ID:</strong> ${user.id}</p>
          <p><strong>Email:</strong> ${user.email || 'Not available'}</p>
          <p>
            This deletion request was initiated directly from inside
            the authenticated CrewCall app.
          </p>
        </div>
      `,
      text: `Account deletion requested from inside CrewCall.
User ID: ${user.id}
Email: ${user.email || 'Not available'}`,
    })

    return NextResponse.json({
      success: true,
      message:
        'Your account deletion request has been submitted. CrewCall will process the request within 30 days.',
    })
  } catch (error) {
    console.error('Account deletion request failed:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to submit account deletion request.',
      },
      { status: 500 }
    )
  }
}
