import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="mt-3 text-gray-600">
        This page doesn’t exist or something broke.
      </p>

      <Link
        href="/jobs"
        className="mt-6 rounded-xl bg-black px-5 py-2 text-sm font-medium text-white"
      >
        Go to Jobs
      </Link>
    </main>
  )
}