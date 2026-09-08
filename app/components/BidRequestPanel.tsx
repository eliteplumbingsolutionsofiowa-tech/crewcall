'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { crewCallAuthedFetch } from '@/lib/authed-fetch'

type BidCompany = {
  id: string
  company_name: string | null
  full_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  company_verified: boolean | null
  insurance_verified: boolean | null
  rating_average: number | null
  rating_count: number | null
}

type BidStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'withdrawn'

type JobBid = {
  id: string
  job_id: string
  company_id: string
  submitted_by: string
  amount_cents: number
  availability: string | null
  estimated_duration: string | null
  note: string | null
  status: BidStatus
  created_at: string
  updated_at: string
  company: BidCompany | null
}

type BidResponse = {
  success?: boolean
  role?: 'project_owner' | 'bidder'
  canManage?: boolean
  job?: {
    id: string
    status: string | null
    bidDeadline: string | null
  }
  bids?: JobBid[]
  error?: string
  message?: string
}

type Props = {
  jobId: string
  bidDeadline?: string | null
  workDeadline?: string | null
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function formatDate(value: string | null | undefined) {
  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function companyName(company: BidCompany | null) {
  return (
    company?.company_name?.trim() ||
    company?.full_name?.trim() ||
    'CrewCall Contractor'
  )
}

function statusLabel(
  status: BidStatus,
  labels: Record<BidStatus, string>
) {
  return labels[status]
}

function statusClass(status: BidStatus) {
  const base =
    'rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider '

  switch (status) {
    case 'accepted':
      return (
        base +
        'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
      )
    case 'declined':
      return (
        base +
        'border-red-400/30 bg-red-500/10 text-red-300'
      )
    case 'withdrawn':
      return (
        base +
        'border-slate-400/30 bg-slate-500/10 text-slate-300'
      )
    default:
      return (
        base +
        'border-amber-400/30 bg-amber-500/10 text-amber-300'
      )
  }
}

export default function BidRequestPanel({
  jobId,
  bidDeadline,
  workDeadline,
}: Props) {
  const t = useTranslations('PostJob')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [actionBidId, setActionBidId] =
    useState<string | null>(null)

  const [role, setRole] =
    useState<'project_owner' | 'bidder' | null>(null)

  const [canManage, setCanManage] = useState(false)
  const [companyRequired, setCompanyRequired] = useState(false)
  const [bids, setBids] = useState<JobBid[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const [amount, setAmount] = useState('')
  const [availability, setAvailability] = useState('')
  const [estimatedDuration, setEstimatedDuration] =
    useState('')
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)

  const loadBids = useCallback(
    async (clearMessage = true) => {
      setLoading(true)

      if (clearMessage) {
        setMessage(null)
      }

      try {
        const response = await crewCallAuthedFetch(
          `/api/job-bids?jobId=${encodeURIComponent(jobId)}`
        )

        const data = (await response.json()) as BidResponse

        if (!response.ok) {
          setRole(null)
          setBids([])

          if (response.status === 403) {
            setCompanyRequired(true)
            setMessage(null)
            return
          }

          setCompanyRequired(false)
          setMessage(
            data.error || 'Unable to load contractor bids.'
          )
          return
        }

        setCompanyRequired(false)
        setRole(data.role || null)
        setCanManage(Boolean(data.canManage))
        setBids(data.bids || [])
      } catch (error) {
        console.error('Load bids error:', error)
        setMessage(t('unableLoadBids'))
      } finally {
        setLoading(false)
      }
    },
    [jobId]
  )

  useEffect(() => {
    void loadBids()
  }, [loadBids])

  const statusLabels: Record<BidStatus, string> = {
    pending: t('pending'),
    accepted: t('accepted'),
    declined: t('declined'),
    withdrawn: t('withdrawn'),
  }

  const ownBid =
    role === 'bidder' && bids.length > 0 ? bids[0] : null

  const deadlinePassed =
    Boolean(bidDeadline) &&
    new Date(bidDeadline as string).getTime() <= Date.now()

  function resetForm() {
    setAmount('')
    setAvailability('')
    setEstimatedDuration('')
    setNote('')
    setEditing(false)
  }

  function startEditing(bid: JobBid) {
    setAmount((bid.amount_cents / 100).toFixed(2))
    setAvailability(bid.availability || '')
    setEstimatedDuration(bid.estimated_duration || '')
    setNote(bid.note || '')
    setEditing(true)
    setMessage(null)
  }

  async function submitBid() {
    const cleanAmount = Number(
      amount.replace(/[$,]/g, '').trim()
    )

    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
      setMessage(t('enterValidBid'))
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      const isExistingBid = Boolean(ownBid)

      const response = await crewCallAuthedFetch(
        '/api/job-bids',
        {
          method: isExistingBid ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            isExistingBid
              ? {
                  bidId: ownBid?.id,
                  action: 'edit',
                  amount: cleanAmount,
                  availability: availability.trim(),
                  estimatedDuration:
                    estimatedDuration.trim(),
                  note: note.trim(),
                }
              : {
                  jobId,
                  amount: cleanAmount,
                  availability: availability.trim(),
                  estimatedDuration:
                    estimatedDuration.trim(),
                  note: note.trim(),
                }
          ),
        }
      )

      const data = (await response.json()) as BidResponse

      if (!response.ok) {
        setMessage(
          data.error ||
            (isExistingBid
              ? 'Unable to update bid.'
              : 'Unable to submit bid.')
        )
        return
      }

      resetForm()

      setMessage(
        data.message ||
          (isExistingBid
            ? 'Bid updated successfully.'
            : 'Your bid was submitted successfully.')
      )

      await loadBids(false)
    } catch (error) {
      console.error('Submit/update bid error:', error)
      setMessage(
        ownBid
          ? 'Unable to update bid.'
          : 'Unable to submit bid.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function runBidAction(
    bid: JobBid,
    action: 'withdraw' | 'accept' | 'decline'
  ) {
    if (action === 'withdraw') {
      const confirmed = window.confirm(
        t('withdrawConfirm')
      )

      if (!confirmed) return
    }

    if (action === 'accept') {
      const confirmed = window.confirm(
        `Accept the ${formatMoney(
          bid.amount_cents
        )} bid from ${companyName(
          bid.company
        )}? The other pending bids will be declined.`
      )

      if (!confirmed) return
    }

    if (action === 'decline') {
      const confirmed = window.confirm(
        t('declineConfirm', {
          company: companyName(bid.company),
        })
      )

      if (!confirmed) return
    }

    setActionBidId(bid.id)
    setMessage(null)

    try {
      const response = await crewCallAuthedFetch(
        '/api/job-bids',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bidId: bid.id,
            action,
          }),
        }
      )

      const data = (await response.json()) as BidResponse

      if (!response.ok) {
        setMessage(
          data.error || 'Unable to update this bid.'
        )
        return
      }

      resetForm()
      setMessage(
        data.message || 'Bid updated successfully.'
      )

      await loadBids(false)
    } catch (error) {
      console.error('Bid action error:', error)
      setMessage('Unable to update this bid.')
    } finally {
      setActionBidId(null)
    }
  }

  function renderBidForm(buttonLabel: string) {
    return (
      <div className="grid gap-4">
        <label className="block">
          <span className="text-sm font-black text-white">
            {t('bidAmount')}
          </span>

          <div className="relative mt-2">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">
              $
            </span>

            <input
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value)
              }
              placeholder="0.00"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/50 py-3 pl-9 pr-4 font-bold text-white outline-none focus:border-blue-400/50"
            />
          </div>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-black text-white">
              {t('availability')}
            </span>

            <input
              value={availability}
              onChange={(event) =>
                setAvailability(event.target.value)
              }
              placeholder={t('availabilityPlaceholder')}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 font-bold text-white outline-none focus:border-blue-400/50"
            />
          </label>

          <label className="block">
            <span className="text-sm font-black text-white">
              {t('estimatedDuration')}
            </span>

            <input
              value={estimatedDuration}
              onChange={(event) =>
                setEstimatedDuration(event.target.value)
              }
              placeholder={t('estimatedDurationPlaceholder')}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 font-bold text-white outline-none focus:border-blue-400/50"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-black text-white">
            Note
          </span>

          <textarea
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('bidNotePlaceholder')}
            className="mt-2 w-full resize-y rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 font-bold text-white outline-none focus:border-blue-400/50"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submitBid()}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Saving...' : buttonLabel}
          </button>

          {editing && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                resetForm()
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <section id="bids" className="rounded-3xl border border-blue-400/20 bg-blue-500/[0.07] p-5 shadow-xl sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-blue-300">
            Request Bids
          </div>

          <h2 className="mt-2 text-2xl font-black text-white">
            {role === 'project_owner'
              ? t('bidPanelTitle')
              : t('submitYourBid')}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            {role === 'project_owner'
              ? t('ownerBidDescription')
              : t('bidderBidDescription')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {bidDeadline && (
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-slate-200">
              {t('bidsClose', {
                date: formatDateTime(bidDeadline!) || '',
              })}
            </span>
          )}

          {workDeadline && (
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-slate-200">
              {t('workDue', {
                date: formatDate(workDeadline!) || '',
              })}
            </span>
          )}
        </div>
      </div>

      {message && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-sm font-bold text-slate-200">
          {message}
        </div>
      )}

      {loading ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/30 p-5 text-sm font-bold text-slate-300">
          {t('loadingBids')}
        </div>
      ) : role === 'project_owner' ? (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black text-white">
                {bids.length}{' '}
                {bids.length === 1
                  ? t('bidSingular')
                  : t('bidPlural')}{' '}
                {t('received')}
              </div>

              <div className="mt-1 text-xs font-semibold text-slate-400">
                Lowest price is shown first.
              </div>
            </div>

            {canManage && bids.length > 0 && (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-300">
                {t('readyToCompare')}
              </span>
            )}
          </div>

          {bids.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/20 p-6 text-center">
              <div className="text-base font-black text-white">
                {t('noBidsYet')}
              </div>

              <p className="mt-2 text-sm text-slate-400">
                {t('noBidsYetHelp')}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {bids.map((bid) => {
                const company = bid.company

                const location = [
                  company?.city,
                  company?.state,
                ]
                  .filter(Boolean)
                  .join(', ')

                const busy = actionBidId === bid.id

                return (
                  <article
                    key={bid.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/35 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-white">
                            {companyName(company)}
                          </h3>

                          <span
                            className={statusClass(bid.status)}
                          >
                            {statusLabel(bid.status, statusLabels)}
                          </span>

                          {company?.company_verified && (
                            <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-black text-blue-300">
                              Verified
                            </span>
                          )}

                          {company?.insurance_verified && (
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-300">
                              Insurance Verified
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-slate-400">
                          {company?.trade && (
                            <span>{company.trade}</span>
                          )}

                          {location && <span>{location}</span>}

                          {company?.rating_average != null && (
                            <span>
                              ★{' '}
                              {Number(
                                company.rating_average
                              ).toFixed(1)}
                              {company.rating_count
                                ? ` (${company.rating_count})`
                                : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="lg:text-right">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Bid
                        </div>

                        <div className="mt-1 text-3xl font-black text-emerald-300">
                          {formatMoney(bid.amount_cents)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                          {t('availability')}
                        </div>

                        <div className="mt-1 text-sm font-bold text-slate-200">
                          {bid.availability || t('notProvided')}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                          {t('estimatedDuration')}
                        </div>

                        <div className="mt-1 text-sm font-bold text-slate-200">
                          {bid.estimated_duration ||
                            t('notProvided')}
                        </div>
                      </div>
                    </div>

                    {bid.note && (
                      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                          {t('contractorNote')}
                        </div>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                          {bid.note}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 text-xs font-semibold text-slate-500">
                      {t('submittedOn', {
                        date: formatDateTime(bid.created_at || '') || '',
                      })}
                    </div>

                    {canManage && bid.status === 'pending' && (
                      <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-4">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runBidAction(bid, 'accept')
                          }
                          className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy ? t('working') : t('acceptBid')}
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runBidAction(bid, 'decline')
                          }
                          className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-3 text-sm font-black text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {t('declineBid')}
                        </button>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </div>
      ) : role === 'bidder' ? (
        <div className="mt-6">
          {ownBid && !editing ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-300">
                  Your Bid
                </div>

                <span className={statusClass(ownBid.status)}>
                  {statusLabel(ownBid.status, statusLabels)}
                </span>
              </div>

              <div className="mt-2 text-3xl font-black text-white">
                {formatMoney(ownBid.amount_cents)}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                    {t('availability')}
                  </div>

                  <div className="mt-1 text-sm font-bold text-slate-200">
                    {ownBid.availability || t('notProvided')}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                    {t('estimatedDuration')}
                  </div>

                  <div className="mt-1 text-sm font-bold text-slate-200">
                    {ownBid.estimated_duration ||
                      t('notProvided')}
                  </div>
                </div>
              </div>

              {ownBid.note && (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                  {ownBid.note}
                </p>
              )}

              {(ownBid.status === 'pending' ||
                ownBid.status === 'withdrawn') &&
                !deadlinePassed && (
                  <div className="mt-5 flex flex-wrap gap-3 border-t border-emerald-400/20 pt-4">
                    <button
                      type="button"
                      onClick={() => startEditing(ownBid)}
                      className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-400"
                    >
                      {ownBid.status === 'withdrawn'
                        ? t('resubmitBid')
                        : t('editBid')}
                    </button>

                    {ownBid.status === 'pending' && (
                      <button
                        type="button"
                        disabled={actionBidId === ownBid.id}
                        onClick={() =>
                          void runBidAction(
                            ownBid,
                            'withdraw'
                          )
                        }
                        className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-3 text-sm font-black text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {actionBidId === ownBid.id
                          ? t('working')
                          : t('withdrawBid')}
                      </button>
                    )}
                  </div>
                )}

              {ownBid.status === 'accepted' && (
                <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-black text-emerald-200">
                  Your bid was accepted by the project owner.
                </div>
              )}

              {ownBid.status === 'declined' && (
                <div className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-200">
                  The project owner selected another bid.
                </div>
              )}
            </div>
          ) : editing && ownBid ? (
            <div className="rounded-2xl border border-blue-400/20 bg-slate-950/30 p-5">
              <div className="mb-5">
                <div className="text-lg font-black text-white">
                  {ownBid.status === 'withdrawn'
                    ? t('resubmitYourBid')
                    : t('editYourBid')}
                </div>

                <p className="mt-1 text-sm text-slate-400">
                  {t('editBidHelp')}
                </p>
              </div>

              {renderBidForm(
                ownBid.status === 'withdrawn'
                  ? t('resubmitBid')
                  : t('saveChanges')
              )}
            </div>
          ) : deadlinePassed ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm font-bold text-amber-200">
              {t('bidDeadlinePassed')}
            </div>
          ) : (
            renderBidForm(t('submitBid'))
          )}
        </div>
      ) : (
        !message && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/30 p-5 text-sm font-bold text-slate-300">
            Sign in with a CrewCall Company account to submit or
            manage contractor bids.
          </div>
        )
      )}
    </section>
  )
}
