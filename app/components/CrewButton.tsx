import Link from 'next/link'
import type { ReactNode } from 'react'

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'danger'
  | 'ghost'
  | 'success'
  | 'dark'
  | 'light'

type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = {
  children: ReactNode
  href?: string
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  fullWidth?: boolean
  title?: string
}

export function CrewButton({
  children,
  href,
  onClick,
  disabled = false,
  type = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  fullWidth = false,
  title,
}: ButtonProps) {
  const base = `
    inline-flex items-center justify-center gap-2
    rounded-2xl
    font-black
    tracking-tight
    transition-all duration-200
    active:scale-[0.98]
    disabled:cursor-not-allowed
    disabled:opacity-50
    focus:outline-none
    focus:ring-4
    whitespace-nowrap
  `

  const sizes: Record<ButtonSize, string> = {
    sm: 'px-4 py-2 text-xs sm:text-sm',
    md: 'px-5 py-3 text-sm sm:text-base',
    lg: 'px-6 py-4 text-base sm:text-lg',
  }

  const width = fullWidth ? 'w-full' : ''

  const variants: Record<ButtonVariant, string> = {
    primary: `
      border border-cyan-300/30
      bg-gradient-to-r from-cyan-400 to-blue-500
      text-slate-950
      shadow-lg shadow-cyan-500/20
      hover:from-cyan-300 hover:to-blue-400
      hover:shadow-cyan-500/30
      focus:ring-cyan-300/30
    `,
    secondary: `
      border border-orange-300/30
      bg-gradient-to-r from-orange-400 to-amber-500
      text-slate-950
      shadow-lg shadow-orange-500/20
      hover:from-orange-300 hover:to-amber-400
      hover:shadow-orange-500/30
      focus:ring-orange-300/30
    `,
    outline: `
      border border-cyan-300/30
      bg-white/5
      text-cyan-100
      shadow-sm
      backdrop-blur
      hover:bg-cyan-400/10
      hover:text-cyan-50
      focus:ring-cyan-300/25
    `,
    danger: `
      border border-red-300/30
      bg-gradient-to-r from-red-500 to-orange-500
      text-white
      shadow-lg shadow-red-500/20
      hover:from-red-400 hover:to-orange-400
      hover:shadow-red-500/30
      focus:ring-red-300/30
    `,
    ghost: `
      border border-white/10
      bg-white/10
      text-white
      shadow-sm
      backdrop-blur
      hover:border-white/20
      hover:bg-white/15
      focus:ring-white/20
    `,
    success: `
      border border-emerald-300/30
      bg-gradient-to-r from-emerald-400 to-green-500
      text-slate-950
      shadow-lg shadow-emerald-500/20
      hover:from-emerald-300 hover:to-green-400
      hover:shadow-emerald-500/30
      focus:ring-emerald-300/30
    `,
    dark: `
      border border-white/10
      bg-slate-950
      text-white
      shadow-lg shadow-black/20
      hover:bg-slate-900
      focus:ring-slate-400/20
    `,
    light: `
      border border-slate-200
      bg-white
      text-slate-950
      shadow-lg shadow-black/10
      hover:bg-slate-100
      focus:ring-slate-300/40
    `,
  }

  const classes = `${base} ${sizes[size]} ${width} ${variants[variant]} ${className}`

  if (href) {
    return (
      <Link href={href} className={classes} title={title}>
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
      title={title}
    >
      {children}
    </button>
  )
}