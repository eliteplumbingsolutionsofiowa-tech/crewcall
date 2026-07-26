export type AdminAccessProfile = {
  role?: string | null
  is_admin?: boolean | null
}

export function hasAdminAccess(
  profile: AdminAccessProfile | null | undefined
) {
  return (
    profile?.role === 'admin' ||
    profile?.is_admin === true
  )
}
