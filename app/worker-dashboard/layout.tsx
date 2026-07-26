import type { ReactNode } from 'react'
import SubscriptionGate from '@/app/components/SubscriptionGate'

export default function SubscriptionProtectedLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <SubscriptionGate>
      {children}
    </SubscriptionGate>
  )
}
