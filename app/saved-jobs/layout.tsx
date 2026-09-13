import type { ReactNode } from 'react'
import AuthGate from '@/app/components/AuthGate'

export default function SubscriptionProtectedLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <AuthGate>
      {children}
    </AuthGate>
  )
}
