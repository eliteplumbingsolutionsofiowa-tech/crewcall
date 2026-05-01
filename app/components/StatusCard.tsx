import Link from 'next/link'

type StatusCardProps = {
  title: string
  message?: string
  actionText?: string
  actionHref?: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
}

export default function StatusCard({
  title,
  message,
  actionText,
  actionHref,
  tone = 'default',
}: StatusCardProps) {
  const tones = {
    default: 'border-slate-200 bg-white text-slate-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
  }

  return (
    <div className={`rounded-2xl border p-6 shadow-sm ${tones[tone]}`}>
      <h2 className="text-lg font-bold">{title}</h2>

      {message && (
        <p className="mt-2 text-sm opacity-80">
          {message}
        </p>
      )}

      {actionText && actionHref && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {actionText}
        </Link>
      )}
    </div>
  )
}