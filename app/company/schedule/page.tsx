'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { resolveCompanyContext } from '@/lib/company-context'

type Job = {
  id: string
  title: string | null
  trade: string | null
  location: string | null
  start_date: string | null
  status: string | null
  assigned_worker_id: string | null
}

type Worker = {
  id: string
  full_name: string | null
}

type ScheduleItem = {
  id: string
  worker: string
  trade: string
  job: string
  location: string
  date: Date
  time: string
  status: string
}

const days = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
] as const

function formatTime(date: Date, locale: string) {
  return date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function WorkforceSchedulePage() {
  const t = useTranslations('CompanySchedule')
  const locale = useLocale()

  const weekdayKeys = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ] as const

  const [selectedDay, setSelectedDay] =
    useState<(typeof weekdayKeys)[number]>(
      weekdayKeys[new Date().getDay()]
    )

  const [jobs, setJobs] = useState<Job[]>([])
  const [workers, setWorkers] = useState<Record<string, Worker>>({})
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void loadSchedule()
  }, [])

  async function loadSchedule() {
    setLoading(true)
    setMessage('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setMessage(
          t('loginRequired')
        )
        return
      }

      const companyContext =
        await resolveCompanyContext(
          supabase,
          user.id
        )

      if (!companyContext.companyId) {
        setMessage(
          t('companyRequired')
        )
        return
      }

      const { data: jobsData, error: jobsError } =
        await supabase
          .from('jobs')
          .select(
            `
            id,
            title,
            trade,
            location,
            start_date,
            status,
            assigned_worker_id
            `
          )
          .eq(
            'company_id',
            companyContext.companyId
          )
          .not('start_date', 'is', null)
          .order('start_date', {
            ascending: true,
          })

      if (jobsError) {
        throw jobsError
      }

      const loadedJobs =
        (jobsData || []) as Job[]

      setJobs(loadedJobs)

      const workerIds = [
        ...new Set(
          loadedJobs
            .map(
              (job) =>
                job.assigned_worker_id
            )
            .filter(
              (id): id is string =>
                Boolean(id)
            )
        ),
      ]

      if (workerIds.length > 0) {
        const {
          data: workerData,
          error: workerError,
        } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', workerIds)

        if (workerError) {
          throw workerError
        }

        const map: Record<
          string,
          Worker
        > = {}

        ;(
          (workerData || []) as Worker[]
        ).forEach((worker) => {
          map[worker.id] = worker
        })

        setWorkers(map)
      } else {
        setWorkers({})
      }
    } catch (error) {
      console.error(
        'Schedule load failed:',
        error
      )

      setMessage(
        error instanceof Error
          ? error.message
          : t('loadFailed')
      )
    } finally {
      setLoading(false)
    }
  }

  const scheduleItems =
    useMemo<ScheduleItem[]>(() => {
      return jobs
        .filter((job) => job.start_date)
        .map((job) => {
          const date =
            new Date(job.start_date || '')

          const worker =
            job.assigned_worker_id
              ? workers[
                  job.assigned_worker_id
                ]
              : null

          return {
            id: job.id,
            worker:
              worker?.full_name ||
              t('unassigned'),
            trade:
              job.trade ||
              t('tradeNotSet'),
            job:
              job.title ||
              t('untitledJob'),
            location:
              job.location ||
              t('locationNotSet'),
            date,
            time: formatTime(date, locale),
            status:
              job.status ||
              'open',
          }
        })
        .filter(
          (item) =>
            !Number.isNaN(
              item.date.getTime()
            )
        )
    }, [jobs, workers, locale, t])

  const selectedItems =
    useMemo(() => {
      return scheduleItems.filter(
        (item) =>
          weekdayKeys[item.date.getDay()] ===
          selectedDay
      )
    }, [
      scheduleItems,
      selectedDay,
    ])

  const stats = useMemo(() => {
    const scheduledWorkers =
      new Set(
        scheduleItems
          .filter(
            (item) =>
              Boolean(
              jobs.find(
                (job) => job.id === item.id
              )?.assigned_worker_id
            )
          )
          .map(
            (item) => item.worker
          )
      ).size

    const activeJobs =
      scheduleItems.filter(
        (item) =>
          item.status ===
            'assigned' ||
          item.status ===
            'in_progress'
      ).length

    const unassigned =
      scheduleItems.filter(
        (item) =>
          !jobs.find(
            (job) => job.id === item.id
          )?.assigned_worker_id
      ).length

    return [
      {
        label:
          t('workersScheduled'),
        value:
          String(
            scheduledWorkers
          ),
      },
      {
        label: t('scheduledJobs'),
        value:
          String(
            scheduleItems.length
          ),
      },
      {
        label: t('activeJobs'),
        value:
          String(activeJobs),
      },
      {
        label: t('unassigned'),
        value:
          String(unassigned),
      },
    ]
  }, [jobs, scheduleItems, t])

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            {t('operations')}
          </p>

          <h1 className="mt-3 text-4xl font-black">
            {t('title')}
          </h1>

          <p className="mt-3 text-slate-400">
            {t('description')}
          </p>
        </section>

        {message ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5 text-sm font-bold text-red-200">
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(
            (item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <p className="text-xs font-bold uppercase text-slate-500">
                  {item.label}
                </p>

                <p className="mt-2 text-3xl font-black">
                  {item.value}
                </p>
              </div>
            )
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap gap-3">
            {days.map((day) => (
              <button
                key={day}
                onClick={() =>
                  setSelectedDay(day)
                }
                className={
                  selectedDay === day
                    ? 'rounded-xl bg-cyan-400 px-5 py-2 font-black text-slate-950'
                    : 'rounded-xl bg-white/10 px-5 py-2 font-bold'
                }
              >
                {t(day)}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-5">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-300">
              {t('loading')}
            </div>
          ) : selectedItems.length ===
            0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
              <h2 className="text-xl font-black">
                {t('noJobsScheduled', {
                  day: t(selectedDay),
                })}
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                {t('jobsAppearAutomatically')}
              </p>
            </div>
          ) : (
            selectedItems.map(
              (item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-black">
                        {item.job}
                      </h2>

                      <p className="mt-1 text-slate-400">
                        {item.worker} •{' '}
                        {item.trade}
                      </p>

                      <p className="mt-2 text-sm text-slate-500">
                        {item.location}{' '}
                        • {item.time}
                      </p>
                    </div>

                    <span
                      className={
                        item.status ===
                        'completed'
                          ? 'rounded-full bg-green-400/20 px-4 py-2 text-sm font-bold text-green-300'
                          : item.status ===
                              'open'
                            ? 'rounded-full bg-yellow-400/20 px-4 py-2 text-sm font-bold text-yellow-300'
                            : 'rounded-full bg-cyan-400/20 px-4 py-2 text-sm font-bold text-cyan-300'
                      }
                    >
                      {t(
                        `status.${item.status}` as
                          | 'status.open'
                          | 'status.assigned'
                          | 'status.in_progress'
                          | 'status.completed'
                          | 'status.closed'
                          | 'status.cancelled',
                        {
                          fallback:
                            item.status.replaceAll(
                              '_',
                              ' '
                            ),
                        }
                      )}
                    </span>
                  </div>
                </div>
              )
            )
          )}
        </section>

        <section className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-6">
          <h2 className="text-xl font-black">
            {t('overview')}
          </h2>

          <p className="mt-3 text-sm leading-6 text-slate-300">
            {t('overviewDescription')}
          </p>
        </section>
      </div>
    </main>
  )
}
