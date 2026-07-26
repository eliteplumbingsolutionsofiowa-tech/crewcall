import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type Job = {
  id: string
  company_id: string
  title: string | null
  trade: string | null
  location: string | null
  pay_rate: string | null
  description: string | null
}

type WorkerProfile = {
  id: string
  full_name: string | null
  company_name: string | null
  trade: string | null
  city: string | null
  state: string | null
  years_experience: string | number | null
  availability_status: string | null
  available_for_work: boolean | null
  currently_working: boolean | null
  booked_until: string | null
  willing_to_travel: boolean | null
  travel_radius: number | null
  expected_pay_min: number | null
  expected_pay_max: number | null
  crewcall_score: number | null
  skills: string[] | null
  preferred_work: string[] | null
  osha10: boolean | null
  osha30: boolean | null
  med_gas: boolean | null
  background_verified: boolean | null
  drug_tested: boolean | null
  license_number: string | null
  liability_form_signed: boolean | null
  insurance_provider: string | null
  is_online: boolean | null
  last_seen: string | null
}

type MatchInsert = {
  job_id: string
  worker_id: string
  match_score: number
  trade_score: number
  location_score: number
  availability_score: number
  certification_score: number
  online_score: number
  pay_score: number
  reason: string
}

type RankedMatch = MatchInsert & {
  worker: WorkerProfile
  rank: number
  match_label: string
  match_reasons: string[]
  warnings: string[]
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null

const STOP_WORDS = new Set([
  'and',
  'the',
  'for',
  'with',
  'from',
  'this',
  'that',
  'job',
  'work',
  'worker',
  'needed',
  'need',
  'looking',
  'seeking',
  'project',
  'position',
  'crew',
  'help',
  'must',
  'have',
  'will',
  'your',
  'our',
  'are',
  'you',
  'into',
  'onto',
  'near',
  'per',
])

function normalize(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function parseNumericValue(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''))

  return Number.isFinite(parsed) ? parsed : 0
}

function parsePayRange(value: string | null | undefined) {
  const matches = String(value ?? '').match(/\d+(?:\.\d+)?/g) ?? []
  const values = matches
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)

  if (values.length === 0) {
    return {
      minimum: 0,
      maximum: 0,
      target: 0,
    }
  }

  if (values.length === 1) {
    return {
      minimum: values[0],
      maximum: values[0],
      target: values[0],
    }
  }

  const minimum = Math.min(...values)
  const maximum = Math.max(...values)

  return {
    minimum,
    maximum,
    target: (minimum + maximum) / 2,
  }
}

function tokenize(value: unknown) {
  return unique(
    normalize(value)
      .split(/[\s,/|()-]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
  )
}

function countKeywordMatches(jobTokens: string[], workerTokens: string[]) {
  if (jobTokens.length === 0 || workerTokens.length === 0) {
    return []
  }

  return unique(
    jobTokens.filter((jobToken) =>
      workerTokens.some(
        (workerToken) =>
          workerToken === jobToken ||
          workerToken.includes(jobToken) ||
          jobToken.includes(workerToken)
      )
    )
  )
}

function getYearsExperience(value: string | number | null) {
  if (typeof value === 'number') {
    return clamp(value, 0, 60)
  }

  const match = String(value ?? '').match(/\d+(?:\.\d+)?/)

  if (!match) {
    return 0
  }

  return clamp(Number(match[0]) || 0, 0, 60)
}

function minutesSince(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const timestamp = new Date(value).getTime()

  if (Number.isNaN(timestamp)) {
    return null
  }

  return Math.max(0, (Date.now() - timestamp) / 60_000)
}

function workerName(worker: WorkerProfile) {
  return (
    worker.full_name?.trim() ||
    worker.company_name?.trim() ||
    'CrewCall Worker'
  )
}

function getMatchLabel(score: number) {
  if (score >= 90) return 'Excellent Match'
  if (score >= 80) return 'Strong Match'
  if (score >= 70) return 'Good Match'
  if (score >= 55) return 'Possible Match'

  return 'Limited Match'
}

function scoreWorker(
  job: Job,
  worker: WorkerProfile
): Omit<RankedMatch, 'rank'> {
  const reasons: string[] = []
  const warnings: string[] = []

  const jobTrade = normalize(job.trade)
  const workerTrade = normalize(worker.trade)

  const jobLocation = normalize(job.location)
  const workerCity = normalize(worker.city)
  const workerState = normalize(worker.state)

  const jobText = normalize(
    [
      job.title,
      job.trade,
      job.location,
      job.description,
    ]
      .filter(Boolean)
      .join(' ')
  )

  const workerText = normalize(
    [
      worker.trade,
      worker.city,
      worker.state,
      ...(worker.skills ?? []),
      ...(worker.preferred_work ?? []),
    ]
      .filter(Boolean)
      .join(' ')
  )

  const jobTokens = tokenize(jobText)
  const workerTokens = tokenize(workerText)
  const keywordMatches = countKeywordMatches(jobTokens, workerTokens)

  let tradeScore = 0
  let locationScore = 0
  let availabilityScore = 0
  let certificationScore = 0
  let onlineScore = 0
  let payScore = 0
  let experienceScore = 0
  let reputationScore = 0
  let penalty = 0

  /*
   * Trade and skill matching
   * Maximum: 30 points
   */
  if (jobTrade && workerTrade && jobTrade === workerTrade) {
    tradeScore = 24
    reasons.push(`Exact ${job.trade || 'trade'} trade match`)
  } else if (
    jobTrade &&
    workerTrade &&
    (workerTrade.includes(jobTrade) || jobTrade.includes(workerTrade))
  ) {
    tradeScore = 20
    reasons.push('Closely related trade')
  }

  const workerSkills = [
    ...(worker.skills ?? []),
    ...(worker.preferred_work ?? []),
  ].map(normalize)

  const directSkillMatch = workerSkills.some(
    (skill) =>
      Boolean(jobTrade) &&
      (skill === jobTrade ||
        skill.includes(jobTrade) ||
        jobTrade.includes(skill))
  )

  if (directSkillMatch) {
    tradeScore = Math.max(tradeScore, 22)
    reasons.push('Listed skills match the job trade')
  }

  if (keywordMatches.length > 0) {
    const keywordBonus = Math.min(8, keywordMatches.length * 2)
    tradeScore = Math.min(30, tradeScore + keywordBonus)

    reasons.push(
      `Matching skills: ${keywordMatches.slice(0, 4).join(', ')}`
    )
  }

  /*
   * Location and travel
   * Maximum: 15 points
   */
  const cityMatch =
    Boolean(workerCity) && Boolean(jobLocation) && jobLocation.includes(workerCity)

  const stateMatch =
    Boolean(workerState) &&
    Boolean(jobLocation) &&
    jobLocation.includes(workerState)

  if (cityMatch) {
    locationScore = 15
    reasons.push('Located in the job area')
  } else if (stateMatch) {
    locationScore = 10
    reasons.push('Located in the same state')
  } else if (
    worker.willing_to_travel &&
    Number(worker.travel_radius ?? 0) >= 50
  ) {
    locationScore = 8
    reasons.push(
      `Willing to travel up to ${Number(worker.travel_radius)} miles`
    )
  } else if (
    worker.willing_to_travel ||
    Number(worker.travel_radius ?? 0) >= 25
  ) {
    locationScore = 5
    reasons.push('Willing to travel')
  } else if (!jobLocation) {
    locationScore = 5
  } else {
    warnings.push('Location may be outside the worker’s preferred area')
  }

  /*
   * Availability
   * Maximum: 20 points
   */
  const availability = normalize(worker.availability_status)
  const bookedUntil = worker.booked_until
    ? new Date(worker.booked_until)
    : null

  const isBooked =
    worker.currently_working === true &&
    bookedUntil !== null &&
    !Number.isNaN(bookedUntil.getTime()) &&
    bookedUntil.getTime() > Date.now()

  if (
    worker.available_for_work === true &&
    availability === 'available_today'
  ) {
    availabilityScore = 20
    reasons.push('Available today')
  } else if (
    worker.available_for_work === true ||
    availability === 'available'
  ) {
    availabilityScore = 17
    reasons.push('Available for work')
  } else if (availability === 'available_tomorrow') {
    availabilityScore = 14
    reasons.push('Available tomorrow')
  } else if (availability === 'available_this_week') {
    availabilityScore = 11
    reasons.push('Available this week')
  } else if (availability === 'weekends_only') {
    availabilityScore = 7
    reasons.push('Available on weekends')
  } else if (isBooked) {
    availabilityScore = 2
    penalty += 8
    warnings.push(
      `Currently booked until ${bookedUntil?.toLocaleDateString('en-US')}`
    )
  } else if (worker.available_for_work === false) {
    availabilityScore = 0
    penalty += 12
    warnings.push('Not currently marked available for work')
  } else {
    availabilityScore = 5
    warnings.push('Availability has not been confirmed')
  }

  /*
   * Certifications and verification
   * Maximum: 12 points
   */
  if (worker.license_number) {
    certificationScore += 3
    reasons.push('License information provided')
  }

  if (worker.insurance_provider) {
    certificationScore += 2
    reasons.push('Insurance information provided')
  }

  if (worker.liability_form_signed) {
    certificationScore += 1
  }

  if (worker.osha10) {
    certificationScore += 1
  }

  if (worker.osha30) {
    certificationScore += 2
  }

  const jobNeedsMedicalGas =
    jobText.includes('medical gas') ||
    jobText.includes('med gas') ||
    jobText.includes('oxygen') ||
    jobText.includes('nitrous')

  if (worker.med_gas && jobNeedsMedicalGas) {
    certificationScore += 4
    reasons.push('Medical gas certification matches job requirements')
  } else if (worker.med_gas) {
    certificationScore += 1
  }

  if (worker.background_verified) {
    certificationScore += 2
    reasons.push('Background verified')
  }

  if (worker.drug_tested) {
    certificationScore += 1
  }

  certificationScore = Math.min(certificationScore, 12)

  /*
   * Online activity
   * Maximum: 8 points
   */
  const lastSeenMinutes = minutesSince(worker.last_seen)

  if (worker.is_online && lastSeenMinutes !== null && lastSeenMinutes <= 5) {
    onlineScore = 8
    reasons.push('Online now')
  } else if (lastSeenMinutes !== null && lastSeenMinutes <= 60) {
    onlineScore = 6
    reasons.push('Active within the last hour')
  } else if (lastSeenMinutes !== null && lastSeenMinutes <= 1_440) {
    onlineScore = 4
    reasons.push('Active within the last day')
  } else if (lastSeenMinutes !== null && lastSeenMinutes <= 10_080) {
    onlineScore = 2
    reasons.push('Active within the last week')
  } else if (lastSeenMinutes !== null && lastSeenMinutes > 43_200) {
    penalty += 3
    warnings.push('Worker has not been active recently')
  }

  /*
   * Pay compatibility
   * Maximum: 10 points
   */
  const jobPay = parsePayRange(job.pay_rate)
  const expectedMinimum = parseNumericValue(worker.expected_pay_min)
  const expectedMaximum = parseNumericValue(worker.expected_pay_max)

  if (jobPay.target > 0) {
    if (
      expectedMinimum > 0 &&
      expectedMaximum > 0 &&
      jobPay.maximum >= expectedMinimum &&
      jobPay.minimum <= expectedMaximum
    ) {
      payScore = 10
      reasons.push('Job pay overlaps the worker’s preferred range')
    } else if (
      expectedMinimum > 0 &&
      jobPay.maximum >= expectedMinimum
    ) {
      payScore = 8
      reasons.push('Job pay meets the worker’s minimum')
    } else if (
      expectedMaximum > 0 &&
      jobPay.minimum <= expectedMaximum
    ) {
      payScore = 7
      reasons.push('Job pay may fit the worker’s range')
    } else if (expectedMinimum === 0 && expectedMaximum === 0) {
      payScore = 5
    } else if (
      expectedMinimum > 0 &&
      jobPay.maximum < expectedMinimum
    ) {
      payScore = 1
      penalty += 5
      warnings.push('Job pay may be below the worker’s preferred minimum')
    }
  } else {
    payScore = 4
  }

  /*
   * Experience
   * Maximum: 8 points
   */
  const yearsExperience = getYearsExperience(worker.years_experience)

  if (yearsExperience >= 15) {
    experienceScore = 8
    reasons.push(`${Math.floor(yearsExperience)}+ years of experience`)
  } else if (yearsExperience >= 10) {
    experienceScore = 7
    reasons.push(`${Math.floor(yearsExperience)} years of experience`)
  } else if (yearsExperience >= 5) {
    experienceScore = 5
    reasons.push(`${Math.floor(yearsExperience)} years of experience`)
  } else if (yearsExperience >= 2) {
    experienceScore = 3
  } else if (yearsExperience > 0) {
    experienceScore = 1
  }

  /*
   * CrewCall reputation
   * Maximum: 12 points
   */
  const crewCallScore = clamp(
    parseNumericValue(worker.crewcall_score),
    0,
    100
  )

  reputationScore = Math.round((crewCallScore / 100) * 12)

  if (crewCallScore >= 90) {
    reasons.push('Excellent CrewCall reputation')
  } else if (crewCallScore >= 80) {
    reasons.push('Strong CrewCall reputation')
  } else if (crewCallScore > 0 && crewCallScore < 50) {
    warnings.push('Lower CrewCall reputation score')
  }

  /*
   * Final weighted score
   */
  const rawScore =
    tradeScore +
    locationScore +
    availabilityScore +
    certificationScore +
    onlineScore +
    payScore +
    experienceScore +
    reputationScore -
    penalty

  const matchScore = clamp(Math.round(rawScore), 0, 100)

  const finalReasons = unique(reasons).slice(0, 6)
  const finalWarnings = unique(warnings).slice(0, 3)

  const summary =
    finalReasons.length > 0
      ? finalReasons.join(' • ')
      : `${workerName(worker)} may be a possible fit for this job.`

  return {
    job_id: job.id,
    worker_id: worker.id,
    match_score: matchScore,
    trade_score: tradeScore,
    location_score: locationScore,
    availability_score: availabilityScore,
    certification_score: certificationScore,
    online_score: onlineScore,
    pay_score: payScore,
    reason: summary,
    worker,
    match_label: getMatchLabel(matchScore),
    match_reasons: finalReasons,
    warnings: finalWarnings,
  }
}

async function createWorkerNotifications(
  job: Job,
  matches: RankedMatch[]
) {
  if (!supabaseAdmin || matches.length === 0) {
    return
  }

  const topMatches = matches
    .filter((match) => match.match_score >= 65)
    .slice(0, 10)

  if (topMatches.length === 0) {
    return
  }

  const notifications = topMatches.map((match) => ({
    user_id: match.worker_id,
    title: 'New matching job',
    message: `${job.title || 'A new job'} is a ${
      match.match_score
    }% match for your profile.`,
    job_id: job.id,
    read: false,
  }))

  const { error } = await supabaseAdmin
    .from('notifications')
    .insert(notifications)

  if (error) {
    console.warn(
      'AI worker matching: notification insert skipped:',
      error.message
    )
  }
}

export async function POST(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error:
            'Supabase service role is not configured. Check SUPABASE_SERVICE_ROLE_KEY.',
        },
        { status: 500 }
      )
    }

    const body = await req.json().catch(() => null)
    const jobId =
      typeof body?.jobId === 'string'
        ? body.jobId.trim()
        : ''

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId.' },
        { status: 400 }
      )
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select(
        'id, company_id, title, trade, location, pay_rate, description'
      )
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        {
          error: jobError?.message || 'Job not found.',
        },
        { status: 404 }
      )
    }

    const { data: workers, error: workersError } = await supabaseAdmin
      .from('profiles')
      .select(
        `
        id,
        full_name,
        company_name,
        trade,
        city,
        state,
        years_experience,
        availability_status,
        available_for_work,
        currently_working,
        booked_until,
        willing_to_travel,
        travel_radius,
        expected_pay_min,
        expected_pay_max,
        crewcall_score,
        skills,
        preferred_work,
        osha10,
        osha30,
        med_gas,
        background_verified,
        drug_tested,
        license_number,
        liability_form_signed,
        insurance_provider,
        is_online,
        last_seen
      `
      )
      .eq('role', 'worker')

    if (workersError) {
      return NextResponse.json(
        { error: workersError.message },
        { status: 500 }
      )
    }

    const rankedMatches: RankedMatch[] = (
      (workers ?? []) as WorkerProfile[]
    )
      .map((worker) => scoreWorker(job as Job, worker))
      .filter((match) => match.match_score >= 25)
      .sort((a, b) => {
        if (b.match_score !== a.match_score) {
          return b.match_score - a.match_score
        }

        if (b.trade_score !== a.trade_score) {
          return b.trade_score - a.trade_score
        }

        return b.availability_score - a.availability_score
      })
      .slice(0, 25)
      .map((match, index) => ({
        ...match,
        rank: index + 1,
      }))

    const databaseMatches: MatchInsert[] = rankedMatches.map(
      ({
        worker: _worker,
        rank: _rank,
        match_label: _matchLabel,
        match_reasons: _matchReasons,
        warnings: _warnings,
        ...match
      }) => match
    )

    const { error: deleteError } = await supabaseAdmin
      .from('job_matches')
      .delete()
      .eq('job_id', jobId)

    if (deleteError) {
      return NextResponse.json(
        {
          error: `Unable to clear previous matches: ${deleteError.message}`,
        },
        { status: 500 }
      )
    }

    if (databaseMatches.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('job_matches')
        .insert(databaseMatches)

      if (insertError) {
        return NextResponse.json(
          {
            error: `Unable to save worker matches: ${insertError.message}`,
          },
          { status: 500 }
        )
      }
    }

    await createWorkerNotifications(
      job as Job,
      rankedMatches
    )

    return NextResponse.json({
      success: true,
      jobId,
      jobTitle: job.title,
      totalWorkersReviewed: workers?.length ?? 0,
      matchesCreated: rankedMatches.length,
      excellentMatches: rankedMatches.filter(
        (match) => match.match_score >= 90
      ).length,
      strongMatches: rankedMatches.filter(
        (match) =>
          match.match_score >= 80 &&
          match.match_score < 90
      ).length,
      matches: rankedMatches,
    })
  } catch (error) {
    console.error('AI worker matching route error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create AI worker matches.',
      },
      { status: 500 }
    )
  }
}