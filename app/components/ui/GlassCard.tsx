'use client'

import type {
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from 'react'

type GlassCardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl'

type GlassCardProps = {
  children: ReactNode
  className?: string
  padding?: GlassCardPadding
  hover?: boolean
  clickable?: boolean
  accent?: boolean
  onClick?: () => void
} & Omit<HTMLAttributes<HTMLDivElement>, 'onClick'>

const paddingClasses: Record<GlassCardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
  xl: 'p-8',
}

function combineClasses(
  ...classes: Array<string | false | null | undefined>
) {
  return classes.filter(Boolean).join(' ')
}

export default function GlassCard({
  children,
  className = '',
  padding = 'lg',
  hover = false,
  clickable = false,
  accent = false,
  onClick,
  tabIndex,
  role,
  onKeyDown,
  ...props
}: GlassCardProps) {
  const isInteractive = clickable || Boolean(onClick)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)

    if (
      !event.defaultPrevented &&
      isInteractive &&
      onClick &&
      (event.key === 'Enter' || event.key === ' ')
    ) {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      {...props}
      role={role ?? (isInteractive ? 'button' : undefined)}
      tabIndex={tabIndex ?? (isInteractive ? 0 : undefined)}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={combineClasses(
        'relative overflow-hidden rounded-3xl border',
        'border-white/10 bg-slate-900/65',
        'shadow-[0_24px_80px_-40px_rgba(37,99,235,0.55)]',
        'backdrop-blur-xl',
        'transition-all duration-300 ease-out',
        accent &&
          'before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-400/70 before:to-transparent',
        hover &&
          'hover:-translate-y-1 hover:border-blue-400/30 hover:bg-slate-900/80 hover:shadow-[0_30px_90px_-38px_rgba(37,99,235,0.75)]',
        isInteractive &&
          'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
        paddingClasses[padding],
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.055] via-transparent to-blue-500/[0.035]"
      />

      <div className="relative z-10">{children}</div>
    </div>
  )
}
