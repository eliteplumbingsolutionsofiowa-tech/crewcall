'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '@/lib/supabase'

type ReportStatus =
  | 'pending'
  | 'reviewing'
  | 'resolved'
  | 'dismissed'

type StatusFilter =
  | 'all'
  | ReportStatus

type TargetFilter =
  | 'all'
  | 'user'
  | 'job'

type Tone =
  | 'error'
  | 'success'
  | 'warning'

type RelatedProfile = {
  id: string
  full_name: string | null
  company_name: string | null
  role: string | null
  city: string | null
  state: string | null
  trade: string | null
  is_suspended: boolean | null
}

type RelatedJob = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  status: string | null
  company_id: string | null
}

type Report = {
  id: string
  reporter_id: string
  reported_user_id: string | null
  reported_job_id: string | null
  report_type: string
  reason: string
  details: string | null
  status: ReportStatus
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  reporter: RelatedProfile | null
  reported_user: RelatedProfile | null
  reported_job: RelatedJob | null
  reviewer: RelatedProfile | null
}

type RawReport = Omit<
  Report,
  | 'reporter'
  | 'reported_user'
  | 'reported_job'
  | 'reviewer'
> & {
  reporter:
    | RelatedProfile
    | RelatedProfile[]
    | null
  reported_user:
    | RelatedProfile
    | RelatedProfile[]
    | null
  reported_job:
    | RelatedJob
    | RelatedJob[]
    | null
  reviewer:
    | RelatedProfile
    | RelatedProfile[]
    | null
}

type ReportStats = {
  total: number
  pending: number
  reviewing: number
  resolved: number
  dismissed: number
  users: number
  jobs: number
}

type SelectedAction =
  | 'resolve'
  | 'dismiss'
  | 'reviewing'
  | null

function firstRelated<T>(
  value: T | T[] | null
): T | null {
  if (!value) return null

  if (Array.isArray(value)) {
    return value[0] || null
  }

  return value
}

function normalizeReport(
  report: RawReport
): Report {
  return {
    ...report,
    reporter: firstRelated(
      report.reporter
    ),
    reported_user: firstRelated(
      report.reported_user
    ),
    reported_job: firstRelated(
      report.reported_job
    ),
    reviewer: firstRelated(
      report.reviewer
    ),
  }
}

function formatDateTime(
  value: string | null
) {
  if (!value) return 'Unknown'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return date.toLocaleString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }
  )
}

function formatDate(value: string | null) {
  if (!value) return 'Unknown'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  )
}

function titleCase(
  value: string | null
) {
  if (!value) return 'Unknown'

  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    )
}

function profileName(
  profile: RelatedProfile | null
) {
  if (!profile) {
    return 'Unknown User'
  }

  return (
    profile.company_name ||
    profile.full_name ||
    'CrewCall User'
  )
}

function profileLocation(
  profile: RelatedProfile | null
) {
  if (!profile) return null

  return (
    [
      profile.city,
      profile.state,
    ]
      .filter(Boolean)
      .join(', ') || null
  )
}

function statusDescription(
  status: ReportStatus
) {
  if (status === 'pending') {
    return 'Waiting for admin review'
  }

  if (status === 'reviewing') {
    return 'Currently under review'
  }

  if (status === 'resolved') {
    return 'Moderation action completed'
  }

  return 'Closed without action'
}

function reportTarget(
  report: Report
) {
  if (report.reported_user_id) {
    return 'user'
  }

  if (report.reported_job_id) {
    return 'job'
  }

  return 'unknown'
}

function reportTargetName(
  report: Report
) {
  if (report.reported_user_id) {
    return profileName(
      report.reported_user
    )
  }

  if (report.reported_job_id) {
    return (
      report.reported_job?.title ||
      'Reported Job'
    )
  }

  return 'Unknown Target'
}

export default function AdminReportsPage() {
  const db = supabase as any

  const [loading, setLoading] =
    useState(true)

  const [reports, setReports] =
    useState<Report[]>([])

  const [search, setSearch] =
    useState('')

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<StatusFilter>('all')

  const [
    targetFilter,
    setTargetFilter,
  ] = useState<TargetFilter>('all')

  const [
    selectedReport,
    setSelectedReport,
  ] = useState<Report | null>(null)

  const [
    selectedAction,
    setSelectedAction,
  ] = useState<SelectedAction>(null)

  const [
    adminNotes,
    setAdminNotes,
  ] = useState('')

  const [
    actionWorking,
    setActionWorking,
  ] = useState(false)

  const [
    warningTitle,
    setWarningTitle,
  ] = useState(
    'Important message from CrewCall'
  )

  const [
    warningMessage,
    setWarningMessage,
  ] = useState('')

  const [
    showWarningForm,
    setShowWarningForm,
  ] = useState(false)

  const [
    sendingWarning,
    setSendingWarning,
  ] = useState(false)

  const [message, setMessage] =
    useState('')

  const [tone, setTone] =
    useState<Tone>('warning')

  const loadReports =
    useCallback(async () => {
      setLoading(true)
      setMessage('')

      try {
        const {
          data: { user },
          error: authError,
        } =
          await supabase.auth.getUser()

        if (authError || !user) {
          throw new Error(
            authError?.message ||
              'You must be logged in.'
          )
        }

        const {
          data: adminProfile,
          error: adminError,
        } = await db
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        if (adminError) {
          throw adminError
        }

        if (
          adminProfile?.role !== 'admin'
        ) {
          throw new Error(
            'Admin access only.'
          )
        }

        const {
          data,
          error,
        } = await db
          .from('reports')
          .select(`
            id,
            reporter_id,
            reported_user_id,
            reported_job_id,
            report_type,
            reason,
            details,
            status,
            admin_notes,
            reviewed_by,
            reviewed_at,
            created_at,
            updated_at,
            reporter:profiles!reports_reporter_id_fkey (
              id,
              full_name,
              company_name,
              role,
              city,
              state,
              trade,
              is_suspended
            ),
            reported_user:profiles!reports_reported_user_id_fkey (
              id,
              full_name,
              company_name,
              role,
              city,
              state,
              trade,
              is_suspended
            ),
            reported_job:jobs!reports_reported_job_id_fkey (
              id,
              title,
              trade,
              location,
              status,
              company_id
            ),
            reviewer:profiles!reports_reviewed_by_fkey (
              id,
              full_name,
              company_name,
              role,
              city,
              state,
              trade,
              is_suspended
            )
          `)
          .order('created_at', {
            ascending: false,
          })

        if (error) {
          throw error
        }

        const normalized = (
          (data || []) as RawReport[]
        ).map(normalizeReport)

        setReports(normalized)

        setSelectedReport(
          (current) => {
            if (!current) return null

            return (
              normalized.find(
                (report) =>
                  report.id ===
                  current.id
              ) || null
            )
          }
        )
      } catch (error) {
        console.error(
          'Admin reports error:',
          error
        )

        setMessage(
          error instanceof Error
            ? error.message
            : JSON.stringify(error)
        )
        setTone('error')
      } finally {
        setLoading(false)
      }
    }, [db])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const stats =
    useMemo<ReportStats>(() => {
      return {
        total: reports.length,
        pending: reports.filter(
          (report) =>
            report.status === 'pending'
        ).length,
        reviewing: reports.filter(
          (report) =>
            report.status ===
            'reviewing'
        ).length,
        resolved: reports.filter(
          (report) =>
            report.status ===
            'resolved'
        ).length,
        dismissed: reports.filter(
          (report) =>
            report.status ===
            'dismissed'
        ).length,
        users: reports.filter(
          (report) =>
            Boolean(
              report.reported_user_id
            )
        ).length,
        jobs: reports.filter(
          (report) =>
            Boolean(
              report.reported_job_id
            )
        ).length,
      }
    }, [reports])

  const filteredReports =
    useMemo(() => {
      const query = search
        .trim()
        .toLowerCase()

      return reports.filter(
        (report) => {
          if (
            statusFilter !== 'all' &&
            report.status !== statusFilter
          ) {
            return false
          }

          const target =
            reportTarget(report)

          if (
            targetFilter !== 'all' &&
            target !== targetFilter
          ) {
            return false
          }

          if (!query) {
            return true
          }

          const searchable = [
            report.id,
            report.report_type,
            report.reason,
            report.details,
            report.admin_notes,
            profileName(
              report.reporter
            ),
            profileName(
              report.reported_user
            ),
            report.reported_job
              ?.title,
            report.reported_job
              ?.trade,
            report.reported_job
              ?.location,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

          return searchable.includes(
            query
          )
        }
      )
    }, [
      reports,
      search,
      statusFilter,
      targetFilter,
    ])

  function openReport(
    report: Report
  ) {
    setSelectedReport(report)
    setAdminNotes(
      report.admin_notes || ''
    )
    setSelectedAction(null)
    setShowWarningForm(false)
    setWarningMessage('')
    setMessage('')
  }

  function closeReport() {
    if (
      actionWorking ||
      sendingWarning
    ) {
      return
    }

    setSelectedReport(null)
    setSelectedAction(null)
    setAdminNotes('')
    setShowWarningForm(false)
    setWarningMessage('')
  }

  async function updateReportStatus(
    status: ReportStatus
  ) {
    if (!selectedReport) return

    setActionWorking(true)
    setMessage('')

    try {
      const {
        data: { user },
        error: authError,
      } =
        await supabase.auth.getUser()

      if (authError || !user) {
        throw new Error(
          authError?.message ||
            'Your login session could not be verified.'
        )
      }

      const cleanNotes =
        adminNotes.trim()

      const reviewFinished =
        status === 'resolved' ||
        status === 'dismissed'

      const {
        data,
        error,
      } = await db
        .from('reports')
        .update({
          status,
          admin_notes:
            cleanNotes || null,
          reviewed_by: user.id,
          reviewed_at:
            reviewFinished
              ? new Date().toISOString()
              : null,
        })
        .eq('id', selectedReport.id)
        .select(`
          id,
          reporter_id,
          reported_user_id,
          reported_job_id,
          report_type,
          reason,
          details,
          status,
          admin_notes,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at,
          reporter:profiles!reports_reporter_id_fkey (
            id,
            full_name,
            company_name,
            role,
            city,
            state,
            trade,
            is_suspended
          ),
          reported_user:profiles!reports_reported_user_id_fkey (
            id,
            full_name,
            company_name,
            role,
            city,
            state,
            trade,
            is_suspended
          ),
          reported_job:jobs!reports_reported_job_id_fkey (
            id,
            title,
            trade,
            location,
            status,
            company_id
          ),
          reviewer:profiles!reports_reviewed_by_fkey (
            id,
            full_name,
            company_name,
            role,
            city,
            state,
            trade,
            is_suspended
          )
        `)
        .single()

      if (error) {
        throw error
      }

      const updated =
        normalizeReport(
          data as RawReport
        )

      setReports((current) =>
        current.map((report) =>
          report.id === updated.id
            ? updated
            : report
        )
      )

      setSelectedReport(updated)
      setAdminNotes(
        updated.admin_notes || ''
      )
      setSelectedAction(null)

      setMessage(
        status === 'resolved'
          ? 'Report resolved successfully.'
          : status === 'dismissed'
            ? 'Report dismissed successfully.'
            : 'Report marked as under review.'
      )
      setTone('success')
    } catch (error) {
      console.error(
        'Report status update error:',
        error
      )

      setMessage(
        error instanceof Error
          ? error.message
          : JSON.stringify(error)
      )
      setTone('error')
    } finally {
      setActionWorking(false)
    }
  }

  async function saveAdminNotes() {
    if (!selectedReport) return

    setActionWorking(true)
    setMessage('')

    try {
      const cleanNotes =
        adminNotes.trim()

      const {
        data,
        error,
      } = await db
        .from('reports')
        .update({
          admin_notes:
            cleanNotes || null,
        })
        .eq('id', selectedReport.id)
        .select(`
          id,
          reporter_id,
          reported_user_id,
          reported_job_id,
          report_type,
          reason,
          details,
          status,
          admin_notes,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at,
          reporter:profiles!reports_reporter_id_fkey (
            id,
            full_name,
            company_name,
            role,
            city,
            state,
            trade,
            is_suspended
          ),
          reported_user:profiles!reports_reported_user_id_fkey (
            id,
            full_name,
            company_name,
            role,
            city,
            state,
            trade,
            is_suspended
          ),
          reported_job:jobs!reports_reported_job_id_fkey (
            id,
            title,
            trade,
            location,
            status,
            company_id
          ),
          reviewer:profiles!reports_reviewed_by_fkey (
            id,
            full_name,
            company_name,
            role,
            city,
            state,
            trade,
            is_suspended
          )
        `)
        .single()

      if (error) {
        throw error
      }

      const updated =
        normalizeReport(
          data as RawReport
        )

      setReports((current) =>
        current.map((report) =>
          report.id === updated.id
            ? updated
            : report
        )
      )

      setSelectedReport(updated)

      setMessage(
        'Admin notes saved.'
      )
      setTone('success')
    } catch (error) {
      console.error(
        'Save admin notes error:',
        error
      )

      setMessage(
        error instanceof Error
          ? error.message
          : JSON.stringify(error)
      )
      setTone('error')
    } finally {
      setActionWorking(false)
    }
  }

  async function sendWarning() {
    if (!selectedReport) return

    const targetUser =
      selectedReport.reported_user

    if (!targetUser) {
      setMessage(
        'This report does not have a reported user to notify.'
      )
      setTone('error')
      return
    }

    const cleanTitle =
      warningTitle.trim()

    const cleanMessage =
      warningMessage.trim()

    if (!cleanTitle) {
      setMessage(
        'Enter a warning title.'
      )
      setTone('error')
      return
    }

    if (!cleanMessage) {
      setMessage(
        'Enter a warning message.'
      )
      setTone('error')
      return
    }

    setSendingWarning(true)
    setMessage('')

    try {
      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession()

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          sessionError?.message ||
            'Your login session could not be verified.'
        )
      }

      const response = await fetch(
        `/api/admin/users/${targetUser.id}/notify`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            title: cleanTitle,
            message: cleanMessage,
          }),
        }
      )

      const result = await response
        .json()
        .catch(() => null)

      if (!response.ok) {
        throw new Error(
          result?.error ||
            'The warning could not be sent.'
        )
      }

      setWarningMessage('')
      setShowWarningForm(false)

      setMessage(
        `Warning sent to ${profileName(
          targetUser
        )}.`
      )
      setTone('success')
    } catch (error) {
      console.error(
        'Send warning error:',
        error
      )

      setMessage(
        error instanceof Error
          ? error.message
          : JSON.stringify(error)
      )
      setTone('error')
    } finally {
      setSendingWarning(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
        <div className="mx-auto max-w-[1500px]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
              CrewCall Admin
            </p>

            <h1 className="mt-3 text-3xl font-black">
              Loading Moderation
              Reports...
            </h1>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map(
                (item) => (
                  <div
                    key={item}
                    className="h-32 animate-pulse rounded-3xl border border-white/10 bg-slate-900"
                  />
                )
              )}
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/admin"
              className="inline-flex rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-sm font-black transition hover:bg-white/10"
            >
              ← Control Center
            </Link>

            <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
              Trust & Safety
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-5xl">
              Reports & Moderation
            </h1>

            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-400 sm:text-base">
              Review user and job
              reports, document
              moderation decisions, warn
              users, and take account
              action.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadReports()
            }
            className="rounded-2xl bg-cyan-400 px-5 py-3 font-black text-slate-950 transition hover:bg-cyan-300"
          >
            Refresh Reports
          </button>
        </div>

        {message ? (
          <Notice tone={tone}>
            {message}
          </Notice>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Open Reports"
            value={
              stats.pending +
              stats.reviewing
            }
            detail={`${stats.pending} waiting · ${stats.reviewing} reviewing`}
            tone="amber"
          />

          <StatCard
            label="Resolved"
            value={stats.resolved}
            detail={`${stats.total} reports total`}
            tone="emerald"
          />

          <StatCard
            label="User Reports"
            value={stats.users}
            detail="Reports targeting accounts"
            tone="cyan"
          />

          <StatCard
            label="Job Reports"
            value={stats.jobs}
            detail={`${stats.dismissed} reports dismissed`}
            tone="violet"
          />
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl sm:p-6">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto_auto]">
            <div>
              <label
                htmlFor="report-search"
                className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
              >
                Search Reports
              </label>

              <input
                id="report-search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search names, reasons, report types, jobs, trades, or locations..."
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
              />
            </div>

            <div>
              <label
                htmlFor="status-filter"
                className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
              >
                Status
              </label>

              <select
                id="status-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target
                      .value as StatusFilter
                  )
                }
                className="mt-2 w-full min-w-48 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none focus:border-cyan-400/40"
              >
                <option value="all">
                  All Statuses
                </option>
                <option value="pending">
                  Pending
                </option>
                <option value="reviewing">
                  Reviewing
                </option>
                <option value="resolved">
                  Resolved
                </option>
                <option value="dismissed">
                  Dismissed
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="target-filter"
                className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
              >
                Target
              </label>

              <select
                id="target-filter"
                value={targetFilter}
                onChange={(event) =>
                  setTargetFilter(
                    event.target
                      .value as TargetFilter
                  )
                }
                className="mt-2 w-full min-w-44 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none focus:border-cyan-400/40"
              >
                <option value="all">
                  All Targets
                </option>
                <option value="user">
                  Users
                </option>
                <option value="job">
                  Jobs
                </option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-500">
              Showing{' '}
              <span className="text-white">
                {filteredReports.length}
              </span>{' '}
              of{' '}
              <span className="text-white">
                {reports.length}
              </span>{' '}
              reports
            </p>

            {search ||
            statusFilter !== 'all' ||
            targetFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('all')
                  setTargetFilter('all')
                }}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-slate-300 transition hover:bg-white/10"
              >
                Clear Filters
              </button>
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl">
          <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />

          <div className="border-b border-white/10 px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">
                  Moderation Queue
                </h2>

                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Newest reports appear
                  first.
                </p>
              </div>

              {stats.pending > 0 ? (
                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-amber-300">
                  {stats.pending} Pending
                </span>
              ) : (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-emerald-300">
                  Queue Clear
                </span>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {filteredReports.length ===
            0 ? (
              <EmptyState
                title="No reports found"
                text={
                  reports.length === 0
                    ? 'No user or job reports have been submitted yet.'
                    : 'No reports match the current filters.'
                }
              />
            ) : (
              <div className="space-y-4">
                {filteredReports.map(
                  (report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      onOpen={() =>
                        openReport(report)
                      }
                    />
                  )
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedReport ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/85 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeReport()
            }
          }}
        >
          <section className="max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-t-[2rem] border border-white/10 bg-slate-950 shadow-2xl sm:rounded-[2rem]">
            <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 px-5 py-5 backdrop-blur-xl sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge
                      status={
                        selectedReport.status
                      }
                    />

                    <TargetBadge
                      target={reportTarget(
                        selectedReport
                      )}
                    />
                  </div>

                  <h2 className="mt-3 text-2xl font-black sm:text-3xl">
                    {reportTargetName(
                      selectedReport
                    )}
                  </h2>

                  <p className="mt-1 text-sm font-bold text-slate-500">
                    Reported{' '}
                    {formatDateTime(
                      selectedReport.created_at
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    actionWorking ||
                    sendingWarning
                  }
                  onClick={closeReport}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] text-xl font-black text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
                  aria-label="Close report"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-6 p-5 sm:p-7">
              {message ? (
                <Notice tone={tone}>
                  {message}
                </Notice>
              ) : null}

              <section className="grid gap-4 lg:grid-cols-3">
                <DetailCard
                  label="Report Type"
                  value={titleCase(
                    selectedReport.report_type
                  )}
                />

                <DetailCard
                  label="Current Status"
                  value={titleCase(
                    selectedReport.status
                  )}
                />

                <DetailCard
                  label="Last Updated"
                  value={formatDateTime(
                    selectedReport.updated_at
                  )}
                />
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-6">
                  <Panel title="Report Details">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        Reason
                      </p>

                      <p className="mt-2 text-lg font-black leading-7 text-white">
                        {
                          selectedReport.reason
                        }
                      </p>
                    </div>

                    <div className="mt-5">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        Additional Details
                      </p>

                      <div className="mt-2 rounded-3xl border border-white/10 bg-slate-950/70 p-4 text-sm font-semibold leading-6 text-slate-300">
                        {selectedReport.details ||
                          'No additional details were provided.'}
                      </div>
                    </div>

                    <p className="mt-4 break-all text-xs font-bold text-slate-700">
                      Report ID:{' '}
                      {selectedReport.id}
                    </p>
                  </Panel>

                  <Panel title="People & Content">
                    <PersonRow
                      label="Submitted By"
                      profile={
                        selectedReport.reporter
                      }
                      profileId={
                        selectedReport.reporter_id
                      }
                    />

                    {selectedReport.reported_user_id ? (
                      <div className="mt-4">
                        <PersonRow
                          label="Reported User"
                          profile={
                            selectedReport.reported_user
                          }
                          profileId={
                            selectedReport.reported_user_id
                          }
                          danger
                        />
                      </div>
                    ) : null}

                    {selectedReport.reported_job_id ? (
                      <div className="mt-4 rounded-3xl border border-violet-400/20 bg-violet-500/[0.07] p-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-300">
                          Reported Job
                        </p>

                        <p className="mt-2 text-lg font-black">
                          {selectedReport
                            .reported_job
                            ?.title ||
                            'Unknown Job'}
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-400">
                          {[
                            selectedReport
                              .reported_job
                              ?.trade,
                            selectedReport
                              .reported_job
                              ?.location,
                            titleCase(
                              selectedReport
                                .reported_job
                                ?.status ||
                                null
                            ),
                          ]
                            .filter(Boolean)
                            .join(' · ') ||
                            'No job details available'}
                        </p>

                        <Link
                          href={`/jobs/${selectedReport.reported_job_id}`}
                          className="mt-4 inline-flex rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-black text-violet-300"
                        >
                          View Job
                        </Link>
                      </div>
                    ) : null}
                  </Panel>

                  <Panel title="Admin Notes">
                    <p className="text-sm font-semibold leading-6 text-slate-400">
                      Keep an internal record
                      of what you reviewed,
                      any evidence found, and
                      why the final decision
                      was made.
                    </p>

                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3">
                        <label
                          htmlFor="admin-notes"
                          className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
                        >
                          Private Notes
                        </label>

                        <span className="text-xs font-bold text-slate-600">
                          {adminNotes.length}
                          /2000
                        </span>
                      </div>

                      <textarea
                        id="admin-notes"
                        value={adminNotes}
                        onChange={(event) =>
                          setAdminNotes(
                            event.target
                              .value
                          )
                        }
                        maxLength={2000}
                        rows={7}
                        placeholder="Add moderation notes..."
                        className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={
                        actionWorking
                      }
                      onClick={() =>
                        void saveAdminNotes()
                      }
                      className="mt-4 w-full rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 font-black text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionWorking
                        ? 'Saving Notes...'
                        : 'Save Admin Notes'}
                    </button>
                  </Panel>
                </div>

                <div className="space-y-6">
                  <Panel title="Moderation Status">
                    <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                      <StatusBadge
                        status={
                          selectedReport.status
                        }
                      />

                      <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
                        {statusDescription(
                          selectedReport.status
                        )}
                      </p>

                      {selectedReport.reviewed_at ? (
                        <p className="mt-3 text-xs font-bold text-slate-600">
                          Reviewed{' '}
                          {formatDateTime(
                            selectedReport.reviewed_at
                          )}
                        </p>
                      ) : null}

                      {selectedReport.reviewer ? (
                        <p className="mt-1 text-xs font-bold text-slate-600">
                          By{' '}
                          {profileName(
                            selectedReport.reviewer
                          )}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-4 space-y-3">
                      {selectedReport.status !==
                      'reviewing' ? (
                        <button
                          type="button"
                          disabled={
                            actionWorking
                          }
                          onClick={() =>
                            setSelectedAction(
                              'reviewing'
                            )
                          }
                          className="w-full rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 font-black text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-50"
                        >
                          Mark Under Review
                        </button>
                      ) : null}

                      {selectedReport.status !==
                      'resolved' ? (
                        <button
                          type="button"
                          disabled={
                            actionWorking
                          }
                          onClick={() =>
                            setSelectedAction(
                              'resolve'
                            )
                          }
                          className="w-full rounded-2xl bg-emerald-400 px-4 py-3 font-black text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
                        >
                          Resolve Report
                        </button>
                      ) : null}

                      {selectedReport.status !==
                      'dismissed' ? (
                        <button
                          type="button"
                          disabled={
                            actionWorking
                          }
                          onClick={() =>
                            setSelectedAction(
                              'dismiss'
                            )
                          }
                          className="w-full rounded-2xl border border-slate-400/20 bg-white/[0.055] px-4 py-3 font-black text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
                        >
                          Dismiss Report
                        </button>
                      ) : null}
                    </div>

                    {selectedAction ? (
                      <div className="mt-4 rounded-3xl border border-amber-400/20 bg-amber-500/[0.07] p-4">
                        <p className="text-sm font-black text-amber-200">
                          {selectedAction ===
                          'resolve'
                            ? 'Resolve this report?'
                            : selectedAction ===
                                'dismiss'
                              ? 'Dismiss this report?'
                              : 'Mark this report as under review?'}
                        </p>

                        <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
                          Your current admin
                          notes will be saved
                          with this decision.
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            disabled={
                              actionWorking
                            }
                            onClick={() =>
                              setSelectedAction(
                                null
                              )
                            }
                            className="rounded-xl border border-white/10 px-3 py-2 text-sm font-black text-slate-300"
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            disabled={
                              actionWorking
                            }
                            onClick={() =>
                              void updateReportStatus(
                                selectedAction ===
                                  'resolve'
                                  ? 'resolved'
                                  : selectedAction ===
                                      'dismiss'
                                    ? 'dismissed'
                                    : 'reviewing'
                              )
                            }
                            className="rounded-xl bg-amber-400 px-3 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
                          >
                            {actionWorking
                              ? 'Updating...'
                              : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </Panel>

                  {selectedReport.reported_user ? (
                    <Panel title="User Actions">
                      <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="font-black">
                          {profileName(
                            selectedReport.reported_user
                          )}
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {titleCase(
                            selectedReport
                              .reported_user
                              .role
                          )}
                          {profileLocation(
                            selectedReport.reported_user
                          )
                            ? ` · ${profileLocation(
                                selectedReport.reported_user
                              )}`
                            : ''}
                        </p>

                        {selectedReport
                          .reported_user
                          .is_suspended ? (
                          <span className="mt-3 inline-flex rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-red-300">
                            Account Suspended
                          </span>
                        ) : (
                          <span className="mt-3 inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-300">
                            Account Active
                          </span>
                        )}
                      </div>

                      <div className="mt-4 space-y-3">
                        <Link
                          href={`/admin/users/${selectedReport.reported_user.id}`}
                          className="block w-full rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-center font-black text-red-300 transition hover:bg-red-500/20"
                        >
                          Review or Suspend User
                        </Link>

                        <Link
                          href={`/profile/${selectedReport.reported_user.id}`}
                          className="block w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-center font-black text-slate-300 transition hover:bg-white/10"
                        >
                          View Public Profile
                        </Link>

                        <button
                          type="button"
                          onClick={() => {
                            setShowWarningForm(
                              (current) =>
                                !current
                            )
                            setWarningMessage(
                              ''
                            )
                          }}
                          className="w-full rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 font-black text-amber-300 transition hover:bg-amber-500/20"
                        >
                          {showWarningForm
                            ? 'Close Warning Form'
                            : 'Send Warning'}
                        </button>
                      </div>

                      {showWarningForm ? (
                        <div className="mt-4 space-y-4 rounded-3xl border border-amber-400/20 bg-amber-500/[0.06] p-4">
                          <div>
                            <label
                              htmlFor="warning-title"
                              className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
                            >
                              Warning Title
                            </label>

                            <input
                              id="warning-title"
                              value={
                                warningTitle
                              }
                              onChange={(
                                event
                              ) =>
                                setWarningTitle(
                                  event
                                    .target
                                    .value
                                )
                              }
                              maxLength={
                                100
                              }
                              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-400/40"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between gap-3">
                              <label
                                htmlFor="warning-message"
                                className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
                              >
                                Warning
                                Message
                              </label>

                              <span className="text-xs font-bold text-slate-600">
                                {
                                  warningMessage.length
                                }
                                /500
                              </span>
                            </div>

                            <textarea
                              id="warning-message"
                              value={
                                warningMessage
                              }
                              onChange={(
                                event
                              ) =>
                                setWarningMessage(
                                  event
                                    .target
                                    .value
                                )
                              }
                              maxLength={
                                500
                              }
                              rows={5}
                              placeholder={`Write a warning to ${profileName(
                                selectedReport.reported_user
                              )}...`}
                              className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold leading-6 text-white outline-none placeholder:text-slate-600 focus:border-amber-400/40"
                            />
                          </div>

                          <button
                            type="button"
                            disabled={
                              sendingWarning ||
                              !warningTitle.trim() ||
                              !warningMessage.trim()
                            }
                            onClick={() =>
                              void sendWarning()
                            }
                            className="w-full rounded-2xl bg-amber-400 px-4 py-3 font-black text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {sendingWarning
                              ? 'Sending Warning...'
                              : 'Send Warning'}
                          </button>
                        </div>
                      ) : null}
                    </Panel>
                  ) : null}

                  <Panel title="Report Timeline">
                    <TimelineItem
                      title="Report submitted"
                      date={
                        selectedReport.created_at
                      }
                      active
                    />

                    {selectedReport.status ===
                      'reviewing' ||
                    selectedReport.reviewed_by ? (
                      <TimelineItem
                        title="Admin review started"
                        date={
                          selectedReport.updated_at
                        }
                        active
                      />
                    ) : (
                      <TimelineItem
                        title="Waiting for review"
                        date={null}
                      />
                    )}

                    {selectedReport.status ===
                      'resolved' ||
                    selectedReport.status ===
                      'dismissed' ? (
                      <TimelineItem
                        title={
                          selectedReport.status ===
                          'resolved'
                            ? 'Report resolved'
                            : 'Report dismissed'
                        }
                        date={
                          selectedReport.reviewed_at
                        }
                        active
                      />
                    ) : (
                      <TimelineItem
                        title="Final decision"
                        date={null}
                      />
                    )}
                  </Panel>
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function ReportCard({
  report,
  onOpen,
}: {
  report: Report
  onOpen: () => void
}) {
  const target =
    reportTarget(report)

  const targetName =
    reportTargetName(report)

  return (
    <article className="rounded-[1.75rem] border border-white/10 bg-slate-950/60 p-4 transition hover:border-cyan-400/20 hover:bg-slate-900/70 sm:p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={report.status}
            />

            <TargetBadge
              target={target}
            />

            <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-black text-slate-400">
              {titleCase(
                report.report_type
              )}
            </span>
          </div>

          <h3 className="mt-3 truncate text-xl font-black">
            {targetName}
          </h3>

          <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-slate-300">
            {report.reason}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-500">
            <span>
              Submitted by{' '}
              <span className="text-slate-300">
                {profileName(
                  report.reporter
                )}
              </span>
            </span>

            <span>
              {formatDateTime(
                report.created_at
              )}
            </span>

            {report.reported_user
              ?.is_suspended ? (
              <span className="text-red-300">
                Target suspended
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 xl:justify-end">
          {report.reported_user_id ? (
            <Link
              href={`/admin/users/${report.reported_user_id}`}
              className="rounded-xl border border-white/10 bg-white/[0.055] px-4 py-2.5 text-xs font-black text-slate-300 transition hover:bg-white/10"
            >
              View User
            </Link>
          ) : null}

          {report.reported_job_id ? (
            <Link
              href={`/jobs/${report.reported_job_id}`}
              className="rounded-xl border border-white/10 bg-white/[0.055] px-4 py-2.5 text-xs font-black text-slate-300 transition hover:bg-white/10"
            >
              View Job
            </Link>
          ) : null}

          <button
            type="button"
            onClick={onOpen}
            className="rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-cyan-300"
          >
            Review Report
          </button>
        </div>
      </div>
    </article>
  )
}

function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: number
  detail: string
  tone:
    | 'amber'
    | 'emerald'
    | 'cyan'
    | 'violet'
}) {
  const styles = {
    amber:
      'border-amber-400/20 bg-amber-500/[0.07] text-amber-300',
    emerald:
      'border-emerald-400/20 bg-emerald-500/[0.07] text-emerald-300',
    cyan:
      'border-cyan-400/20 bg-cyan-500/[0.07] text-cyan-300',
    violet:
      'border-violet-400/20 bg-violet-500/[0.07] text-violet-300',
  }

  return (
    <section
      className={`rounded-[1.75rem] border p-5 shadow-xl ${styles[tone]}`}
    >
      <p className="text-xs font-black uppercase tracking-[0.15em] opacity-80">
        {label}
      </p>

      <p className="mt-3 text-4xl font-black text-white">
        {value}
      </p>

      <p className="mt-2 text-xs font-bold opacity-70">
        {detail}
      </p>
    </section>
  )
}

function StatusBadge({
  status,
}: {
  status: ReportStatus
}) {
  const styles: Record<
    ReportStatus,
    string
  > = {
    pending:
      'border-amber-400/20 bg-amber-500/10 text-amber-300',
    reviewing:
      'border-blue-400/20 bg-blue-500/10 text-blue-300',
    resolved:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
    dismissed:
      'border-slate-400/20 bg-white/[0.055] text-slate-300',
  }

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${styles[status]}`}
    >
      {titleCase(status)}
    </span>
  )
}

function TargetBadge({
  target,
}: {
  target: string
}) {
  if (target === 'user') {
    return (
      <span className="inline-flex rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-red-300">
        User Report
      </span>
    )
  }

  if (target === 'job') {
    return (
      <span className="inline-flex rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-violet-300">
        Job Report
      </span>
    )
  }

  return (
    <span className="inline-flex rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
      Unknown Target
    </span>
  )
}

function PersonRow({
  label,
  profile,
  profileId,
  danger = false,
}: {
  label: string
  profile: RelatedProfile | null
  profileId: string
  danger?: boolean
}) {
  return (
    <div
      className={
        danger
          ? 'rounded-3xl border border-red-400/20 bg-red-500/[0.07] p-4'
          : 'rounded-3xl border border-white/10 bg-slate-950/60 p-4'
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p
            className={
              danger
                ? 'text-xs font-black uppercase tracking-[0.14em] text-red-300'
                : 'text-xs font-black uppercase tracking-[0.14em] text-slate-500'
            }
          >
            {label}
          </p>

          <p className="mt-2 text-lg font-black">
            {profileName(profile)}
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            {titleCase(
              profile?.role || null
            )}
            {profileLocation(profile)
              ? ` · ${profileLocation(
                  profile
                )}`
              : ''}
            {profile?.trade
              ? ` · ${profile.trade}`
              : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/users/${profileId}`}
            className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-black text-slate-300"
          >
            Admin Profile
          </Link>

          <Link
            href={`/profile/${profileId}`}
            className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-300"
          >
            Public Profile
          </Link>
        </div>
      </div>
    </div>
  )
}

function DetailCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-sm font-black">
        {value}
      </p>
    </div>
  )
}

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl sm:p-6">
      <h3 className="text-xl font-black sm:text-2xl">
        {title}
      </h3>

      <div className="mt-5">
        {children}
      </div>
    </section>
  )
}

function TimelineItem({
  title,
  date,
  active = false,
}: {
  title: string
  date: string | null
  active?: boolean
}) {
  return (
    <div className="flex gap-3">
      <div
        className={
          active
            ? 'mt-1 h-3 w-3 shrink-0 rounded-full bg-cyan-400'
            : 'mt-1 h-3 w-3 shrink-0 rounded-full border border-white/20 bg-slate-950'
        }
      />

      <div>
        <p
          className={
            active
              ? 'text-sm font-black text-white'
              : 'text-sm font-black text-slate-500'
          }
        >
          {title}
        </p>

        <p className="mt-1 text-xs font-bold text-slate-600">
          {date
            ? formatDateTime(date)
            : 'Not completed'}
        </p>
      </div>
    </div>
  )
}

function EmptyState({
  title,
  text,
}: {
  title: string
  text: string
}) {
  return (
    <div className="rounded-[2rem] border border-dashed border-white/15 p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/20 bg-cyan-500/10 text-2xl">
        ✓
      </div>

      <h3 className="mt-5 text-xl font-black">
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">
        {text}
      </p>
    </div>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: Tone
  children: React.ReactNode
}) {
  const styles: Record<
    Tone,
    string
  > = {
    error:
      'border-red-400/20 bg-red-500/10 text-red-200',
    success:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    warning:
      'border-amber-400/20 bg-amber-500/10 text-amber-200',
  }

  return (
    <div
      className={`rounded-2xl border p-4 text-sm font-bold ${styles[tone]}`}
    >
      {children}
    </div>
  )
}