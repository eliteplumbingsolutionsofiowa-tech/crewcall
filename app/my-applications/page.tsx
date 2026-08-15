import { redirect } from 'next/navigation'

export default function MyApplicationsRedirectPage() {
  redirect('/worker/applications')
}
