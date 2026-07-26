import type { ReactNode } from 'react'
import SubscriptionGate from '@/app/components/SubscriptionGate'

export default function PostJobLayout({
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
