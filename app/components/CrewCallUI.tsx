import Link from 'next/link'
import type { ReactNode } from 'react'

type ButtonProps = {
  children: ReactNode
  href?: string
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  className?: string
}

export function CrewButton({
  children,
  href,
  onClick,
  disabled = false,
  type = 'button',
  variant = 'primary',
  className = '',
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60'

  const styles = {
    primary:
      'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/20 hover:bg-cyan-300',
    secondary:
      'border border-white/10 bg-white/5 text-white hover:bg-white/10',
    danger:
      'bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-400',
    ghost:
      'border border-white/10 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white',
  }

  const classes = `${base} ${styles[variant]} ${className}`

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
    open: 'border-green-400/30 bg-green-400/10 text-green-300',
    assigned: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
    completed: 'border-slate-400/30 bg-slate-400/10 text-slate-300',
    cancelled: 'border-red-400/30 bg-red-400/10 text-red-300',
    pending: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300',
    accepted: 'border-green-400/30 bg-green-400/10 text-green-300',
    declined: 'border-red-400/30 bg-red-400/10 text-red-300',
    hired: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
    not_selected: 'border-slate-400/30 bg-slate-400/10 text-slate-400',
    paid: 'border-green-400/30 bg-green-400/10 text-green-300',
    unpaid: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
    unknown: 'border-white/10 bg-white/5 text-slate-300',
  }

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold capitalize ${
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
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur ${className}`}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          CrewCall
        </p>

        <h1 className="mt-2 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-4xl font-black text-transparent">
          {title}
        </h1>

        {subtitle && <p className="mt-2 text-sm text-slate-300">{subtitle}</p>}
      </div>

      {action && <div>{action}</div>}
    </div>
  )
}

export function LoadingState({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300 shadow-2xl">
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
    <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-center shadow-2xl">
      <h2 className="text-xl font-black text-white">{title}</h2>
      {text && <p className="mt-2 text-sm text-slate-300">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}