import type { ReactNode } from 'react'

type CrewCardProps = {
  children: ReactNode
  className?: string
  hover?: boolean
  glass?: boolean
}

export function CrewCard({
  children,
  className = '',
  hover = true,
  glass = false,
}: CrewCardProps) {
  const base = `
    relative overflow-hidden
    rounded-[2rem]
    border
    p-5 sm:p-6
    shadow-sm
    transition-all duration-300
  `

  const hoverStyles = hover
    ? `
      hover:-translate-y-1
      hover:shadow-2xl
    `
    : ''

  const surface = glass
    ? `
      border-white/40
      bg-white/70
      backdrop-blur-xl
    `
    : `
      border-slate-200
      bg-white
    `

  return (
    <div
      className={`
        ${base}
        ${hoverStyles}
        ${surface}
        ${className}
      `}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-blue-50/20" />

      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}