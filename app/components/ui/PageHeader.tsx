import type { ReactNode } from 'react'

type PageHeaderProps = {
  eyebrow?: string
  greeting?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export default function PageHeader({
  eyebrow,
  greeting,
  title,
  description,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 px-6 py-8 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(37,99,235,.45)] ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-cyan-500/5" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {eyebrow ? (
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-blue-300">
              {eyebrow}
            </p>
          ) : null}

          {greeting ? (
            <p className="mb-2 text-base text-slate-300">
              {greeting}
            </p>
          ) : null}

          <h1 className="text-4xl font-bold tracking-tight text-white">
            {title}
          </h1>

          {description ? (
            <p className="mt-3 max-w-2xl text-slate-400">
              {description}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex flex-wrap gap-3">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}
