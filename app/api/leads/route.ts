import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getEnv(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Missing ${name}`)
  }

  return value
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const supabase = createClient(
      getEnv('NEXT_PUBLIC_SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    )

    const {
      name,
      email,
      phone,
      lead_type,
      trade,
      location,
      company_name,
      message,
    } = body

    if (!name || !email) {
      return NextResponse.json(
        {
          error: 'Name and email are required.',
        },
        {
          status: 400,
        },
      )
    }

    const { error } = await supabase
      .from('leads')
      .insert({
        name,
        email,
        phone: phone || null,
        lead_type: lead_type || 'unknown',
        trade: trade || null,
        location: location || null,
        company_name: company_name || null,
        message: message || null,
        status: 'new',
      })

    if (error) {
      console.error('Lead insert error:', error)

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        },
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Lead API error:', error)

    return NextResponse.json(
      {
        error: 'Unable to submit lead.',
      },
      {
        status: 500,
      },
    )
  }
}
