import type { ReactNode } from 'react'

type CrewCardProps = {
  children: ReactNode
  className?: string
}

export function CrewCard({ children, className = '' }: CrewCardProps) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}