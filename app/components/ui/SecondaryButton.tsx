'use client'

import type {
  ButtonHTMLAttributes,
  ReactNode,
} from 'react'
import Link from 'next/link'

type SecondaryButtonSize = 'sm' | 'md' | 'lg'

type SecondaryButtonProps = {
  children: ReactNode
  href?: string
  icon?: ReactNode
  loading?: boolean
  fullWidth?: boolean
  size?: SecondaryButtonSize
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

const sizeClasses: Record<SecondaryButtonSize, string> = {
  sm: 'min-h-10 px-4 py-2 text-sm',
  md: 'min-h-12 px-5 py-3 text-sm',
  lg: 'min-h-14 px-6 py-3.5 text-base',
}

function combineClasses(
  ...classes: Array<string | false | null | undefined>
) {
  return classes.filter(Boolean).join(' ')
}

function LoadingSpinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400/40 border-t-white"
    />
  )
}

export default function SecondaryButton({
  children,
  href,
  icon,
  loading = false,
  fullWidth = false,
  size = 'md',
  className = '',
  disabled,
  type = 'button',
  ...buttonProps
}: SecondaryButtonProps) {
  const sharedClasses = combineClasses(
    'inline-flex items-center justify-center gap-2 rounded-2xl border',
    'border-white/10 bg-white/[0.055] font-semibold text-slate-100',
    'shadow-[0_14px_35px_-24px_rgba(15,23,42,0.95)] backdrop-blur-xl',
    'transition-all duration-200 ease-out',
    'hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-blue-500/10 hover:text-white',
    'active:translate-y-0 active:scale-[0.98]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    fullWidth && 'w-full',
    sizeClasses[size],
    className
  )

  const content = (
    <>
      {loading ? <LoadingSpinner /> : icon}

      <span>{loading ? 'Please wait...' : children}</span>
    </>
  )

  if (href && !disabled && !loading) {
    return (
      <Link href={href} className={sharedClasses}>
        {content}
      </Link>
    )
  }

  return (
    <button
      {...buttonProps}
      type={type}
      disabled={disabled || loading}
      className={sharedClasses}
    >
      {content}
    </button>
  )
}
