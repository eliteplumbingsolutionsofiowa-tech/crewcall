import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendCrewCallEmail } from '@/lib/resend'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY

if (
  !supabaseUrl ||
  !supabaseAnonKey ||
  !supabaseServiceRoleKey
) {
  throw new Error(
    'Missing required Supabase environment variables.'
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

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://crewcall.app'

type InviteRequest = {
  inviteId?: string
}

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get('authorization')

  if (
    !authorization ||
    !authorization.startsWith('Bearer ')
  ) {
    return null
  }

  return authorization
    .slice('Bearer '.length)
    .trim()
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
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
        {
          error:
            userError?.message ||
            'Unable to verify user.',
        },
        { status: 401 }
      )
    }

    const { inviteId } =
      (await req.json()) as InviteRequest

    if (!inviteId) {
      return NextResponse.json(
        { error: 'Missing invite ID.' },
        { status: 400 }
      )
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role, company_name, full_name')
      .eq('id', user.id)
      .maybeSingle()

    let canManageOrganization =
      profile?.role === 'company' ||
      profile?.role === 'admin'

    if (!canManageOrganization) {
      const [
        branchResult,
        jobResult,
      ] = await Promise.all([
        adminClient
          .from('company_branches')
          .select('id')
          .eq('company_id', user.id)
          .limit(1)
          .maybeSingle(),

        adminClient
          .from('jobs')
          .select('id')
          .eq('company_id', user.id)
          .limit(1)
          .maybeSingle(),
      ])

      canManageOrganization =
        Boolean(branchResult.data) ||
        Boolean(jobResult.data)
    }

    if (!canManageOrganization) {
      return NextResponse.json(
        {
          error:
            'You are not authorized to manage this organization.',
        },
        { status: 403 }
      )
    }

    const { data: invite, error: inviteError } =
      await adminClient
        .from('company_team_members')
        .select(
          `
          id,
          company_id,
          branch_id,
          email,
          role,
          status
          `
        )
        .eq('id', inviteId)
        .eq('company_id', user.id)
        .maybeSingle()

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message },
        { status: 400 }
      )
    }

    if (!invite) {
      return NextResponse.json(
        { error: 'Invitation not found.' },
        { status: 404 }
      )
    }

    if (!invite.email) {
      return NextResponse.json(
        { error: 'Invitation has no email address.' },
        { status: 400 }
      )
    }

    let branchName = 'No branch assigned'

    if (invite.branch_id) {
      const { data: branch } = await adminClient
        .from('company_branches')
        .select('name')
        .eq('id', invite.branch_id)
        .eq('company_id', user.id)
        .maybeSingle()

      if (branch?.name) {
        branchName = branch.name
      }
    }

    const companyName =
      profile?.company_name ||
      profile?.full_name ||
      'a CrewCall company'

    const safeCompany =
      escapeHtml(companyName)

    const safeRole =
      escapeHtml(invite.role || 'Team Member')

    const safeBranch =
      escapeHtml(branchName)

    const openCrewCallUrl =
      `${appUrl}/signup?email=${encodeURIComponent(
        invite.email
      )}`

    const result = await sendCrewCallEmail({
      to: invite.email,
      subject: `${companyName} invited you to join their CrewCall team`,
      html: `
        <!doctype html>
        <html>
          <body style="margin:0;padding:0;background:#020617;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
            <table width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:32px 16px;">
              <tr>
                <td align="center">
                  <table width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#0f172a;border:1px solid #1e293b;border-radius:24px;overflow:hidden;">
                    <tr>
                      <td style="padding:28px;background:#111827;">
                        <div style="font-size:13px;font-weight:900;letter-spacing:.2em;text-transform:uppercase;color:#67e8f9;">
                          CrewCall
                        </div>

                        <h1 style="margin:14px 0 0;font-size:30px;line-height:1.15;color:#ffffff;">
                          You've been invited to join ${safeCompany}
                        </h1>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:28px;color:#cbd5e1;font-size:16px;line-height:1.7;">
                        <p style="margin-top:0;">
                          ${safeCompany} has invited you to join their CrewCall organization.
                        </p>

                        <p>
                          <strong style="color:#ffffff;">Role:</strong>
                          ${safeRole}
                          <br />
                          <strong style="color:#ffffff;">Branch:</strong>
                          ${safeBranch}
                        </p>

                        <p>
                          CrewCall helps skilled-trade companies manage their workforce, jobs, branches, and team members in one place.
                        </p>

                        <a
                          href="${openCrewCallUrl}"
                          style="display:inline-block;margin-top:12px;background:#22d3ee;color:#020617;text-decoration:none;font-weight:900;padding:14px 22px;border-radius:12px;"
                        >
                          Open CrewCall
                        </a>

                        <p style="margin-top:28px;font-size:13px;color:#64748b;">
                          This invitation was sent by ${safeCompany}.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
      text:
        `${companyName} invited you to join their CrewCall team as ${invite.role}. ` +
        `Branch: ${branchName}. Open CrewCall: ${openCrewCallUrl}`,
    })

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            result.error ||
            'Invitation email could not be sent.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      emailSent: true,
    })
  } catch (error) {
    console.error(
      'Team invitation email failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Server error',
      },
      { status: 500 }
    )
  }
}
