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

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length).trim()
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

    const { data: profile, error: profileError } = await supabaseAdmin
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

    if (
      !profile ||
      (profile.role !== 'company' && profile.role !== 'admin')
    ) {
      return NextResponse.json(
        { error: 'Company or admin access required.' },
        { status: 403 }
      )
    }

    const { data: workers, error: workersError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        full_name,
        trade,
        city,
        state,
        latitude,
        longitude,
        is_online,
        location_visible,
        location_updated_at,
        insurance_verified,
        liability_form_verified,
        avatar_url,
        years_experience,
        skills,
        crewcall_score,
        license_number,
        osha10,
        osha30,
        med_gas,
        background_verified,
        drug_tested,
        availability_status,
        available_for_work,
        currently_working,
        booked_until,
        preferred_work,
        willing_to_travel
      `)
      .eq('role', 'worker')

    if (workersError) {
      return NextResponse.json(
        { error: workersError.message },
        { status: 500 }
      )
    }

    const safeWorkers = (workers || []).map((worker) => {
      const locationIsUsable =
        worker.location_visible === true &&
        typeof worker.latitude === 'number' &&
        typeof worker.longitude === 'number'

      return {
        ...worker,
        latitude: locationIsUsable ? worker.latitude : null,
        longitude: locationIsUsable ? worker.longitude : null,
      }
    })

    return NextResponse.json({
      workers: safeWorkers,
    })
  } catch (error) {
    console.error('Worker map API error:', error)

    return NextResponse.json(
      { error: 'Unable to load workers.' },
      { status: 500 }
    )
  }
}
