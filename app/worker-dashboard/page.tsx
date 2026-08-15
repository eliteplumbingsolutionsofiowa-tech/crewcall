import { redirect } from 'next/navigation'

export default function LegacyWorkerDashboardRedirect() {
  redirect('/worker/dashboard')
}
