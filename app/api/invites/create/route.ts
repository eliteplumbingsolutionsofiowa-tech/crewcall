import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function env(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing ${name}`)
  }

  return value
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const supabase = createClient(
      env('NEXT_PUBLIC_SUPABASE_URL'),
      env('SUPABASE_SERVICE_ROLE_KEY'),
    )

    const code =
      crypto.randomUUID()
        .replaceAll('-', '')
        .slice(0, 10)
        .toUpperCase()

    const { data, error } = await supabase
      .from('invites')
      .insert({
        inviter_id: body.inviter_id || null,
        email: body.email || null,
        role: body.role || 'worker',
        invite_code: code,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      invite: data,
      link: `/invite/${code}`,
    })

  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: 'Unable to create invite',
      },
      {
        status: 500,
      },
    )
  }
}
