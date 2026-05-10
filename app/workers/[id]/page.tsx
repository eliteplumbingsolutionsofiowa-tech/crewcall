'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type WorkerProfile = {
  id: string
  role: string | null
  full_name: string | null
  company_name: string | null
  phone: string | null
  city: string | null
  state: string | null
  trade: string | null
  insurance_provider: string | null
  insurance_policy_number: string | null
  years_experience: string | null
  job_experience: string | null
  liability_form_signed: boolean | null
  stripe_account_id: string | null
}

type Review = {
  id: string
  rating: number | null
  comment: string | null
  created_at: string
  reviewer_name: string | null
}

type CompletedJob = {
  id: string
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

export default function WorkerProfilePage() {
  const params = useParams()
  const router = useRouter()
  const workerId = String(params.id || '')

  const [worker, setWorker] = useState<WorkerProfile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadWorker()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId])

  async function loadWorker() {
    setLoading(true)
    setMessage(null)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', workerId)
      .maybeSingle()

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    if (!data || data.role !== 'worker') {
      setMessage('Worker profile not found.')
      setLoading(false)
      return
    }

    setWorker(data as WorkerProfile)

    const { data: reviewData } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        reviewer_name
      `)
      .eq('reviewed_user_id', workerId)
      .order('created_at', { ascending: false })

    setReviews((reviewData as Review[]) || [])

    const { data: completedData } = await supabase
      .from('jobs')
      .select('id')
      .eq('assigned_worker_id', workerId)
      .eq('status', 'completed')

    setCompletedJobs((completedData as CompletedJob[]) || [])

    setLoading(false)
  }

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0

    const validRatings = reviews
      .map((review) => Number(review.rating || 0))
      .filter((rating) => rating > 0)

    if (validRatings.length === 0) return 0

    const total = validRatings.reduce((sum, rating) => sum + rating, 0)

    return total / validRatings.length
  }, [reviews])

  const ratingDisplay =
    averageRating > 0 ? averageRating.toFixed(1) : 'New'

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-8">
          Loading worker profile...
        </div>
      </main>
    )
  }

  if (!worker) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-400/20 bg-red-400/10 p-8">
          <p className="text-red-200">
            {message || 'Worker not found.'}
          </p>

          <button
            onClick={() => router.back()}
            className="mt-5 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300"
          >
            Go Back
          </button>
        </div>
      </main>
    )
  }

  const completedCount = completedJobs.length
  const reviewCount = reviews.length

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/jobs" className="text-sm font-semibold text-cyan-300">
          ← Back to jobs
        </Link>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Worker Profile
              </p>

              <h1 className="mt-3 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-5xl font-black text-transparent">
                {worker.full_name || 'Unnamed Worker'}
              </h1>

              <p className="mt-4 text-xl text-slate-300">
                {worker.trade || 'Trade not listed'}
              </p>

              <p className="mt-2 text-sm text-slate-400">
                {[worker.city, worker.state]
                  .filter(Boolean)
                  .join(', ') || 'Location not listed'}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Badge label={`${completedCount} Jobs Completed`} />
                <Badge label={`${reviewCount} Reviews`} />

                {worker.stripe_account_id && (
                  <Badge label="Payout Verified" color="green" />
                )}

                {worker.liability_form_signed && (
                  <Badge label="Compliance Verified" color="cyan" />
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 px-8 py-7 text-center shadow-xl shadow-cyan-500/10">
              <div className="text-6xl font-black text-cyan-300">
                ★ {ratingDisplay}
              </div>

              <p className="mt-2 text-sm uppercase tracking-[0.2em] text-slate-300">
                Worker Rating
              </p>

              <p className="mt-3 text-sm text-slate-400">
                Based on {reviewCount} review
                {reviewCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-4">
          <StatCard
            title="Completed Jobs"
            value={String(completedCount)}
          />

          <StatCard
            title="Average Rating"
            value={`★ ${ratingDisplay}`}
          />

          <StatCard
            title="Experience"
            value={
              worker.years_experience
                ? `${worker.years_experience} yrs`
                : 'N/A'
            }
          />

          <StatCard
            title="Insurance"
            value={worker.insurance_provider ? 'Verified' : 'Not Added'}
          />
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <h2 className="text-2xl font-black">Worker Experience</h2>

          <p className="mt-5 whitespace-pre-wrap leading-8 text-slate-300">
            {worker.job_experience ||
              'This worker has not added job experience yet.'}
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <h2 className="text-2xl font-black">Compliance Details</h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Detail
              label="Insurance Provider"
              value={worker.insurance_provider}
            />

            <Detail
              label="Policy Number"
              value={worker.insurance_policy_number}
            />

            <Detail label="Phone" value={worker.phone} />

            <Detail
              label="Location"
              value={[worker.city, worker.state]
                .filter(Boolean)
                .join(', ')}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Reviews</h2>

              <p className="mt-1 text-sm text-slate-400">
                Reputation and completed work feedback.
              </p>
            </div>

            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-200">
              ★ {ratingDisplay}
            </div>
          </div>

          {reviews.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-300">
              No reviews yet.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-2xl border border-white/10 bg-slate-900 p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="text-xl font-black text-yellow-300">
                          ★ {review.rating || 5}
                        </div>

                        <div className="text-sm text-slate-400">
                          {formatDate(review.created_at)}
                        </div>
                      </div>

                      <p className="mt-4 whitespace-pre-wrap text-slate-300">
                        {review.comment || 'No comment left.'}
                      </p>

                      <p className="mt-4 text-sm text-slate-500">
                        — {review.reviewer_name || 'CrewCall User'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/messages"
            className="rounded-2xl bg-cyan-400 px-6 py-3 text-center font-bold text-slate-950 shadow-lg shadow-cyan-400/20 hover:bg-cyan-300"
          >
            Message Worker
          </Link>

          <Link
            href="/my-jobs"
            className="rounded-2xl border border-white/10 px-6 py-3 text-center font-semibold text-white hover:bg-white/10"
          >
            Invite to Job
          </Link>
        </div>
      </div>
    </main>
  )
}

function Badge({
  label,
  color = 'default',
}: {
  label: string
  color?: 'default' | 'green' | 'cyan'
}) {
  const styles = {
    default:
      'border-white/10 bg-white/5 text-white',
    green:
      'border-green-400/20 bg-green-400/10 text-green-200',
    cyan:
      'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
  }

  return (
    <div
      className={`rounded-2xl border px-4 py-2 text-sm font-bold ${styles[color]}`}
    >
      {label}
    </div>
  )
}

function StatCard({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
      <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
        {title}
      </p>

      <p className="mt-4 text-3xl font-black text-white">
        {value}
      </p>
    </div>
  )
}

function Detail({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>

      <p className="mt-2 font-semibold text-white">
        {value || 'Not listed'}
      </p>
    </div>
  )
}