import type { ReactNode } from 'react'
import SubscriptionGate from '@/app/components/SubscriptionGate'

export default function WorkersLayout({
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
