import type { ReactNode } from 'react'

type StatusBadgeTone =
  | 'green'
  | 'blue'
  | 'amber'
  | 'red'
  | 'purple'
  | 'slate'
  | 'cyan'

type StatusBadgeSize = 'sm' | 'md'

type StatusBadgeProps = {
  children: ReactNode
  tone?: StatusBadgeTone
  size?: StatusBadgeSize
  dot?: boolean
  pulse?: boolean
  icon?: ReactNode
  className?: string
}

const toneClasses: Record<
  StatusBadgeTone,
  {
    badge: string
    dot: string
  }
> = {
  green: {
    badge:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
    dot: 'bg-emerald-400',
  },
  blue: {
    badge:
      'border-blue-400/20 bg-blue-500/10 text-blue-300',
    dot: 'bg-blue-400',
  },
  amber: {
    badge:
      'border-amber-400/20 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-400',
  },
  red: {
    badge:
      'border-red-400/20 bg-red-500/10 text-red-300',
    dot: 'bg-red-400',
  },
  purple: {
    badge:
      'border-violet-400/20 bg-violet-500/10 text-violet-300',
    dot: 'bg-violet-400',
  },
  slate: {
    badge:
      'border-white/10 bg-white/[0.055] text-slate-300',
    dot: 'bg-slate-400',
  },
  cyan: {
    badge:
      'border-cyan-400/20 bg-cyan-500/10 text-cyan-300',
    dot: 'bg-cyan-400',
  },
}

const sizeClasses: Record<StatusBadgeSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
}

export default function StatusBadge({
  children,
  tone = 'slate',
  size = 'sm',
  dot = false,
  pulse = false,
  icon,
  className = '',
}: StatusBadgeProps) {
  const selectedTone = toneClasses[tone]

  return (
    <span
      className={[
        'inline-flex w-fit items-center gap-2 rounded-full border font-semibold',
        selectedTone.badge,
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {dot ? (
        <span className="relative flex h-2 w-2 shrink-0">
          {pulse ? (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${selectedTone.dot}`}
            />
          ) : null}

          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${selectedTone.dot}`}
          />
        </span>
      ) : null}

      {icon ? (
        <span className="flex shrink-0 items-center justify-center">
          {icon}
        </span>
      ) : null}

      <span>{children}</span>
    </span>
  )
}
