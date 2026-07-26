'use client'

import type {
  ButtonHTMLAttributes,
  ReactNode,
} from 'react'
import Link from 'next/link'

type PrimaryButtonSize = 'sm' | 'md' | 'lg'

type PrimaryButtonProps = {
  children: ReactNode
  href?: string
  icon?: ReactNode
  loading?: boolean
  fullWidth?: boolean
  size?: PrimaryButtonSize
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

const sizeClasses: Record<PrimaryButtonSize, string> = {
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
      className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
    />
  )
}

export default function PrimaryButton({
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
}: PrimaryButtonProps) {
  const sharedClasses = combineClasses(
    'group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl',
    'font-semibold text-white',
    'bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500',
    'shadow-[0_16px_40px_-18px_rgba(37,99,235,0.9)]',
    'transition-all duration-200 ease-out',
    'hover:-translate-y-0.5 hover:shadow-[0_22px_50px_-18px_rgba(37,99,235,1)]',
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
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-[120%]"
      />

      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading ? <LoadingSpinner /> : icon}

        <span>{loading ? 'Please wait...' : children}</span>
      </span>
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
