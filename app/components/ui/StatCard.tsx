import type { ReactNode } from 'react'
import GlassCard from './GlassCard'

type StatCardTone =
  | 'blue'
  | 'green'
  | 'amber'
  | 'red'
  | 'purple'
  | 'slate'

type StatCardProps = {
  title: string
  value: string | number
  description?: string
  trend?: string
  trendDirection?: 'up' | 'down' | 'neutral'
  icon?: ReactNode
  tone?: StatCardTone
  className?: string
}

const toneClasses: Record<
  StatCardTone,
  {
    icon: string
    glow: string
  }
> = {
  blue: {
    icon: 'border-blue-400/20 bg-blue-500/10 text-blue-300',
    glow: 'bg-blue-500/10',
  },
  green: {
    icon: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
    glow: 'bg-emerald-500/10',
  },
  amber: {
    icon: 'border-amber-400/20 bg-amber-500/10 text-amber-300',
    glow: 'bg-amber-500/10',
  },
  red: {
    icon: 'border-red-400/20 bg-red-500/10 text-red-300',
    glow: 'bg-red-500/10',
  },
  purple: {
    icon: 'border-violet-400/20 bg-violet-500/10 text-violet-300',
    glow: 'bg-violet-500/10',
  },
  slate: {
    icon: 'border-white/10 bg-white/5 text-slate-300',
    glow: 'bg-white/5',
  },
}

const trendClasses = {
  up: 'border-emerald-400/15 bg-emerald-500/10 text-emerald-300',
  down: 'border-red-400/15 bg-red-500/10 text-red-300',
  neutral: 'border-white/10 bg-white/5 text-slate-300',
}

export default function StatCard({
  title,
  value,
  description,
  trend,
  trendDirection = 'neutral',
  icon,
  tone = 'blue',
  className = '',
}: StatCardProps) {
  const selectedTone = toneClasses[tone]

  return (
    <GlassCard
      padding="lg"
      hover
      accent
      className={`min-h-[180px] ${className}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-3xl ${selectedTone.glow}`}
      />

      <div className="relative flex h-full flex-col justify-between gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-400">
              {title}
            </p>

            <p className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {value}
            </p>
          </div>

          {icon ? (
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${selectedTone.icon}`}
            >
              {icon}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {trend ? (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${trendClasses[trendDirection]}`}
            >
              {trend}
            </span>
          ) : null}

          {description ? (
            <p className="text-sm text-slate-400">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </GlassCard>
  )
}
