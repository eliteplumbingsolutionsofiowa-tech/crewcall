'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '@/lib/supabase'
import AIRecruiterHeartbeat from '@/app/components/AIRecruiterHeartbeat'

const db = supabase as any

type Worker = {
  id: string
  full_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  is_online: boolean | null
  location_visible: boolean | null
  location_updated_at: string | null
  insurance_verified: boolean | null
  liability_form_verified: boolean | null
  avatar_url: string | null
  years_experience: string | number | null
  skills: string[] | null
  crewcall_score: number | null
  license_number: string | null
  osha10: boolean | null
  osha30: boolean | null
  med_gas: boolean | null
  background_verified: boolean | null
  drug_tested: boolean | null
  availability_status: string | null
  available_for_work: boolean | null
  currently_working: boolean | null
  booked_until: string | null
  preferred_work: string[] | null
  willing_to_travel: boolean | null
}

type Coordinates = {
  latitude: number
  longitude: number
}

type RadiusOption = 10 | 25 | 50 | 100 | 250

type RankedWorker = Worker & {
  distance: number | null
  matchScore: number
  matchReasons: string[]
}

type AiInvitationDraft = {
  workerId: string
  workerName: string
  message: string
}

type AiRecruiterResult = {
  answer: string
  recommendation: string
  hiringRisk: 'Low' | 'Moderate' | 'High' | 'Unknown'
  confidence: number
  recommendedWorkerIds: string[]
  strengths: string[]
  concerns: string[]
  interviewQuestions: string[]
  invitationDrafts: AiInvitationDraft[]
}

type AiRecruiterResponse = {
  success?: boolean
  result?: AiRecruiterResult
  error?: string
}

const DEFAULT_CENTER: [number, number] = [41.5868, -93.625]
const DEFAULT_ZOOM = 8

function milesBetween(
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number
) {
  const earthRadiusMiles = 3958.8

  const toRadians = (degrees: number) => {
    return (degrees * Math.PI) / 180
  }

  const latitudeDifference = toRadians(
    secondLatitude - firstLatitude
  )

  const longitudeDifference = toRadians(
    secondLongitude - firstLongitude
  )

  const firstLatitudeRadians = toRadians(firstLatitude)
  const secondLatitudeRadians = toRadians(secondLatitude)

  const calculation =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitudeRadians) *
      Math.cos(secondLatitudeRadians) *
      Math.sin(longitudeDifference / 2) ** 2

  const angularDistance =
    2 * Math.atan2(Math.sqrt(calculation), Math.sqrt(1 - calculation))

  return earthRadiusMiles * angularDistance
}

function formatLastUpdated(
  value: string | null,
  locale: string,
  t: ReturnType<typeof useTranslations>
) {
  if (!value) {
    return t('locationUnavailable')
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return t('locationUnavailable')
  }

  return t('updated', {
    date: date.toLocaleString(locale),
  })
}

function getLocationFreshnessScore(value: string | null) {
  if (!value) {
    return 0
  }

  const updatedAt = new Date(value)

  if (Number.isNaN(updatedAt.getTime())) {
    return 0
  }

  const ageInHours =
    (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60)

  if (ageInHours <= 1) {
    return 10
  }

  if (ageInHours <= 6) {
    return 8
  }

  if (ageInHours <= 24) {
    return 5
  }

  if (ageInHours <= 72) {
    return 2
  }

  return 0
}

function getDistanceScore(
  distance: number | null,
  radius: RadiusOption
) {
  if (distance === null) {
    return 0
  }

  if (distance <= 5) {
    return 20
  }

  if (distance <= 15) {
    return 17
  }

  if (distance <= 30) {
    return 14
  }

  if (distance <= 50) {
    return 10
  }

  if (distance <= radius) {
    return 5
  }

  return 0
}

function getScoreTone(score: number) {
  if (score >= 85) {
    return 'border-emerald-400/30 bg-emerald-400/15 text-emerald-300'
  }

  if (score >= 70) {
    return 'border-cyan-400/30 bg-cyan-400/15 text-cyan-300'
  }

  if (score >= 50) {
    return 'border-amber-400/30 bg-amber-400/15 text-amber-300'
  }

  return 'border-slate-500/30 bg-slate-500/15 text-slate-300'
}

function RecenterMap({
  center,
}: {
  center: [number, number]
}) {
  const map = useMap()

  useEffect(() => {
    map.setView(center, map.getZoom())
  }, [center, map])

  return null
}

function parseExperienceYears(
  value: string | number | null | undefined
) {
  if (value === null || value === undefined || value === '') {
    return 0
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const match = String(value).match(/\d+(?:\.\d+)?/)

  if (!match) {
    return 0
  }

  const years = Number(match[0])

  return Number.isFinite(years) ? years : 0
}

function formatWorkerAvailability(
  worker: Worker,
  t: ReturnType<typeof useTranslations>
) {
  if (worker.currently_working === true && worker.booked_until) {
    return t('currentlyWorkingUntil', {
      date: worker.booked_until,
    })
  }

  if (worker.available_for_work === true) {
    return worker.availability_status
      ? t('availableStatus', {
          status: worker.availability_status,
        })
      : t('availableForWork')
  }

  if (worker.availability_status) {
    return worker.availability_status
  }

  if (worker.is_online === true) {
    return t('onlineAvailabilityUnknown')
  }

  return t('availabilityUnknown')
}

export default function WorkerMapClient() {
  const t = useTranslations('WorkerMap')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const jobId = searchParams.get('jobId')

  const [workers, setWorkers] = useState<Worker[]>([])
  const [companyLocation, setCompanyLocation] =
    useState<Coordinates | null>(null)

  const [selectedTrade, setSelectedTrade] = useState('all')
  const [radius, setRadius] = useState<RadiusOption>(50)
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [verifiedOnly, setVerifiedOnly] = useState(false)

  const [recruiterPrompt, setRecruiterPrompt] = useState('')
  const [recruiterActive, setRecruiterActive] = useState(false)
  const [recruiterSummary, setRecruiterSummary] = useState<string | null>(
    null
  )
  const [recruiterRunId, setRecruiterRunId] = useState(0)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<AiRecruiterResult | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteProgress, setInviteProgress] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [invitedWorkerIds, setInvitedWorkerIds] = useState<string[]>([])

  const [loading, setLoading] = useState(true)
  const [locating, setLocating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void loadWorkers()
  }, [])

  useEffect(() => {
    if (!jobId) {
      return
    }

    let cancelled = false

    async function preloadJob() {
      const { data } = await db
        .from('jobs')
        .select(
          'title, trade, location, pay_rate, start_date, description'
        )
        .eq('id', jobId)
        .maybeSingle()

      if (!data || cancelled) {
        return
      }

      const prompt = [
        data.title,
        data.trade,
        data.location,
        data.pay_rate
          ? `Pay $${Number(data.pay_rate).toLocaleString()}`
          : null,
        data.start_date
          ? `Starts ${new Date(data.start_date).toLocaleDateString()}`
          : null,
        data.description,
      ]
        .filter(Boolean)
        .join('. ')

      setRecruiterPrompt(prompt)
      runRecruiter(prompt)
    }

    void preloadJob()

    return () => {
      cancelled = true
    }
  }, [jobId])


  async function loadWorkers() {
    setLoading(true)
    setMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage(t('loginCompany'))
      setLoading(false)
      return
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setMessage(t('loginCompany'))
      setWorkers([])
      setLoading(false)
      return
    }

    const response = await fetch('/api/company/worker-map', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: 'no-store',
    })

    const result = await response.json().catch(() => null)

    if (!response.ok) {
      setMessage(
        result?.error ||
          'Unable to load workers.'
      )
      setWorkers([])
      setLoading(false)
      return
    }

    const availableWorkers = Array.isArray(result?.workers)
      ? (result.workers as Worker[])
      : []

    console.log('==============================')
    console.log('Workers available to recruiter:')
    console.log(availableWorkers)
    console.log('==============================')

    setWorkers(availableWorkers)
    setLoading(false)
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setMessage(t('locationUnsupported'))
      return
    }

    setLocating(true)
    setMessage(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCompanyLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })

        setLocating(false)
      },
      (error) => {
        console.error('Company location request failed:', error)

        if (error.code === 1) {
          setMessage(
            t('locationDenied')
          )
        } else if (error.code === 2) {
          setMessage(t('locationUnknown'))
        } else if (error.code === 3) {
          setMessage(t('locationTimeout'))
        } else {
          setMessage(t('locationLoadFailed'))
        }

        setLocating(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 120000,
      }
    )
  }

  const trades = useMemo(() => {
    const coreTrades = [
      'Plumbing',
      'HVAC',
      'Electrical',
      'Carpentry',
      'Welding',
      'Concrete',
      'Roofing',
      'Painting',
      'Drywall',
      'Masonry',
      'Excavation',
      'General Labor',
      'Heavy Equipment',
      'Landscaping',
      'Fire Protection',
    ]

    const workerTrades = workers
      .map((worker) => worker.trade?.trim())
      .filter((trade): trade is string => Boolean(trade))

    return Array.from(new Set([...coreTrades, ...workerTrades])).sort(
      (a, b) => a.localeCompare(b)
    )
  }, [workers])

  function runRecruiter(promptOverride?: string) {
    const sourcePrompt = promptOverride ?? recruiterPrompt
    const prompt = sourcePrompt.trim().toLowerCase()

    if (!prompt) {
      setMessage(
        t('describeWorkers')
      )
      return
    }

    setMessage(null)

    const matchedTrade = trades.find((trade) =>
      prompt.includes(trade.toLowerCase())
    )

    if (matchedTrade) {
      setSelectedTrade(matchedTrade)
    }

    if (
      prompt.includes('online') ||
      prompt.includes('available now') ||
      prompt.includes('right now') ||
      prompt.includes('today')
    ) {
      setOnlineOnly(true)
    }

    if (
      prompt.includes('verified') ||
      prompt.includes('insured') ||
      prompt.includes('insurance')
    ) {
      setVerifiedOnly(true)
    }

    const requestedRadius = prompt.match(
      /(?:within|under|less than)\s+(\d+)\s*(?:mile|miles|mi)/i
    )

    if (requestedRadius) {
      const parsedRadius = Number(requestedRadius[1])
      const allowedRadii: RadiusOption[] = [10, 25, 50, 100, 250]
      const nextRadius =
        allowedRadii.find((option) => option >= parsedRadius) || 250

      setRadius(nextRadius)
    }

    setRecruiterActive(true)
    setAiResult(null)
    setAiError(null)

    const summaryParts = [
      matchedTrade ? matchedTrade : t('allTrades'),
      onlineOnly ? t('onlinePrioritized') : t('availabilityConsidered'),
      verifiedOnly
        ? t('verifiedPrioritized')
        : t('verificationScored'),
      companyLocation
        ? t('withinMiles', { count: radius })
        : t('distanceAfterLocation'),
    ]

    setRecruiterSummary(summaryParts.join(' • '))
    setRecruiterRunId((current) => current + 1)
  }

  function clearRecruiter() {
    setRecruiterPrompt('')
    setRecruiterActive(false)
    setRecruiterSummary(null)
    setSelectedTrade('all')
    setRadius(50)
    setOnlineOnly(true)
    setVerifiedOnly(false)
    setAiResult(null)
    setAiError(null)
    setRecruiterRunId(0)
  }

  const rankedWorkers = useMemo<RankedWorker[]>(() => {
    const prompt = recruiterPrompt.trim().toLowerCase()

    return workers
      .map((worker) => {
        let distance: number | null = null

        if (
          companyLocation &&
          worker.latitude !== null &&
          worker.longitude !== null
        ) {
          distance = milesBetween(
            companyLocation.latitude,
            companyLocation.longitude,
            worker.latitude,
            worker.longitude
          )
        }

        let matchScore = 20
        const matchReasons: string[] = []

        if (
          selectedTrade !== 'all' &&
          worker.trade?.toLowerCase() === selectedTrade.toLowerCase()
        ) {
          matchScore += 30
          matchReasons.push(t('exactTradeMatch', { trade: selectedTrade }))
        } else if (selectedTrade === 'all') {
          matchScore += 10
          matchReasons.push(t('eligibleTrade'))
        }

        if (
          recruiterActive &&
          prompt &&
          worker.trade &&
          prompt.includes(worker.trade.toLowerCase())
        ) {
          matchScore += 5
        }

        if (worker.is_online === true) {
          matchScore += 15
          matchReasons.push(t('onlineNow'))
        }

        if (worker.insurance_verified === true) {
          matchScore += 12
          matchReasons.push(t('insuranceVerified'))
        }

        if (worker.liability_form_verified === true) {
          matchScore += 8
          matchReasons.push(t('liabilityVerified'))
        }

        const experienceYears = parseExperienceYears(
          worker.years_experience
        )

        if (experienceYears >= 10) {
          matchScore += 12
          matchReasons.push(t('yearsExperience', { count: experienceYears }))
        } else if (experienceYears >= 5) {
          matchScore += 8
          matchReasons.push(t('yearsExperience', { count: experienceYears }))
        } else if (experienceYears >= 2) {
          matchScore += 4
        }

        if (worker.license_number) {
          matchScore += 10
          matchReasons.push(t('licenseListed'))
        }

        if (worker.available_for_work === true) {
          matchScore += 12
          matchReasons.push(t('availableForWork'))
        }

        if (worker.currently_working === true) {
          matchScore -= 5
        }

        if (worker.background_verified === true) {
          matchScore += 5
        }

        if (worker.drug_tested === true) {
          matchScore += 4
        }

        if (worker.osha10 === true) {
          matchScore += 3
        }

        if (worker.osha30 === true) {
          matchScore += 5
        }

        if (worker.med_gas === true) {
          matchScore += 6
        }

        if (
          typeof worker.crewcall_score === 'number' &&
          worker.crewcall_score >= 90
        ) {
          matchScore += 10
          matchReasons.push(t('excellentScore'))
        } else if (
          typeof worker.crewcall_score === 'number' &&
          worker.crewcall_score >= 80
        ) {
          matchScore += 6
          matchReasons.push(t('strongScore'))
        }

        if (
          recruiterActive &&
          prompt &&
          Array.isArray(worker.skills)
        ) {
          const matchedSkills = worker.skills.filter((skill) =>
            prompt.includes(skill.toLowerCase())
          )

          if (matchedSkills.length > 0) {
            matchScore += Math.min(12, matchedSkills.length * 4)
            matchReasons.push(
              t('skillMatch', {
                skills: matchedSkills.slice(0, 2).join(', ')
              })
            )
          }
        }

        if (
          recruiterActive &&
          prompt &&
          Array.isArray(worker.preferred_work)
        ) {
          const preferredMatch = worker.preferred_work.some((work) =>
            prompt.includes(work.toLowerCase())
          )

          if (preferredMatch) {
            matchScore += 8
            matchReasons.push(t('preferredWorkMatch'))
          }
        }

        if (
          recruiterActive &&
          prompt.includes('travel') &&
          worker.willing_to_travel === true
        ) {
          matchScore += 6
          matchReasons.push(t('willingTravel'))
        }

        const distanceScore = getDistanceScore(distance, radius)
        matchScore += distanceScore

        if (distance !== null) {
          if (distance <= 15) {
            matchReasons.push(t('milesAway', { distance: distance.toFixed(1) }))
          } else if (distance <= radius) {
            matchReasons.push(t('withinRadius'))
          }
        }

        const freshnessScore = getLocationFreshnessScore(
          worker.location_updated_at
        )

        matchScore += freshnessScore

        if (freshnessScore >= 8) {
          matchReasons.push(t('recentLocation'))
        }

        return {
          ...worker,
          distance,
          matchScore: Math.min(100, matchScore),
          matchReasons: matchReasons.slice(0, 4),
        }
      })
      .filter((worker) => {
        if (onlineOnly && worker.is_online !== true) {
          return false
        }

        if (
          verifiedOnly &&
          worker.insurance_verified !== true &&
          worker.liability_form_verified !== true
        ) {
          return false
        }

        if (
          selectedTrade !== 'all' &&
          worker.trade?.toLowerCase() !== selectedTrade.toLowerCase()
        ) {
          return false
        }

        if (
          companyLocation &&
          worker.distance !== null &&
          worker.distance > radius
        ) {
          return false
        }

        return true
      })
      .sort((first, second) => {
        if (recruiterActive && first.matchScore !== second.matchScore) {
          return second.matchScore - first.matchScore
        }

        if (first.distance === null && second.distance === null) {
          return second.matchScore - first.matchScore
        }

        if (first.distance === null) {
          return 1
        }

        if (second.distance === null) {
          return -1
        }

        return first.distance - second.distance
      })
  }, [
    workers,
    companyLocation,
    onlineOnly,
    verifiedOnly,
    selectedTrade,
    radius,
    recruiterActive,
    recruiterPrompt,
  ])

  useEffect(() => {
    if (recruiterRunId === 0) {
      return
    }

    const question = recruiterPrompt.trim()

    if (!question) {
      return
    }

    if (rankedWorkers.length === 0) {
      setAiResult(null)
      setAiError(
        t('noMatches')
      )
      return
    }

    let cancelled = false

    async function requestAiRecommendation() {
      setAiLoading(true)
      setAiError(null)

      try {
        const response = await fetch('/api/ai/recruiter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question,
            job: {
              id: `worker-map-search-${recruiterRunId}`,
              title: question,
              trade:
                selectedTrade === 'all'
                  ? t('multipleTrades')
                  : selectedTrade,
              location: companyLocation
                ? `${companyLocation.latitude.toFixed(5)}, ${companyLocation.longitude.toFixed(5)}`
                : t('companyLocationNotShared'),
              payRate: t('notSpecified'),
              description: question,
            },
            workers: rankedWorkers.slice(0, 15).map((worker) => ({
              workerId: worker.id,
              name: worker.full_name || t('crewCallWorker'),
              trade: worker.trade || t('notListed'),
              location:
                [worker.city, worker.state]
                  .filter(Boolean)
                  .join(', ') || t('notListed'),
              matchScore: worker.matchScore,
              matchLabel:
                worker.matchScore >= 85
                  ? t('excellent')
                  : worker.matchScore >= 70
                    ? t('strong')
                    : worker.matchScore >= 50
                      ? t('possible')
                      : t('limited'),
              experience:
                worker.years_experience || t('notListed'),
              availability: formatWorkerAvailability(worker, t),
              crewcallScore: worker.crewcall_score,
              preferredPay: t('notListed'),
              skills: Array.from(
                new Set([
                  ...(worker.trade ? [worker.trade] : []),
                  ...(worker.skills || []),
                ])
              ),
              credentials: [
                worker.license_number
                  ? t('licenseListedValue', { number: worker.license_number })
                  : '',
                worker.insurance_verified
                  ? t('insuranceVerified')
                  : '',
                worker.liability_form_verified
                  ? t('liabilityFormVerified')
                  : '',
                worker.osha10 ? 'OSHA 10' : '',
                worker.osha30 ? 'OSHA 30' : '',
                worker.med_gas ? t('medicalGasCertified') : '',
                worker.background_verified
                  ? t('backgroundVerified')
                  : '',
                worker.drug_tested ? t('drugTested') : '',
                worker.willing_to_travel
                  ? t('willingTravel')
                  : '',
              ].filter(Boolean),
              preferredWork: worker.preferred_work || [],
              reasons: worker.matchReasons,
              warnings: [
                !worker.trade ? t('tradeNotListedWarning') : '',
                !worker.years_experience
                  ? t('experienceNotListed')
                  : '',
                !worker.license_number
                  ? t('licenseNotListed')
                  : '',
                worker.available_for_work !== true
                  ? t('availabilityNotConfirmed')
                  : '',
                !worker.insurance_verified
                  ? t('insuranceNotConfirmed')
                  : '',
                !worker.liability_form_verified
                  ? t('liabilityNotConfirmed')
                  : '',
                !worker.background_verified
                  ? t('backgroundNotConfirmed')
                  : '',
              ].filter(Boolean),
            })),
          }),
        })

        const payload = (await response
          .json()
          .catch(() => null)) as AiRecruiterResponse | null

        if (!response.ok) {
          throw new Error(
            payload?.error ||
              t('aiAnalyzeFailed')
          )
        }

        if (!payload?.result) {
          throw new Error(
            t('aiNoRecommendation')
          )
        }

        if (!cancelled) {
          setAiResult(payload.result)
        }
      } catch (error) {
        if (!cancelled) {
          setAiResult(null)
          setAiError(
            error instanceof Error
              ? error.message
              : t('aiUnavailable')
          )
        }
      } finally {
        if (!cancelled) {
          setAiLoading(false)
        }
      }
    }

    void requestAiRecommendation()

    return () => {
      cancelled = true
    }
  }, [recruiterRunId, rankedWorkers])

  async function sendAiInvitations(
    drafts: AiInvitationDraft[]
  ) {
    if (inviteSending) {
      return
    }

    setInviteError(null)
    setInviteProgress(null)

    if (!jobId) {
      setInviteError(
        t('openFromJob')
      )
      return
    }

    const pendingDrafts = drafts.filter(
      (draft) =>
        draft.workerId &&
        !invitedWorkerIds.includes(draft.workerId)
    )

    if (pendingDrafts.length === 0) {
      setInviteProgress(
        t('alreadyInvited')
      )
      return
    }

    setInviteSending(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error(
          t('loginToInvite')
        )
      }

      const successfullyInvited: string[] = []
      const failedInvitations: string[] = []

      for (let index = 0; index < pendingDrafts.length; index += 1) {
        const draft = pendingDrafts[index]

        setInviteProgress(
          t('sendingInvitation', { current: index + 1, total: pendingDrafts.length })
        )

        try {
          const response = await fetch(
            `/api/jobs/${jobId}/invite`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                workerId: draft.workerId,
              }),
            }
          )

          const payload = await response.json().catch(() => null)

          if (!response.ok) {
            throw new Error(
              payload?.error || t('invitationFailed')
            )
          }

          successfullyInvited.push(draft.workerId)
        } catch (error) {
          failedInvitations.push(
            `${draft.workerName}: ${
              error instanceof Error
                ? error.message
                : t('invitationFailedWorker')
            }`
          )
        }
      }

      if (successfullyInvited.length > 0) {
        setInvitedWorkerIds((current) =>
          Array.from(
            new Set([
              ...current,
              ...successfullyInvited,
            ])
          )
        )
      }

      if (failedInvitations.length > 0) {
        setInviteError(failedInvitations.join(' '))
      }

      const sentCount = successfullyInvited.length

      setInviteProgress(
        t('invitationsSent', { count: sentCount })
      )
    } catch (error) {
      setInviteError(
        error instanceof Error
          ? error.message
          : t('unableSendInvites')
      )
      setInviteProgress(null)
    } finally {
      setInviteSending(false)
    }
  }

  const bestMatch = recruiterActive ? rankedWorkers[0] : null

  const mapCenter: [number, number] = companyLocation
    ? [companyLocation.latitude, companyLocation.longitude]
    : DEFAULT_CENTER

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <AIRecruiterHeartbeat />
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
            {t('loading')}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 via-white/5 to-violet-500/10 p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
                {t('intelligence')}
              </p>

              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                {t('aiRecruiter')}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                {t('aiRecruiterDescription')}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
              >
                {locating ? t('findingLocation') : t('useMyLocation')}
              </button>

              <button
                type="button"
                onClick={() => void loadWorkers()}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {t('refreshWorkers')}
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white">
                {t('workerQuestion')}
              </span>

              <textarea
                value={recruiterPrompt}
                onChange={(event) =>
                  setRecruiterPrompt(event.target.value)
                }
                placeholder={t('promptPlaceholder')}
                rows={3}
                className="w-full resize-none rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60"
              />
            </label>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400">
                {t('promptHint')}
              </p>

              <div className="flex gap-2">
                {recruiterActive ? (
                  <button
                    type="button"
                    onClick={clearRecruiter}
                    className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    {t('clear')}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => runRecruiter()}
                  className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-110"
                >
                  {t('findBestWorkers')}
                </button>
              </div>
            </div>
          </div>
        </section>

        {message ? (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
            {message}
          </div>
        ) : null}

        {recruiterActive ? (
          <section className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-cyan-200">
                {t('matchesFound')}
              </p>
              <p className="mt-2 text-3xl font-bold">
                {rankedWorkers.length}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                {t('rankedDescription')}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-200">
                {t('bestMatchScore')}
              </p>
              <p className="mt-2 text-3xl font-bold">
                {bestMatch ? `${bestMatch.matchScore}%` : '—'}
              </p>
              <p className="mt-1 truncate text-xs text-slate-300">
                {bestMatch?.full_name || t('noMatchingWorker')}
              </p>
            </div>

            <div className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-200">
                {t('searchSummary')}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white">
                {recruiterSummary || t('filtersApplied')}
              </p>
            </div>
          </section>
        ) : null}

        {recruiterActive ? (
          <section className="mb-6 overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-slate-950/80 to-violet-500/10 shadow-2xl shadow-cyan-950/20">
            <div className="border-b border-white/10 px-6 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">
                    {t('aiRecruiter')}
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-white">
                    {t('aiAnalysis')}
                  </h2>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                    {t('aiAnalysisDescription')}
                  </p>
                </div>

                {aiResult ? (
                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                        {t('confidence')}
                      </p>
                      <p className="mt-1 text-lg font-bold text-white">
                        {Math.round(aiResult.confidence)}%
                      </p>
                    </div>

                    <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">
                        {t('hiringRisk')}
                      </p>
                      <p className="mt-1 text-lg font-bold text-white">
                        {aiResult.hiringRisk === 'Low'
                          ? t('riskLow')
                          : aiResult.hiringRisk === 'Moderate'
                            ? t('riskModerate')
                            : aiResult.hiringRisk === 'High'
                              ? t('riskHigh')
                              : t('riskUnknown')}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="p-6">
              {aiLoading ? (
                <div className="flex min-h-40 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                  <div>
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />

                    <p className="mt-4 font-semibold text-white">
                      {t('aiAnalyzing')}
                    </p>

                    <p className="mt-2 text-sm text-slate-400">
                      {t('aiReviewing')}
                    </p>
                  </div>
                </div>
              ) : aiError ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-5">
                  <p className="font-bold text-red-100">
                    {t('aiCouldNotComplete')}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-red-100/80">
                    {aiError}
                  </p>
                </div>
              ) : aiResult ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                      {t('recommendation')}
                    </p>

                    <p className="mt-3 text-base font-semibold leading-7 text-white">
                      {aiResult.recommendation}
                    </p>
                  </div>

                  {aiResult.answer ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
                        {t('recruiterAnalysis')}
                      </p>

                      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-200">
                        {aiResult.answer}
                      </p>
                    </div>
                  ) : null}

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
                        {t('strengths')}
                      </p>

                      {aiResult.strengths.length > 0 ? (
                        <div className="mt-4 space-y-3">
                          {aiResult.strengths.map((strength, index) => (
                            <div
                              key={`${strength}-${index}`}
                              className="flex gap-3 text-sm leading-6 text-emerald-50"
                            >
                              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
                              <span>{strength}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-emerald-100/70">
                          {t('noStrengths')}
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
                        {t('concerns')}
                      </p>

                      {aiResult.concerns.length > 0 ? (
                        <div className="mt-4 space-y-3">
                          {aiResult.concerns.map((concern, index) => (
                            <div
                              key={`${concern}-${index}`}
                              className="flex gap-3 text-sm leading-6 text-amber-50"
                            >
                              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-300" />
                              <span>{concern}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-amber-100/70">
                          {t('noConcerns')}
                        </p>
                      )}
                    </div>
                  </div>

                  {aiResult.interviewQuestions.length > 0 ? (
                    <div className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
                        {t('interviewQuestions')}
                      </p>

                      <div className="mt-4 space-y-3">
                        {aiResult.interviewQuestions.map(
                          (question, index) => (
                            <div
                              key={`${question}-${index}`}
                              className="flex gap-3 rounded-xl border border-white/10 bg-slate-950/30 p-4"
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-400/20 text-xs font-bold text-violet-100">
                                {index + 1}
                              </span>

                              <p className="text-sm leading-6 text-slate-100">
                                {question}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ) : null}

                  {aiResult.invitationDrafts.length > 0 ? (
                    <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">
                            {t('invitationDrafts')}
                          </p>

                          <p className="mt-2 text-sm text-blue-100/70">
                            {t('invitationDraftsDescription')}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void sendAiInvitations(
                                aiResult.invitationDrafts.slice(0, 3)
                              )
                            }
                            disabled={
                              inviteSending ||
                              !jobId ||
                              aiResult.invitationDrafts.length === 0
                            }
                            className="rounded-xl bg-blue-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {inviteSending
                              ? t('sending')
                              : t('inviteTop3')}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void sendAiInvitations(
                                aiResult.invitationDrafts
                              )
                            }
                            disabled={
                              inviteSending ||
                              !jobId ||
                              aiResult.invitationDrafts.length === 0
                            }
                            className="rounded-xl border border-blue-300/30 bg-blue-300/10 px-4 py-2.5 text-xs font-bold text-blue-100 transition hover:bg-blue-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t('inviteAll')}
                          </button>
                        </div>
                      </div>

                      {inviteProgress ? (
                        <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm font-semibold text-emerald-100">
                          {inviteProgress}
                        </div>
                      ) : null}

                      {inviteError ? (
                        <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm font-semibold text-red-100">
                          {inviteError}
                        </div>
                      ) : null}

                      {!jobId ? (
                        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                          {t('openRecruiterFromJob')}
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        {aiResult.invitationDrafts.map((draft, index) => (
                          <div
                            key={`${draft.workerId}-${index}`}
                            className="rounded-xl border border-white/10 bg-slate-950/40 p-4"
                          >
                            <p className="font-bold text-white">
                              {draft.workerName}
                            </p>

                            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-200">
                              {draft.message}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void sendAiInvitations([draft])
                                }
                                disabled={
                                  inviteSending ||
                                  !jobId ||
                                  invitedWorkerIds.includes(
                                    draft.workerId
                                  )
                                }
                                className="rounded-lg bg-blue-400 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {invitedWorkerIds.includes(
                                  draft.workerId
                                )
                                  ? t('invitationSent')
                                  : t('sendInvitation')}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void navigator.clipboard.writeText(
                                    draft.message
                                  )
                                }
                                className="rounded-lg border border-blue-300/20 bg-blue-300/10 px-3 py-2 text-xs font-bold text-blue-100 transition hover:bg-blue-300/20"
                              >
                                {t('copyInvitation')}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                  <p className="font-semibold text-white">
                    {t('runRecruiter')}
                  </p>
                </div>
              )}
            </div>
          </section>
        ) : null}

        <section className="mb-6 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 md:grid-cols-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-200">
              {t('trade')}
            </span>

            <select
              value={selectedTrade}
              onChange={(event) => setSelectedTrade(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white"
            >
              <option value="all">{t('allTradesFilter')}</option>

              {trades.map((trade) => (
                <option key={trade} value={trade}>
                  {trade}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-200">
              {t('distance')}
            </span>

            <select
              value={radius}
              onChange={(event) =>
                setRadius(Number(event.target.value) as RadiusOption)
              }
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white"
            >
              <option value={10}>{t('withinDistance', { count: 10 })}</option>
              <option value={25}>{t('withinDistance', { count: 25 })}</option>
              <option value={50}>{t('withinDistance', { count: 50 })}</option>
              <option value={100}>{t('withinDistance', { count: 100 })}</option>
              <option value={250}>{t('withinDistance', { count: 250 })}</option>
            </select>
          </label>

          <label className="flex items-end">
            <span className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5">
              <span className="text-sm font-semibold text-slate-200">
                {t('onlineOnly')}
              </span>

              <input
                type="checkbox"
                checked={onlineOnly}
                onChange={(event) => setOnlineOnly(event.target.checked)}
                className="h-4 w-4 accent-cyan-400"
              />
            </span>
          </label>

          <label className="flex items-end">
            <span className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5">
              <span className="text-sm font-semibold text-slate-200">
                {t('verifiedOnly')}
              </span>

              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(event) => setVerifiedOnly(event.target.checked)}
                className="h-4 w-4 accent-cyan-400"
              />
            </span>
          </label>

          <div className="flex items-end">
            <div className="w-full rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5">
              <p className="text-xs text-cyan-200">{t('workersShown')}</p>
              <p className="text-xl font-bold text-white">
                {rankedWorkers.length}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="h-[650px] w-full">
              <MapContainer
                center={mapCenter}
                zoom={DEFAULT_ZOOM}
                scrollWheelZoom
                className="h-full w-full"
              >
                <RecenterMap center={mapCenter} />

                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {companyLocation ? (
                  <CircleMarker
                    center={[
                      companyLocation.latitude,
                      companyLocation.longitude,
                    ]}
                    radius={10}
                    pathOptions={{
                      color: '#0891b2',
                      fillColor: '#22d3ee',
                      fillOpacity: 0.9,
                    }}
                  >
                    <Popup>{t('yourLocation')}</Popup>
                  </CircleMarker>
                ) : null}

                {rankedWorkers
                  .filter(
                    (worker) =>
                      typeof worker.latitude === 'number' &&
                      typeof worker.longitude === 'number'
                  )
                  .map((worker, index) => (
                  <CircleMarker
                    key={worker.id}
                    center={[
                      worker.latitude as number,
                      worker.longitude as number,
                    ]}
                    radius={
                      recruiterActive && index === 0
                        ? 13
                        : 9
                    }
                    pathOptions={{
                      color:
                        recruiterActive && index === 0
                          ? '#7c3aed'
                          : worker.is_online === true
                            ? '#047857'
                            : '#475569',
                      fillColor:
                        recruiterActive && index === 0
                          ? '#a78bfa'
                          : worker.is_online === true
                            ? '#34d399'
                            : '#94a3b8',
                      fillOpacity: 0.9,
                    }}
                  >
                    <Popup>
                      <div className="min-w-56">
                        {recruiterActive ? (
                          <p className="mb-2 font-bold text-violet-700">
                            {index === 0
                              ? t('bestMatch')
                              : t('matchPercent', { score: worker.matchScore })}
                          </p>
                        ) : null}

                        <p className="font-bold">
                          {worker.full_name || t('crewCallWorker')}
                        </p>

                        <p>{worker.trade || t('tradeNotListed')}</p>

                        <p>
                          {[worker.city, worker.state]
                            .filter(Boolean)
                            .join(', ') || t('locationNotListed')}
                        </p>

                        {worker.distance !== null ? (
                          <p>{t('milesAway', { distance: worker.distance.toFixed(1) })}</p>
                        ) : null}

                        <Link
                          href={`/profile/${worker.id}`}
                          className="mt-3 inline-block font-semibold text-cyan-700"
                        >
                          {t('viewProfileLower')}
                        </Link>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </section>

          <aside className="max-h-[650px] space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-4">
            {rankedWorkers.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-slate-900 p-5 text-center text-sm text-slate-400">
                {t('noWorkersFilters')}
              </div>
            ) : (
              rankedWorkers.map((worker, index) => (
                <article
                  key={worker.id}
                  className={`rounded-xl border p-4 ${
                    recruiterActive && index === 0
                      ? 'border-violet-400/50 bg-gradient-to-br from-violet-500/20 to-cyan-500/10'
                      : 'border-white/10 bg-slate-900'
                  }`}
                >
                  {recruiterActive && index === 0 ? (
                    <div className="mb-3 flex items-center justify-between rounded-lg bg-violet-400/15 px-3 py-2">
                      <span className="text-xs font-bold uppercase tracking-[0.15em] text-violet-200">
                        {t('bestOverallMatch')}
                      </span>
                      <span className="text-sm font-bold text-white">
                        #{index + 1}
                      </span>
                    </div>
                  ) : recruiterActive ? (
                    <p className="mb-2 text-xs font-semibold text-slate-500">
                      {t('rankedNumber', { number: index + 1 })}
                    </p>
                  ) : null}

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-white">
                        {worker.full_name || t('crewCallWorker')}
                      </h2>

                      <p className="mt-1 text-sm text-cyan-300">
                        {worker.trade || t('tradeNotListed')}
                      </p>
                    </div>

                    {recruiterActive ? (
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getScoreTone(
                          worker.matchScore
                        )}`}
                      >
                        {t('matchPercent', { score: worker.matchScore })}
                      </span>
                    ) : (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          worker.is_online
                            ? 'bg-emerald-400/15 text-emerald-300'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {worker.is_online ? t('online') : t('offline')}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-sm text-slate-300">
                    {[worker.city, worker.state]
                      .filter(Boolean)
                      .join(', ') || t('locationNotListed')}
                  </p>

                  {worker.distance !== null ? (
                    <p className="mt-1 text-sm font-semibold text-white">
                      {worker.distance.toFixed(1)} miles away
                    </p>
                  ) : null}

                  {recruiterActive && worker.matchReasons.length > 0 ? (
                    <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        {t('whyMatched')}
                      </p>

                      <ul className="space-y-1.5">
                        {worker.matchReasons.map((reason) => (
                          <li
                            key={reason}
                            className="flex items-start gap-2 text-xs text-slate-200"
                          >
                            <span className="mt-0.5 text-emerald-300">✓</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {worker.is_online ? (
                      <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                        {t('onlineNow')}
                      </span>
                    ) : null}

                    {worker.insurance_verified ? (
                      <span className="rounded-full bg-blue-400/15 px-2.5 py-1 text-xs font-semibold text-blue-300">
                        {t('insuranceVerified')}
                      </span>
                    ) : null}

                    {worker.liability_form_verified ? (
                      <span className="rounded-full bg-violet-400/15 px-2.5 py-1 text-xs font-semibold text-violet-300">
                        {t('liabilityVerified')}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    {formatLastUpdated(worker.location_updated_at, locale, t)}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      href={`/profile/${worker.id}`}
                      className="rounded-lg border border-cyan-400/40 px-3 py-2 text-center text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/10"
                    >
                      {t('viewProfile')}
                    </Link>

                    <Link
                      href={`/workers/${worker.id}/invite`}
                      className="rounded-lg bg-cyan-400 px-3 py-2 text-center text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                    >
                      {t('inviteWorker')}
                    </Link>
                  </div>
                </article>
              ))
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}