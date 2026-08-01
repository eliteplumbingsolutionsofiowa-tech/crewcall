export function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '$0.00'
  }

  const cleaned = String(value).replace(/[^0-9.]/g, '')
  const amount = Number(cleaned)

  if (Number.isNaN(amount)) {
    return '$0.00'
  }

  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}
