import Link from 'next/link'
import type { ReactNode } from 'react'

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'danger'
  | 'ghost'
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
  const base = `
    inline-flex items-center justify-center gap-2
    rounded-2xl
    px-5 py-3
    text-sm sm:text-base
    font-black
    tracking-tight
    transition-all duration-200
    active:scale-[0.98]
    disabled:cursor-not-allowed
    disabled:opacity-50
    shadow-sm
    hover:shadow-lg
    focus:outline-none
    focus:ring-4
    focus:ring-blue-200
  `

  const width = fullWidth ? 'w-full' : ''

  const variants: Record<ButtonVariant, string> = {
    primary: `
      bg-blue-600
      text-white
      hover:bg-blue-700
      border border-blue-600
    `,

    secondary: `
      bg-orange-500
      text-white
      hover:bg-orange-600
      border border-orange-500
    `,

    outline: `
      border border-blue-600
      bg-white
      text-blue-600
      hover:bg-blue-50
    `,

    danger: `
      bg-red-600
      text-white
      hover:bg-red-700
      border border-red-600
    `,

    ghost: `
      border border-slate-200
      bg-white/80
      backdrop-blur-sm
      text-slate-700
      hover:bg-slate-100
    `,

    success: `
      bg-green-600
      text-white
      hover:bg-green-700
      border border-green-600
    `,
  }

  const classes = `
    ${base}
    ${width}
    ${variants[variant]}
    ${className}
  `

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {children}
    </button>
  )
}