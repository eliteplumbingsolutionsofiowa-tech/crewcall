export function formatPayRate(
  value: string | number | null | undefined
) {
  if (value === null || value === undefined) {
    return ''
  }

  const rate = String(value).trim()

  if (!rate) {
    return ''
  }

  if (rate.startsWith('$')) {
    return rate
  }

  return `$${rate}`
}
