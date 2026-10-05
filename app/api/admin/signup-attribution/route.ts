import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (!url || !anon || !service) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 })
  }
  if (!token) {
    return NextResponse.json({ error: 'Sign-in required.' }, { status: 401 })
  }

  const auth = createClient(url, anon)
  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error: authError } = await auth.auth.getUser(token)

  if (authError || !user) {
    return NextResponse.json({ error: 'Session expired.' }, { status: 401 })
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || (profile.role !== 'admin' && profile.is_admin !== true)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const signups = (data.users || []).flatMap((account) => {
    const meta = account.user_metadata || {}
    const source = typeof meta.utm_source === 'string' ? meta.utm_source : ''
    const medium = typeof meta.utm_medium === 'string' ? meta.utm_medium : ''
    const campaign = typeof meta.utm_campaign === 'string' ? meta.utm_campaign : ''
    if (!source && !medium && !campaign) return []

    return [{
      role: typeof meta.role === 'string' ? meta.role : 'unknown',
      source: source || '—',
      medium: medium || '—',
      campaign: campaign || '—',
      created_at: account.created_at,
    }]
  }).sort((a, b) => b.created_at.localeCompare(a.created_at))

  return NextResponse.json({ total: signups.length, signups: signups.slice(0, 25) })
}
