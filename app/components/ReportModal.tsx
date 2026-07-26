'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

type ReportTargetType =
  | 'user'
  | 'company'
  | 'job'

type ReportReason =
  | 'scam_fraud'
  | 'no_show'
  | 'harassment'
  | 'unsafe_work'
  | 'fake_profile'
  | 'inappropriate_behavior'
  | 'payment_dispute'
  | 'misleading_job'
  | 'spam'
  | 'other'

type NoticeTone =
  | 'error'
  | 'success'
  | 'info'

type ReportModalProps = {
  targetType: ReportTargetType
  targetId: string
  targetName: string
  trigger?: ReactNode
  className?: string
  onSubmitted?: () => void
}

type ExistingReport = {
  id: string
  status: string | null
  created_at: string | null
}

const reasonOptions: Array<{
  value: ReportReason
  label: string
  description: string
  targets: ReportTargetType[]
}> = [
  {
    value: 'scam_fraud',
    label: 'Scam or Fraud',
    description:
      'Suspicious payment requests, deceptive conduct, or attempted fraud.',
    targets: ['user', 'company', 'job'],
  },
  {
    value: 'no_show',
    label: 'No Show',
    description:
      'The user failed to arrive or communicate as agreed.',
    targets: ['user', 'company'],
  },
  {
    value: 'harassment',
    label: 'Harassment',
    description:
      'Threatening, abusive, discriminatory, or unwanted behavior.',
    targets: ['user', 'company'],
  },
  {
    value: 'unsafe_work',
    label: 'Unsafe Work',
    description:
      'Unsafe conditions, practices, instructions, or behavior.',
    targets: ['user', 'company', 'job'],
  },
  {
    value: 'fake_profile',
    label: 'Fake or Misleading Profile',
    description:
      'False identity, qualifications, licenses, experience, or company details.',
    targets: ['user', 'company'],
  },
  {
    value: 'inappropriate_behavior',
    label: 'Inappropriate Behavior',
    description:
      'Unprofessional or inappropriate conduct not covered above.',
    targets: ['user', 'company'],
  },
  {
    value: 'payment_dispute',
    label: 'Payment Concern',
    description:
      'Improper payment demands, withheld payment, or suspicious billing.',
    targets: ['user', 'company', 'job'],
  },
  {
    value: 'misleading_job',
    label: 'Misleading Job Posting',
    description:
      'The job description, pay, location, or requirements appear inaccurate.',
    targets: ['job'],
  },
  {
    value: 'spam',
    label: 'Spam',
    description:
      'Repeated, irrelevant, promotional, or automated content.',
    targets: ['user', 'company', 'job'],
  },
  {
    value: 'other',
    label: 'Other',
    description:
      'Another concern that requires CrewCall review.',
    targets: ['user', 'company', 'job'],
  },
]

function targetLabel(
  targetType: ReportTargetType
) {
  if (targetType === 'job') {
    return 'job'
  }

  if (targetType === 'company') {
    return 'company'
  }

  return 'user'
}

function targetTitle(
  targetType: ReportTargetType
) {
  if (targetType === 'job') {
    return 'Report Job'
  }

  if (targetType === 'company') {
    return 'Report Company'
  }

  return 'Report User'
}

function defaultTriggerLabel(
  targetType: ReportTargetType
) {
  if (targetType === 'job') {
    return 'Report Job'
  }

  if (targetType === 'company') {
    return 'Report Company'
  }

  return 'Report User'
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return 'recently'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'recently'
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

export default function ReportModal({
  targetType,
  targetId,
  targetName,
  trigger,
  className = '',
  onSubmitted,
}: ReportModalProps) {
  const db = supabase as any

  const [open, setOpen] =
    useState(false)

  const [reason, setReason] =
    useState<ReportReason | ''>('')

  const [details, setDetails] =
    useState('')

  const [submitting, setSubmitting] =
    useState(false)

  const [
    checkingDuplicate,
    setCheckingDuplicate,
  ] = useState(false)

  const [
    duplicateReport,
    setDuplicateReport,
  ] = useState<ExistingReport | null>(
    null
  )

  const [message, setMessage] =
    useState('')

  const [messageTone, setMessageTone] =
    useState<NoticeTone>('info')

  const availableReasons =
    useMemo(
      () =>
        reasonOptions.filter(
          (option) =>
            option.targets.includes(
              targetType
            )
        ),
      [targetType]
    )

  const selectedReason =
    useMemo(
      () =>
        availableReasons.find(
          (option) =>
            option.value === reason
        ) || null,
      [availableReasons, reason]
    )

  const cleanTargetName =
    targetName.trim() ||
    `this ${targetLabel(targetType)}`

  function resetForm() {
    setReason('')
    setDetails('')
    setMessage('')
    setMessageTone('info')
    setDuplicateReport(null)
  }

  function closeModal() {
    if (submitting) {
      return
    }

    setOpen(false)
    resetForm()
  }

  async function openModal() {
    setOpen(true)
    setMessage('')
    setDuplicateReport(null)
    setCheckingDuplicate(true)

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser()

      if (userError || !user) {
        setMessage(
          'You must be logged in to submit a report.'
        )
        setMessageTone('error')
        return
      }

      if (
        targetType !== 'job' &&
        user.id === targetId
      ) {
        setMessage(
          'You cannot report your own profile.'
        )
        setMessageTone('error')
        return
      }

      let duplicateQuery = db
        .from('reports')
        .select(
          'id,status,created_at'
        )
        .eq('reporter_id', user.id)
        .in('status', [
          'pending',
          'reviewing',
        ])

      if (targetType === 'job') {
        duplicateQuery =
          duplicateQuery.eq(
            'reported_job_id',
            targetId
          )
      } else {
        duplicateQuery =
          duplicateQuery.eq(
            'reported_user_id',
            targetId
          )
      }

      const {
        data,
        error,
      } = await duplicateQuery
        .order('created_at', {
          ascending: false,
        })
        .limit(1)
        .maybeSingle()

      if (error) {
        throw error
      }

      if (data) {
        setDuplicateReport(
          data as ExistingReport
        )

        setMessage(
          `You already submitted a report about this ${targetLabel(
            targetType
          )} on ${formatDate(
            data.created_at
          )}. It is currently ${String(
            data.status || 'pending'
          ).replaceAll('_', ' ')}.`
        )
        setMessageTone('info')
      }
    } catch (error) {
      console.error(
        'Duplicate report check error:',
        error
      )

      setMessage(
        error instanceof Error
          ? error.message
          : 'CrewCall could not check your previous reports.'
      )
      setMessageTone('error')
    } finally {
      setCheckingDuplicate(false)
    }
  }

  async function submitReport() {
    if (!targetId) {
      setMessage(
        'The report target could not be identified.'
      )
      setMessageTone('error')
      return
    }

    if (!reason) {
      setMessage(
        'Select a reason for this report.'
      )
      setMessageTone('error')
      return
    }

    const cleanDetails =
      details.trim()

    if (
      reason === 'other' &&
      cleanDetails.length < 10
    ) {
      setMessage(
        'Please provide at least 10 characters explaining the concern.'
      )
      setMessageTone('error')
      return
    }

    if (cleanDetails.length > 2000) {
      setMessage(
        'Report details cannot exceed 2,000 characters.'
      )
      setMessageTone('error')
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error(
          userError?.message ||
            'You must be logged in to submit a report.'
        )
      }

      if (
        targetType !== 'job' &&
        user.id === targetId
      ) {
        throw new Error(
          'You cannot report your own profile.'
        )
      }

      let duplicateQuery = db
        .from('reports')
        .select(
          'id,status,created_at'
        )
        .eq('reporter_id', user.id)
        .in('status', [
          'pending',
          'reviewing',
        ])

      if (targetType === 'job') {
        duplicateQuery =
          duplicateQuery.eq(
            'reported_job_id',
            targetId
          )
      } else {
        duplicateQuery =
          duplicateQuery.eq(
            'reported_user_id',
            targetId
          )
      }

      const {
        data: existingReport,
        error: duplicateError,
      } = await duplicateQuery
        .order('created_at', {
          ascending: false,
        })
        .limit(1)
        .maybeSingle()

      if (duplicateError) {
        throw duplicateError
      }

      if (existingReport) {
        setDuplicateReport(
          existingReport as ExistingReport
        )

        throw new Error(
          `You already have an open report about this ${targetLabel(
            targetType
          )}.`
        )
      }

      const insertValue = {
        reporter_id: user.id,
        reported_user_id:
          targetType === 'job'
            ? null
            : targetId,
        reported_job_id:
          targetType === 'job'
            ? targetId
            : null,
        report_type:
          targetType === 'company'
            ? 'company'
            : targetType,
        reason,
        details:
          cleanDetails || null,
        status: 'pending',
      }

      const {
        data: createdReport,
        error: insertError,
      } = await db
        .from('reports')
        .insert(insertValue)
        .select(
          'id,status,created_at'
        )
        .single()

      if (insertError) {
        throw insertError
      }

      setDuplicateReport(
        createdReport as ExistingReport
      )

      setMessage(
        `Your report about ${cleanTargetName} was submitted to CrewCall Trust & Safety.`
      )
      setMessageTone('success')
      setReason('')
      setDetails('')

      window.dispatchEvent(
        new Event(
          'crewcall-refresh-nav'
        )
      )

      onSubmitted?.()
    } catch (error) {
      console.error(
        'Report submission error:',
        error
      )

      setMessage(
        error instanceof Error
          ? error.message
          : 'The report could not be submitted.'
      )
      setMessageTone('error')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        closeModal()
      }
    }

    document.addEventListener(
      'keydown',
      handleKeyDown
    )

    const originalOverflow =
      document.body.style.overflow

    document.body.style.overflow =
      'hidden'

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown
      )

      document.body.style.overflow =
        originalOverflow
    }
  }, [open, submitting])

  return (
    <>
      {trigger ? (
        <span
          onClick={() =>
            void openModal()
          }
          className={className}
        >
          {trigger}
        </span>
      ) : (
        <button
          type="button"
          onClick={() =>
            void openModal()
          }
          className={[
            'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-black text-red-300 transition hover:border-red-400/35 hover:bg-red-500/20',
            className,
          ].join(' ')}
        >
          <span aria-hidden="true">
            ⚑
          </span>

          {defaultTriggerLabel(
            targetType
          )}
        </button>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/85 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal()
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            className="max-h-[96vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] border border-white/10 bg-slate-950 text-white shadow-2xl sm:rounded-[2rem]"
          >
            <div className="h-1 bg-gradient-to-r from-red-400 via-amber-400 to-cyan-400" />

            <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 px-5 py-5 backdrop-blur-xl sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
                    CrewCall Trust & Safety
                  </p>

                  <h2
                    id="report-modal-title"
                    className="mt-2 text-2xl font-black sm:text-3xl"
                  >
                    {targetTitle(
                      targetType
                    )}
                  </h2>

                  <p className="mt-2 break-words text-sm font-semibold text-slate-400">
                    Reporting{' '}
                    <span className="text-white">
                      {cleanTargetName}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  aria-label="Close report form"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] text-xl font-black text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="space-y-6 p-5 sm:p-7">
              <div className="rounded-3xl border border-amber-400/20 bg-amber-500/[0.07] p-4">
                <p className="text-sm font-black text-amber-200">
                  Reports are private.
                </p>

                <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
                  The reported person will
                  not see who submitted this
                  report. CrewCall
                  administrators will review
                  the information and decide
                  whether action is required.
                </p>
              </div>

              {message ? (
                <Notice
                  tone={messageTone}
                >
                  {message}
                </Notice>
              ) : null}

              {checkingDuplicate ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 text-center">
                  <p className="font-black text-white">
                    Checking existing
                    reports...
                  </p>
                </div>
              ) : duplicateReport ? (
                <div className="rounded-3xl border border-blue-400/20 bg-blue-500/[0.07] p-5">
                  <p className="text-sm font-black text-blue-200">
                    Report already on file
                  </p>

                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
                    CrewCall already has an
                    open report from you
                    concerning this{' '}
                    {targetLabel(
                      targetType
                    )}
                    . You do not need to
                    submit another one.
                  </p>

                  <button
                    type="button"
                    onClick={closeModal}
                    className="mt-5 w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 transition hover:bg-cyan-300"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label
                      htmlFor="report-reason"
                      className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
                    >
                      Reason for Report
                    </label>

                    <select
                      id="report-reason"
                      value={reason}
                      disabled={submitting}
                      onChange={(event) =>
                        setReason(
                          event.target
                            .value as
                            | ReportReason
                            | ''
                        )
                      }
                      className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">
                        Select a reason
                      </option>

                      {availableReasons.map(
                        (option) => (
                          <option
                            key={
                              option.value
                            }
                            value={
                              option.value
                            }
                          >
                            {option.label}
                          </option>
                        )
                      )}
                    </select>

                    {selectedReason ? (
                      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                        {
                          selectedReason.description
                        }
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="report-details"
                        className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
                      >
                        Additional Details
                      </label>

                      <span className="text-xs font-bold text-slate-600">
                        {details.length}/2000
                      </span>
                    </div>

                    <textarea
                      id="report-details"
                      value={details}
                      disabled={submitting}
                      maxLength={2000}
                      rows={7}
                      onChange={(event) =>
                        setDetails(
                          event.target.value
                        )
                      }
                      placeholder="Tell CrewCall what happened. Include relevant dates, job information, messages, or other details that may help the review."
                      className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold leading-6 text-white outline-none placeholder:text-slate-600 focus:border-red-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                    />

                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
                      Do not include payment
                      card information,
                      passwords, Social
                      Security numbers, or
                      other highly sensitive
                      personal information.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
                    <p className="text-sm font-black text-white">
                      What happens next?
                    </p>

                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
                      Your report will enter
                      the CrewCall moderation
                      queue. An administrator
                      may review profiles,
                      jobs, messages,
                      documents, and account
                      history before deciding
                      whether to warn,
                      restrict, suspend, or
                      clear the reported
                      account.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={submitting}
                      className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 font-black text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void submitReport()
                      }
                      disabled={
                        submitting ||
                        !reason
                      }
                      className="rounded-2xl bg-red-500 px-4 py-3 font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting
                        ? 'Submitting Report...'
                        : 'Submit Report'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: NoticeTone
  children: ReactNode
}) {
  const classes: Record<
    NoticeTone,
    string
  > = {
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
        'rounded-2xl border p-4 text-sm font-bold leading-6',
        classes[tone],
      ].join(' ')}
    >
      {children}
    </div>
  )
}