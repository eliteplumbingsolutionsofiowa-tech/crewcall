import Link from 'next/link'
import type { ReactNode } from 'react'

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'outline'
  | 'success'

type ButtonProps = {
  children: ReactNode
  href?: string
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  variant?: ButtonVariant
  className?: string
  fullWidth?: boolean
}

export function CrewButton({
  children,
  href,
  onClick,
  disabled = false,
  type = 'button',
  variant = 'primary',
  className = '',
  fullWidth = false,
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm sm:text-base font-black transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-blue-200'

  const width = fullWidth ? 'w-full' : ''

  const styles: Record<ButtonVariant, string> = {
    primary:
      'border border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700',
    secondary:
      'border border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600',
    danger:
      'border border-red-600 bg-red-600 text-white shadow-lg shadow-red-600/20 hover:bg-red-700',
    ghost:
      'border border-slate-200 bg-white/80 text-slate-700 shadow-sm backdrop-blur hover:bg-slate-100',
    outline:
      'border border-blue-600 bg-white text-blue-600 shadow-sm hover:bg-blue-50',
    success:
      'border border-green-600 bg-green-600 text-white shadow-lg shadow-green-600/20 hover:bg-green-700',
  }

  const classes = `${base} ${width} ${styles[variant]} ${className}`

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  )
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const value = String(status || 'unknown').toLowerCase()

  const styles: Record<string, string> = {
    open: 'border-green-200 bg-green-50 text-green-700',
    assigned: 'border-blue-200 bg-blue-50 text-blue-700',
    completed: 'border-slate-200 bg-slate-50 text-slate-700',
    cancelled: 'border-red-200 bg-red-50 text-red-700',
    pending: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    accepted: 'border-green-200 bg-green-50 text-green-700',
    declined: 'border-red-200 bg-red-50 text-red-700',
    rejected: 'border-red-200 bg-red-50 text-red-700',
    hired: 'border-blue-200 bg-blue-50 text-blue-700',
    countered: 'border-blue-200 bg-blue-50 text-blue-700',
    not_selected: 'border-slate-200 bg-slate-50 text-slate-600',
    paid: 'border-green-200 bg-green-50 text-green-700',
    unpaid: 'border-orange-200 bg-orange-50 text-orange-700',
    released: 'border-green-200 bg-green-50 text-green-700',
    unknown: 'border-slate-200 bg-slate-50 text-slate-600',
  }

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${
        styles[value] || styles.unknown
      }`}
    >
      {value.replace('_', ' ')}
    </span>
  )
}

export function CrewCard({
  children,
  className = '',
  hover = true,
  glass = false,
}: {
  children: ReactNode
  className?: string
  hover?: boolean
  glass?: boolean
}) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-[2rem] border p-5 shadow-sm transition-all duration-300 sm:p-6
        ${hover ? 'hover:-translate-y-1 hover:shadow-2xl' : ''}
        ${
          glass
            ? 'border-white/50 bg-white/70 backdrop-blur-xl'
            : 'border-slate-200 bg-white'
        }
        ${className}
      `}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-blue-50/20" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow = 'CrewCall',
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  eyebrow?: string
}) {
  return (
    <div className="mb-6 rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-xl sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-600 sm:text-sm">
            {eyebrow}
          </p>

          <h1 className="mt-3 text-3xl font-black text-slate-950 sm:text-5xl">
            {title}
          </h1>

          {subtitle && (
            <p className="mt-3 max-w-3xl text-base text-slate-600 sm:text-lg">
              {subtitle}
            </p>
          )}
        </div>

        {action && <div className="flex shrink-0 flex-wrap gap-3">{action}</div>}
      </div>
    </div>
  )
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-black text-slate-950">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>

      {action && <div>{action}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  helper,
}: {
  label: string
  value: ReactNode
  helper?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
      {helper && <p className="mt-1 text-sm text-slate-500">{helper}</p>}
    </div>
  )
}

export function LoadingState({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="rounded-[2rem] border border-white/70 bg-white/90 p-6 text-sm font-bold text-slate-600 shadow-xl">
      {text}
    </div>
  )
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/90 p-8 text-center shadow-xl">
      <h2 className="text-2xl font-black text-slate-950">{title}</h2>
      {text && <p className="mt-2 text-slate-600">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function MobileActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-6xl gap-3">{children}</div>
    </div>
  )
}