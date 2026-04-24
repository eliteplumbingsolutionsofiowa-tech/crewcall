export default function VerifiedBadge({
  verified,
  small = false,
}: {
  verified?: boolean | null
  small?: boolean
}) {
  if (!verified) return null

  return (
    <span
      className={`inline-flex items-center rounded-full bg-blue-100 text-blue-700 font-semibold ${
        small ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      }`}
    >
      ✓ Verified
    </span>
  )
}