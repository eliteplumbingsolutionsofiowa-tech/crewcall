'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type CompanyProfile = {
  id: string
  role: 'company' | 'worker' | null
  full_name: string | null
  company_name: string | null
  phone: string | null
  city: string | null
  state: string | null
  verified: boolean | null
}

type ReviewerProfile = {
  id: string
  full_name: string | null
}

type Review = {
  id: string
  rating: number | null
  comment: string | null
  created_at: string
  reviewer_id: string | null
}

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  status: string | null
}

type NoticeTone = 'error' | 'success' | 'info'

function normalize(value: string | null | undefined) {
  return String(value || '').toLowerCase().trim()
}

function formatDate(value: string) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'Date unavailable'
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getInitial(value: string | null | undefined) {
  return String(value || 'C').charAt(0).toUpperCase()
}

function formatLocation(city: string | null, state: string | null) {
  return [city, state].filter(Boolean).join(', ') || 'Location not listed'
}

export default function CompanyProfilePage() {
  const params = useParams()
  const companyId = String(params?.id || '')

  const [company, setCompany] = useState<CompanyProfile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [completedJobs, setCompletedJobs] = useState<Job[]>([])
  const [openJobs, setOpenJobs] = useState<Job[]>([])

  const [reviewerMap, setReviewerMap] = useState<
    Map<string, ReviewerProfile>
  >(new Map())

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [message, setMessage] = useState<string | null>(null)
  const [messageTone, setMessageTone] =
    useState<NoticeTone>('info')

  useEffect(() => {
    void loadCompany()
  }, [companyId])

  async function loadCompany(backgroundRefresh = false) {
    if (backgroundRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    if (!backgroundRefresh) {
      setMessage(null)
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          id,
          role,
          full_name,
          company_name,
          phone,
          city,
          state,
          verified
        `
        )
        .eq('id', companyId)
        .maybeSingle()

      if (error) {
        throw error
      }

      const companyData = data as CompanyProfile | null

      if (!companyData || companyData.role !== 'company') {
        throw new Error('Company profile not found.')
      }

      setCompany(companyData)

      const { data: reviewData, error: reviewError } =
        await supabase
          .from('reviews')
          .select(
            `
            id,
            rating,
            comment,
            created_at,
            reviewer_id
          `
          )
          .eq('reviewee_id', companyId)
          .order('created_at', {
            ascending: false,
          })

      if (reviewError) {
        throw reviewError
      }

      const safeReviews = (reviewData as Review[]) || []
      setReviews(safeReviews)

      const reviewerIds = Array.from(
        new Set(
          safeReviews
            .map((review) => review.reviewer_id)
            .filter((id): id is string => Boolean(id))
        )
      )

      if (reviewerIds.length > 0) {
        const { data: reviewerData, error: reviewerError } =
          await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', reviewerIds)

        if (reviewerError) {
          throw reviewerError
        }

        const nextReviewerMap = new Map(
          ((reviewerData as ReviewerProfile[]) || []).map(
            (reviewer) => [reviewer.id, reviewer]
          )
        )

        setReviewerMap(nextReviewerMap)
      } else {
        setReviewerMap(new Map())
      }

      const { data: completedData, error: completedError } =
        await supabase
          .from('jobs')
          .select('id, title, trade, location, status')
          .eq('company_id', companyId)
          .eq('status', 'completed')
          .order('id', {
            ascending: false,
          })

      if (completedError) {
        throw completedError
      }

      setCompletedJobs((completedData as Job[]) || [])

      const { data: openData, error: openError } =
        await supabase
          .from('jobs')
          .select('id, title, trade, location, status')
          .eq('company_id', companyId)
          .eq('status', 'open')
          .order('id', {
            ascending: false,
          })

      if (openError) {
        throw openError
      }

      setOpenJobs((openData as Job[]) || [])

      if (backgroundRefresh) {
        setMessage('Company profile refreshed.')
        setMessageTone('success')
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load company profile.'
      )
      setMessageTone('error')

      if (!backgroundRefresh) {
        setCompany(null)
        setReviews([])
        setCompletedJobs([])
        setOpenJobs([])
        setReviewerMap(new Map())
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const averageRating = useMemo(() => {
    const ratings = reviews
      .map((review) => Number(review.rating || 0))
      .filter((rating) => rating > 0)

    if (ratings.length === 0) {
      return 0
    }

    return (
      ratings.reduce((sum, rating) => sum + rating, 0) /
      ratings.length
    )
  }, [reviews])

  const ratingDisplay =
    averageRating > 0 ? averageRating.toFixed(1) : 'New'

  const recommendationPercent = useMemo(() => {
    const validRatings = reviews
      .map((review) => Number(review.rating || 0))
      .filter((rating) => rating > 0)

    if (validRatings.length === 0) {
      return null
    }

    const positiveRatings = validRatings.filter(
      (rating) => rating >= 4
    ).length

    return Math.round(
      (positiveRatings / validRatings.length) * 100
    )
  }, [reviews])

  if (loading) {
    return <LoadingState />
  }

  if (!company) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-red-400/20 bg-red-500/10 p-8 text-red-200">
            <p className="text-lg font-black">
              {message || 'Company not found.'}
            </p>

            <Link
              href="/jobs"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              Back to Jobs
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const companyName =
    company.company_name ||
    company.full_name ||
    'CrewCall Company'

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8 lg:px-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-48 top-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute -right-48 top-56 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-violet-500/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 text-sm font-black text-cyan-300 transition hover:text-cyan-200"
          >
            ← Back to Jobs
          </Link>

          <button
            type="button"
            onClick={() => void loadCompany(true)}
            disabled={refreshing}
            className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-sm font-black text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing
              ? 'Refreshing...'
              : 'Refresh Profile'}
          </button>
        </div>

        {message ? (
          <Notice tone={messageTone}>{message}</Notice>
        ) : null}

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

          <div className="p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col justify-between gap-8 xl:flex-row xl:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-400/20 via-blue-500/15 to-violet-500/15 text-4xl font-black text-cyan-300 shadow-xl shadow-cyan-950/20">
                    {getInitial(companyName)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label="Company Profile"
                        tone="cyan"
                      />

                      {company.verified ? (
                        <StatusBadge
                          label="Verified Company"
                          tone="green"
                        />
                      ) : (
                        <StatusBadge
                          label="Not Yet Verified"
                          tone="slate"
                        />
                      )}
                    </div>

                    <h1 className="mt-4 break-words text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                      {companyName}
                    </h1>

                    <p className="mt-3 text-base font-semibold text-slate-300 sm:text-lg">
                      {formatLocation(
                        company.city,
                        company.state
                      )}
                    </p>

                    {company.phone ? (
                      <a
                        href={`tel:${company.phone}`}
                        className="mt-2 inline-flex text-sm font-black text-cyan-300 transition hover:text-cyan-200"
                      >
                        {company.phone}
                      </a>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        Phone number not listed
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <QuickStat
                    label="Open Jobs"
                    value={String(openJobs.length)}
                    description="Hiring now"
                    tone="cyan"
                  />

                  <QuickStat
                    label="Completed Jobs"
                    value={String(completedJobs.length)}
                    description="Finished through CrewCall"
                    tone="blue"
                  />

                  <QuickStat
                    label="Reviews"
                    value={String(reviews.length)}
                    description="Worker feedback"
                    tone="violet"
                  />
                </div>
              </div>

              <div className="w-full shrink-0 xl:w-80">
                <div className="rounded-[2rem] border border-amber-400/20 bg-amber-500/10 p-6 text-center">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                    Company Rating
                  </p>

                  <p className="mt-4 text-5xl font-black tracking-tight text-white">
                    ★ {ratingDisplay}
                  </p>

                  <p className="mt-2 text-sm font-semibold text-amber-100/60">
                    {reviews.length > 0
                      ? `Based on ${reviews.length} ${
                          reviews.length === 1
                            ? 'review'
                            : 'reviews'
                        }`
                      : 'No ratings yet'}
                  </p>
                </div>

                <div className="mt-3 rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Worker Recommendation
                  </p>

                  <p className="mt-3 text-3xl font-black text-white">
                    {recommendationPercent !== null
                      ? `${recommendationPercent}%`
                      : 'New'}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Percentage of ratings that were four stars or
                    higher.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-xl shadow-black/20 backdrop-blur-xl">
            <SectionHeader
              eyebrow="Current Opportunities"
              title="Open Jobs"
              description="Review work this company is actively hiring for."
              badge={`${openJobs.length} ${
                openJobs.length === 1 ? 'job' : 'jobs'
              }`}
            />

            <div className="p-5 sm:p-6">
              {openJobs.length === 0 ? (
                <EmptyState
                  icon="J"
                  title="No open jobs"
                  description="This company is not currently advertising any open work."
                />
              ) : (
                <div className="space-y-4">
                  {openJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="group block overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 transition hover:-translate-y-0.5 hover:border-cyan-400/25 hover:bg-slate-950/75"
                    >
                      <div className="h-1 bg-cyan-400" />

                      <div className="p-5">
                        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge
                                label="Open"
                                tone="cyan"
                              />

                              <StatusBadge
                                label={
                                  job.trade ||
                                  'Trade not listed'
                                }
                                tone="violet"
                              />
                            </div>

                            <h3 className="mt-4 text-2xl font-black text-white transition group-hover:text-cyan-300">
                              {job.title || 'Untitled Job'}
                            </h3>

                            <p className="mt-2 text-sm font-semibold text-slate-400">
                              {job.location ||
                                'Location not listed'}
                            </p>
                          </div>

                          <span className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-black text-cyan-200">
                            View Job →
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-xl shadow-black/20 backdrop-blur-xl">
            <SectionHeader
              eyebrow="Company History"
              title="Completed Jobs"
              description="Work this company has completed through the platform."
              badge={`${completedJobs.length} completed`}
            />

            <div className="p-5 sm:p-6">
              {completedJobs.length === 0 ? (
                <EmptyState
                  icon="C"
                  title="No completed jobs yet"
                  description="Completed CrewCall jobs will appear here."
                />
              ) : (
                <div className="space-y-3">
                  {completedJobs.slice(0, 8).map((job) => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-slate-950/55 p-5 transition hover:border-emerald-400/20 hover:bg-slate-950/75 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="text-lg font-black text-white">
                          {job.title || 'Untitled Job'}
                        </p>

                        <p className="mt-2 text-sm text-slate-400">
                          {job.trade || 'Trade not listed'}
                          {' • '}
                          {job.location ||
                            'Location not listed'}
                        </p>
                      </div>

                      <StatusBadge
                        label="Completed"
                        tone="green"
                      />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-xl shadow-black/20 backdrop-blur-xl">
          <SectionHeader
            eyebrow="Worker Feedback"
            title="Reviews"
            description="Ratings and comments from CrewCall users who worked with this company."
            badge={`${reviews.length} ${
              reviews.length === 1
                ? 'review'
                : 'reviews'
            }`}
          />

          <div className="p-5 sm:p-6">
            {reviews.length === 0 ? (
              <EmptyState
                icon="R"
                title="No reviews yet"
                description="This company has not received any worker reviews yet."
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {reviews.map((review) => {
                  const reviewer = review.reviewer_id
                    ? reviewerMap.get(review.reviewer_id)
                    : null

                  const reviewerName =
                    reviewer?.full_name || 'CrewCall User'

                  const rating = Math.max(
                    0,
                    Math.min(5, Number(review.rating || 0))
                  )

                  return (
                    <article
                      key={review.id}
                      className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 sm:p-6"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-lg font-black text-cyan-300">
                            {getInitial(reviewerName)}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-black text-white">
                              {reviewerName}
                            </p>

                            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                              {formatDate(review.created_at)}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm font-black text-amber-300">
                          ★ {rating || 0}
                        </div>
                      </div>

                      <div className="mt-4 flex gap-1 text-lg text-amber-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={
                              star <= rating
                                ? 'text-amber-400'
                                : 'text-slate-700'
                            }
                          >
                            ★
                          </span>
                        ))}
                      </div>

                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                        {review.comment ||
                          'The reviewer did not leave a written comment.'}
                      </p>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function LoadingState() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14">
                <span className="absolute inset-0 animate-ping rounded-2xl bg-cyan-400/20" />
                <span className="absolute inset-0 animate-pulse rounded-2xl bg-cyan-400/15" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                  CrewCall Company
                </p>

                <p className="mt-1 text-lg font-bold text-white">
                  Loading company profile...
                </p>
              </div>
            </div>

            <div className="mt-8 h-80 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
              <div className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function SectionHeader({
  eyebrow,
  title,
  description,
  badge,
}: {
  eyebrow: string
  title: string
  description: string
  badge?: string
}) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:p-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          {eyebrow}
        </p>

        <h2 className="mt-2 text-2xl font-black text-white">
          {title}
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          {description}
        </p>
      </div>

      {badge ? (
        <span className="w-fit rounded-full border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-black text-slate-300">
          {badge}
        </span>
      ) : null}
    </div>
  )
}

function QuickStat({
  label,
  value,
  description,
  tone,
}: {
  label: string
  value: string
  description: string
  tone: 'cyan' | 'blue' | 'violet'
}) {
  const classes = {
    cyan:
      'border-cyan-400/20 bg-cyan-500/10 text-cyan-300',
    blue:
      'border-blue-400/20 bg-blue-500/10 text-blue-300',
    violet:
      'border-violet-400/20 bg-violet-500/10 text-violet-300',
  }

  return (
    <div
      className={`rounded-3xl border p-5 ${classes[tone]}`}
    >
      <p className="text-xs font-black uppercase tracking-[0.16em] opacity-70">
        {label}
      </p>

      <p className="mt-3 text-4xl font-black text-white">
        {value}
      </p>

      <p className="mt-2 text-sm opacity-70">
        {description}
      </p>
    </div>
  )
}

function StatusBadge({
  label,
  tone,
}: {
  label: string
  tone: 'cyan' | 'green' | 'violet' | 'slate'
}) {
  const classes = {
    cyan:
      'border-cyan-400/20 bg-cyan-500/10 text-cyan-300',
    green:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
    violet:
      'border-violet-400/20 bg-violet-500/10 text-violet-300',
    slate:
      'border-white/10 bg-white/[0.055] text-slate-300',
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wider',
        classes[tone],
      ].join(' ')}
    >
      <span
        className={[
          'h-2 w-2 rounded-full',
          tone === 'cyan'
            ? 'bg-cyan-400'
            : tone === 'green'
              ? 'bg-emerald-400'
              : tone === 'violet'
                ? 'bg-violet-400'
                : 'bg-slate-400',
        ].join(' ')}
      />

      {label}
    </span>
  )
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/40 px-6 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-xl font-black text-cyan-300">
        {icon}
      </div>

      <h3 className="mt-5 text-xl font-black text-white">
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
        {description}
      </p>
    </div>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: NoticeTone
  children: React.ReactNode
}) {
  const classes = {
    error:
      'border-red-400/20 bg-red-500/10 text-red-200',
    success:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    info:
      'border-blue-400/20 bg-blue-500/10 text-blue-200',
  }

  return (
    <div
      className={[
        'rounded-2xl border p-4 text-sm font-bold',
        classes[tone],
      ].join(' ')}
    >
      {children}
    </div>
  )
}