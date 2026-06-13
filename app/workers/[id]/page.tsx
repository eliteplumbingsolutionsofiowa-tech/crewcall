'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type ReviewRow = Database['public']['Tables']['reviews']['Row']
type JobRow = Database['public']['Tables']['jobs']['Row']
type ProfileFileRow = Database['public']['Tables']['profile_files']['Row']
type SavedWorkerRow = Database['public']['Tables']['saved_workers']['Row']
type SavedWorkerInsert =
  Database['public']['Tables']['saved_workers']['Insert']
type JobInviteInsert =
  Database['public']['Tables']['job_invites']['Insert']
type NotificationInsert =
  Database['public']['Tables']['notifications']['Insert']

type CurrentProfile = Pick<ProfileRow, 'id' | 'role'>

type WorkerProfile = Pick<
  ProfileRow,
  | 'id'
  | 'role'
  | 'full_name'
  | 'company_name'
  | 'phone'
  | 'city'
  | 'state'
  | 'trade'
  | 'insurance_provider'
  | 'insurance_policy_number'
  | 'years_experience'
  | 'job_experience'
  | 'liability_form_signed'
  | 'stripe_account_id'
  | 'available_for_work'
  | 'currently_working'
  | 'booked_until'
  | 'is_online'
  | 'last_seen'
>

type Review = Pick<
  ReviewRow,
  'id' | 'rating' | 'comment' | 'created_at' | 'reviewer_id'
> & {
  reviewer_name: string | null
}

type CompletedJob = Pick<JobRow, 'id'>

type CompanyJob = Pick<
  JobRow,
  'id' | 'title' | 'trade' | 'location' | 'status'
>

type ProfileFile = Pick<
  ProfileFileRow,
  'id' | 'user_id' | 'category' | 'file_url' | 'file_name' | 'created_at'
>

type SavedWorker = Pick<
  SavedWorkerRow,
  'id' | 'company_id' | 'worker_id' | 'created_at'
>

type ReviewerProfile = Pick<ProfileRow, 'id' | 'full_name' | 'company_name'>

const workerSelect = `
  id,
  role,
  full_name,
  company_name,
  phone,
  city,
  state,
  trade,
  insurance_provider,
  insurance_policy_number,
  years_experience,
  job_experience,
  liability_form_signed,
  stripe_account_id,
  available_for_work,
  currently_working,
  booked_until,
  is_online,
  last_seen
`

export default function WorkerProfilePage() {
  const params = useParams()
  const router = useRouter()
  const workerId = String(params?.id || '')

  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(
    null
  )
  const [worker, setWorker] = useState<WorkerProfile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([])
  const [companyJobs, setCompanyJobs] = useState<CompanyJob[]>([])
  const [profileFiles, setProfileFiles] = useState<ProfileFile[]>([])
  const [savedWorker, setSavedWorker] = useState<SavedWorker | null>(null)
  const [selectedJobId, setSelectedJobId] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingWorker, setSavingWorker] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    void loadWorker()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId])

  async function loadWorker() {
    setLoading(true)
    setMessage(null)
    setSuccessMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .maybeSingle()

      setCurrentProfile(profileData)

      const { data: savedData } = await supabase
        .from('saved_workers')
        .select('id, company_id, worker_id, created_at')
        .eq('company_id', user.id)
        .eq('worker_id', workerId)
        .maybeSingle()

      setSavedWorker(savedData)

      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, title, trade, location, status')
        .eq('company_id', user.id)
        .in('status', ['open', 'active', 'assigned'])
        .order('created_at', { ascending: false })

      setCompanyJobs(jobsData || [])
    }

    const { data, error } = await supabase
      .from('profiles')
      .select(workerSelect)
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

    setWorker(data)

    const { data: fileData } = await supabase
      .from('profile_files')
      .select('id, user_id, category, file_url, file_name, created_at')
      .eq('user_id', workerId)
      .order('created_at', { ascending: false })

    setProfileFiles(fileData || [])

    const { data: reviewData } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, reviewer_id')
      .eq('reviewee_id', workerId)
      .order('created_at', { ascending: false })

    const rawReviews = reviewData || []

    const reviewerIds = Array.from(
      new Set(
        rawReviews
          .map((review) => review.reviewer_id)
          .filter((id): id is string => Boolean(id))
      )
    )

    let reviewerMap = new Map<string, ReviewerProfile>()

    if (reviewerIds.length > 0) {
      const { data: reviewerData } = await supabase
        .from('profiles')
        .select('id, full_name, company_name')
        .in('id', reviewerIds)

      reviewerMap = new Map(
        (reviewerData || []).map((reviewer) => [reviewer.id, reviewer])
      )
    }

    setReviews(
      rawReviews.map((review) => {
        const reviewer = review.reviewer_id
          ? reviewerMap.get(review.reviewer_id)
          : null

        return {
          ...review,
          reviewer_name:
            reviewer?.company_name || reviewer?.full_name || 'CrewCall User',
        }
      })
    )

    const { data: completedData } = await supabase
      .from('jobs')
      .select('id')
      .eq('assigned_worker_id', workerId)
      .eq('status', 'completed')

    setCompletedJobs(completedData || [])
    setLoading(false)
  }

  async function toggleSavedWorker() {
    if (!currentProfile?.id || currentProfile.role !== 'company') {
      setMessage('Only company accounts can save workers.')
      return
    }

    setSavingWorker(true)
    setMessage(null)
    setSuccessMessage(null)

    if (savedWorker) {
      const { error } = await supabase
        .from('saved_workers')
        .delete()
        .eq('id', savedWorker.id)

      if (error) {
        setMessage(error.message)
        setSavingWorker(false)
        return
      }

      setSavedWorker(null)
      setSuccessMessage('Worker removed from saved list.')
      setSavingWorker(false)
      return
    }

    const payload: SavedWorkerInsert = {
      company_id: currentProfile.id,
      worker_id: workerId,
    }

    const { data, error } = await supabase
      .from('saved_workers')
      .insert(payload)
      .select('id, company_id, worker_id, created_at')
      .single()

    if (error) {
      setMessage(error.message)
      setSavingWorker(false)
      return
    }

    setSavedWorker(data)
    setSuccessMessage('Worker saved.')
    setSavingWorker(false)
  }

  async function sendInvite() {
    if (!currentProfile?.id || currentProfile.role !== 'company') {
      setMessage('Only company accounts can invite workers.')
      return
    }

    if (!selectedJobId) {
      setMessage('Choose a job before sending the invite.')
      return
    }

    setSendingInvite(true)
    setMessage(null)
    setSuccessMessage(null)

    const selectedJob = companyJobs.find((job) => job.id === selectedJobId)

    const invitePayload: JobInviteInsert = {
      company_id: currentProfile.id,
      worker_id: workerId,
      job_id: selectedJobId,
      status: 'pending',
      company_seen: true,
      worker_seen: false,
    }

    const { error } = await supabase.from('job_invites').insert(invitePayload)

    if (error) {
      setMessage(error.message)
      setSendingInvite(false)
      return
    }

    const notificationPayload: NotificationInsert = {
      user_id: workerId,
      type: 'invite',
      title: 'New Job Invite',
      body: `You were invited to ${selectedJob?.title || 'a job'}.`,
      link_url: '/worker/invites',
      is_read: false,
      read: false,
    }

    await supabase.from('notifications').insert(notificationPayload)

    setSuccessMessage('Invite sent to worker.')
    setSendingInvite(false)
  }

  const averageRating = useMemo(() => {
    const validRatings = reviews
      .map((review) => Number(review.rating || 0))
      .filter((rating) => rating > 0)

    if (validRatings.length === 0) return 0

    return validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length
  }, [reviews])

  const ratingDisplay = averageRating > 0 ? averageRating.toFixed(1) : 'New'
  const completedCount = completedJobs.length
  const reviewCount = reviews.length
  const profilePhoto = profileFiles.find((file) => file.category === 'profile_photo')
  const docs = profileFiles.filter((file) => file.category !== 'profile_photo')
  const isCompany = currentProfile?.role === 'company'

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl">
          Loading worker profile...
        </div>
      </main>
    )
  }

  if (!worker) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-400/20 bg-red-400/10 p-8">
          <p className="text-red-200">{message || 'Worker not found.'}</p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-5 rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300"
          >
            Go Back
          </button>
        </div>
      </main>
    )
  }

  const workerName = worker.full_name || worker.company_name || 'Worker Profile'

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link href="/workers" className="text-sm font-black text-cyan-300">
          ← Back to workers
        </Link>

        {message && (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100">
            {message}
          </div>
        )}

        {successMessage && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-4 text-sm font-bold text-emerald-100">
            {successMessage}
          </div>
        )}

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur">
          <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 p-6 md:p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                {profilePhoto?.file_url ? (
                  <img
                    src={profilePhoto.file_url}
                    alt={workerName}
                    className="h-28 w-28 rounded-[2rem] border border-white/10 object-cover shadow-xl"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] bg-gradient-to-br from-cyan-400 to-blue-600 text-5xl font-black text-white shadow-xl">
                    {workerName.charAt(0)}
                  </div>
                )}

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                    Worker Profile
                  </p>

                  <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                    {workerName}
                  </h1>

                  <p className="mt-3 text-lg font-bold text-slate-300">
                    {worker.trade || 'Trade not listed'}
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-400">
                    {[worker.city, worker.state].filter(Boolean).join(', ') ||
                      'Location not listed'}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge
                      label={presenceLabel(worker)}
                      color={isActuallyOnline(worker) ? 'lime' : 'default'}
                    />
                    <Badge
                      label={availabilityLabel(worker)}
                      color={isAvailable(worker) ? 'green' : 'orange'}
                    />
                    {worker.liability_form_signed && (
                      <Badge label="Compliance Verified" color="cyan" />
                    )}
                    {worker.stripe_account_id && (
                      <Badge label="Payout Verified" color="green" />
                    )}
                    {worker.insurance_provider && <Badge label="Insured" color="blue" />}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 px-8 py-7 text-center shadow-xl shadow-cyan-500/10">
                <div className="text-5xl font-black text-cyan-200">★ {ratingDisplay}</div>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300">
                  Worker Rating
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-400">
                  {reviewCount} review{reviewCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </div>

          {isCompany && (
            <div className="grid gap-4 border-t border-white/10 bg-slate-950/50 p-6 md:grid-cols-[1fr_auto_auto]">
              <select
                value={selectedJobId}
                onChange={(event) => setSelectedJobId(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
              >
                <option value="">Choose a job to invite this worker...</option>
                {companyJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title || 'Untitled Job'} — {job.location || 'No location'}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => void sendInvite()}
                disabled={sendingInvite || companyJobs.length === 0}
                className="rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              >
                {sendingInvite ? 'Sending...' : 'Invite Worker'}
              </button>

              <button
                type="button"
                onClick={() => void toggleSavedWorker()}
                disabled={savingWorker}
                className={`rounded-2xl px-6 py-3 text-sm font-black disabled:opacity-50 ${
                  savedWorker
                    ? 'bg-orange-400 text-slate-950 hover:bg-orange-300'
                    : 'border border-white/10 bg-white/10 text-white hover:bg-white/15'
                }`}
              >
                {savingWorker ? 'Saving...' : savedWorker ? '★ Saved' : '☆ Save Worker'}
              </button>
            </div>
          )}
        </section>

        <div className="grid gap-5 md:grid-cols-4">
          <StatCard title="Completed Jobs" value={String(completedCount)} />
          <StatCard title="Average Rating" value={`★ ${ratingDisplay}`} />
          <StatCard
            title="Experience"
            value={worker.years_experience ? `${worker.years_experience} yrs` : 'N/A'}
          />
          <StatCard
            title="Insurance"
            value={worker.insurance_provider ? 'Verified' : 'Not Added'}
          />
        </div>

        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl">
          <h2 className="text-2xl font-black">Worker Experience</h2>
          <p className="mt-5 whitespace-pre-wrap leading-8 text-slate-300">
            {worker.job_experience || 'This worker has not added job experience yet.'}
          </p>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl">
          <h2 className="text-2xl font-black">Compliance Details</h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Detail label="Insurance Provider" value={worker.insurance_provider} />
            <Detail label="Policy Number" value={worker.insurance_policy_number} />
            <Detail label="Phone" value={worker.phone} />
            <Detail
              label="Location"
              value={[worker.city, worker.state].filter(Boolean).join(', ')}
            />
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl">
          <h2 className="text-2xl font-black">Uploaded Files</h2>

          {docs.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-slate-300">
              No public worker documents uploaded yet.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {docs.map((file) => (
                <a
                  key={file.id}
                  href={file.file_url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 hover:border-cyan-300/40"
                >
                  <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
                    {file.category || 'Document'}
                  </p>
                  <p className="mt-2 font-black text-white">
                    {file.file_name || 'Open uploaded file'}
                  </p>
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl">
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
            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-slate-300">
              No reviews yet.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xl font-black text-yellow-300">
                      ★ {review.rating || 5}
                    </div>
                    <div className="text-sm text-slate-400">
                      {formatDate(review.created_at || '')}
                    </div>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap text-slate-300">
                    {review.comment || 'No comment left.'}
                  </p>

                  <p className="mt-4 text-sm text-slate-500">
                    — {review.reviewer_name || 'CrewCall User'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/messages"
            className="rounded-2xl bg-cyan-400 px-6 py-3 text-center font-black text-slate-950 shadow-lg shadow-cyan-400/20 hover:bg-cyan-300"
          >
            Message Worker
          </Link>

          <Link
            href="/workers"
            className="rounded-2xl border border-white/10 px-6 py-3 text-center font-bold text-white hover:bg-white/10"
          >
            Browse More Workers
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
  color?: 'default' | 'green' | 'cyan' | 'orange' | 'blue' | 'lime'
}) {
  const styles = {
    default: 'border-white/10 bg-white/5 text-white',
    green: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
    orange: 'border-orange-400/20 bg-orange-400/10 text-orange-200',
    blue: 'border-blue-400/20 bg-blue-400/10 text-blue-200',
    lime: 'border-lime-400/20 bg-lime-400/10 text-lime-200',
  }

  return (
    <div className={`rounded-2xl border px-4 py-2 text-sm font-bold ${styles[color]}`}>
      {label}
    </div>
  )
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl">
      <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
        {title}
      </p>
      <p className="mt-4 text-3xl font-black text-white">{value}</p>
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
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-semibold text-white">{value || 'Not listed'}</p>
    </div>
  )
}

function formatDate(value: string) {
  if (!value) return ''
  return new Date(value).toLocaleDateString()
}

function isAvailable(worker: WorkerProfile) {
  return Boolean(worker.available_for_work) && !Boolean(worker.currently_working)
}

function isActuallyOnline(worker: WorkerProfile) {
  if (!worker.is_online || !worker.last_seen) return false

  const lastSeen = new Date(worker.last_seen).getTime()

  if (Number.isNaN(lastSeen)) return false

  return Date.now() - lastSeen < 90_000
}

function availabilityLabel(worker: WorkerProfile) {
  if (isAvailable(worker)) return 'Available Now'
  if (worker.currently_working) return 'Currently Working'
  if (worker.booked_until) return `Booked Until ${worker.booked_until}`
  return 'Not Available'
}

function presenceLabel(worker: WorkerProfile) {
  if (isActuallyOnline(worker)) return 'Online now'
  if (!worker.last_seen) return 'Offline'

  return `Last seen ${formatRelativeTime(worker.last_seen)}`
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()

  if (Number.isNaN(date.getTime())) return 'recently'

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}