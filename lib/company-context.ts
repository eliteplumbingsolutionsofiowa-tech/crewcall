type SupabaseLike = any

export type CompanyContext = {
  companyId: string | null
  profileRole: string | null
  isPlatformAdmin: boolean
  isCompanyOwner: boolean
  isTeamMember: boolean
  teamRole: string | null
}

export async function resolveCompanyContext(
  supabase: SupabaseLike,
  userId: string
): Promise<CompanyContext> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', userId)
    .maybeSingle()

  const profileRole =
    typeof profile?.role === 'string'
      ? profile.role
      : null

  const isPlatformAdmin =
    profile?.is_admin === true ||
    profileRole === 'admin'

  if (profileRole === 'company') {
    return {
      companyId: userId,
      profileRole,
      isPlatformAdmin,
      isCompanyOwner: true,
      isTeamMember: false,
      teamRole: null,
    }
  }

  const { data: membership } = await supabase
    .from('company_team_members')
    .select('company_id, role, status, joined_at')
    .eq('user_id', userId)
    .eq('status', 'joined')
    .order('joined_at', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle()

  if (membership?.company_id) {
    return {
      companyId: membership.company_id,
      profileRole,
      isPlatformAdmin,
      isCompanyOwner: false,
      isTeamMember: true,
      teamRole:
        typeof membership.role === 'string'
          ? membership.role.trim().toLowerCase()
          : null,
    }
  }

  /*
   * Legacy/founder fallback:
   * some early CrewCall company owners have a worker profile
   * but already own company data.
   */
  const [
    ownedBranchResult,
    ownedJobResult,
  ] = await Promise.all([
    supabase
      .from('company_branches')
      .select('id')
      .eq('company_id', userId)
      .limit(1)
      .maybeSingle(),

    supabase
      .from('jobs')
      .select('id')
      .eq('company_id', userId)
      .limit(1)
      .maybeSingle(),
  ])

  const ownsCompanyData =
    Boolean(ownedBranchResult.data) ||
    Boolean(ownedJobResult.data)

  if (ownsCompanyData) {
    return {
      companyId: userId,
      profileRole,
      isPlatformAdmin,
      isCompanyOwner: true,
      isTeamMember: false,
      teamRole: null,
    }
  }

  return {
    companyId: null,
    profileRole,
    isPlatformAdmin,
    isCompanyOwner: false,
    isTeamMember: false,
    teamRole: null,
  }
}
