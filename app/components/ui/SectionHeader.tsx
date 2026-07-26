import type { ReactNode } from 'react'

type SectionHeaderProps = {
  title: string
  description?: string
  eyebrow?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}

export default function SectionHeader({
  title,
  description,
  eyebrow,
  action,
  icon,
  className = '',
}: SectionHeaderProps) {
  return (
    <div
      className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
            {icon}
          </div>
        ) : null}

        <div>
          {eyebrow ? (
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
              {eyebrow}
            </p>
          ) : null}

          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            {title}
          </h2>

          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-400">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {action ? (
        <div className="flex shrink-0 items-center gap-3">
          {action}
        </div>
      ) : null}
    </div>
  )
}
