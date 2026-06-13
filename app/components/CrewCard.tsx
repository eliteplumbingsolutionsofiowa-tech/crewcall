import type { ReactNode } from 'react'

type CrewCardTone =
  | 'default'
  | 'dark'
  | 'glass'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'

type CrewCardProps = {
  children: ReactNode
  className?: string
  tone?: CrewCardTone
  hover?: boolean
  padded?: boolean
}

export function CrewCard({
  children,
  className = '',
  tone = 'default',
  hover = false,
  padded = true,
}: CrewCardProps) {
  const base = `
    rounded-[2rem]
    border
    shadow-2xl
    backdrop-blur
    transition-all duration-200
  `

  const padding = padded ? 'p-5 md:p-6' : ''

  const hoverClass = hover
    ? 'hover:-translate-y-0.5 hover:shadow-cyan-500/10'
    : ''

  const tones: Record<CrewCardTone, string> = {
    default: `
      border-slate-200
      bg-white
      text-slate-950
      shadow-black/10
    `,
    dark: `
      border-white/10
      bg-slate-950/80
      text-white
      shadow-black/30
    `,
    glass: `
      border-white/10
      bg-white/10
      text-white
      shadow-black/20
    `,
    success: `
      border-emerald-400/20
      bg-emerald-400/10
      text-emerald-50
      shadow-emerald-500/10
    `,
    warning: `
      border-orange-400/20
      bg-orange-400/10
      text-orange-50
      shadow-orange-500/10
    `,
    danger: `
      border-red-400/20
      bg-red-400/10
      text-red-50
      shadow-red-500/10
    `,
    info: `
      border-cyan-400/20
      bg-cyan-400/10
      text-cyan-50
      shadow-cyan-500/10
    `,
  }

  return (
    <div className={`${base} ${padding} ${hoverClass} ${tones[tone]} ${className}`}>
      {children}
    </div>
  )
}