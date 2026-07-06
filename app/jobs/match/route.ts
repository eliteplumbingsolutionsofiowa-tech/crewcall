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
  availability_status: string | null
  available_for_work: boolean | null
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

function parsePay(value: string | null | undefined) {
  if (!value) return 0
  return Number(String(value).replace(/[^0-9.]/g, '')) || 0
}

function isRecentlyOnline(worker: WorkerProfile) {
  if (!worker.is_online || !worker.last_seen) return false

  const lastSeen = new Date(worker.last_seen).getTime()

  if (Number.isNaN(lastSeen)) return false

  return Date.now() - lastSeen < 1000 * 60 * 3
}

function workerName(worker: WorkerProfile) {
  return worker.full_name || worker.company_name || 'CrewCall Worker'
}

function scoreWorker(job: Job, worker: WorkerProfile): MatchInsert {
  const jobTrade = normalize(job.trade)
  const workerTrade = normalize(worker.trade)
  const jobLocation = normalize(job.location)
  const workerCity = normalize(worker.city)
  const workerState = normalize(worker.state)
  const jobText = normalize(
    `${job.title || ''} ${job.trade || ''} ${job.location || ''} ${
      job.description || ''
    }`
  )

  let tradeScore = 0
  let locationScore = 0
  let availabilityScore = 0
  let certificationScore = 0
  let onlineScore = 0
  let payScore = 0

  const reasons: string[] = []

  if (jobTrade && workerTrade && jobTrade === workerTrade) {
    tradeScore = 30
    reasons.push('same trade')
  } else if (
    jobTrade &&
    workerTrade &&
    (workerTrade.includes(jobTrade) || jobTrade.includes(workerTrade))
  ) {
    tradeScore = 22
    reasons.push('trade match')
  } else if (
    worker.skills?.some((skill) => normalize(skill).includes(jobTrade)) ||
    worker.preferred_work?.some((item) => normalize(item).includes(jobTrade))
  ) {
    tradeScore = 18
    reasons.push('skill match')
  }

  if (
    jobLocation &&
    ((workerCity && jobLocation.includes(workerCity)) ||
      (workerState && jobLocation.includes(workerState)))
  ) {
    locationScore = 20
    reasons.push('location match')
  } else if (worker.willing_to_travel || Number(worker.travel_radius || 0) >= 25) {
    locationScore = 12
    reasons.push('willing to travel')
  }

  const availability = normalize(worker.availability_status)

  if (
    worker.available_for_work ||
    availability === 'available' ||
    availability === 'available_today'
  ) {
    availabilityScore = availability === 'available_today' ? 20 : 16
    reasons.push('available')
  } else if (
    availability === 'available_tomorrow' ||
    availability === 'available_this_week' ||
    availability === 'weekends_only'
  ) {
    availabilityScore = 10
    reasons.push('limited availability')
  }

  if (isRecentlyOnline(worker)) {
    onlineScore = 10
    reasons.push('online recently')
  }

  if (worker.license_number) certificationScore += 3
  if (worker.insurance_provider) certificationScore += 2
  if (worker.liability_form_signed) certificationScore += 2
  if (worker.osha10) certificationScore += 2
  if (worker.osha30) certificationScore += 3
  if (worker.med_gas && jobText.includes('gas')) certificationScore += 4
  if (worker.background_verified) certificationScore += 2
  if (worker.drug_tested) certificationScore += 2

  certificationScore = Math.min(certificationScore, 15)

  if (certificationScore > 0) {
    reasons.push('verified credentials')
  }

  const jobPay = parsePay(job.pay_rate)

  if (jobPay > 0) {
    const min = Number(worker.expected_pay_min || 0)
    const max = Number(worker.expected_pay_max || 0)

    if (min && max && jobPay >= min && jobPay <= max) {
      payScore = 10
      reasons.push('pay matches')
    } else if (min && jobPay >= min) {
      payScore = 8
      reasons.push('pay works')
    } else if (!min && !max) {
      payScore = 5
    }
  }

  const crewScore = Math.min(15, Math.round(Number(worker.crewcall_score || 0) / 7))

  const matchScore = Math.min(
    100,
    tradeScore +
      locationScore +
      availabilityScore +
      certificationScore +
      onlineScore +
      payScore +
      crewScore
  )

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
    reason:
      reasons.length > 0
        ? reasons.join(', ')
        : `${workerName(worker)} may be a possible fit.`,
  }
}

export async function POST(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase service role is not configured.' },
        { status: 500 }
      )
    }

    const { jobId } = await req.json()

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId.' }, { status: 400 })
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('id, company_id, title, trade, location, pay_rate, description')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { error: jobError?.message || 'Job not found.' },
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
        availability_status,
        available_for_work,
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
      return NextResponse.json({ error: workersError.message }, { status: 500 })
    }

    const scoredMatches = ((workers || []) as WorkerProfile[])
      .map((worker) => scoreWorker(job as Job, worker))
      .filter((match) => match.match_score > 0)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 20)

    await supabaseAdmin.from('job_matches').delete().eq('job_id', jobId)

    if (scoredMatches.length > 0) {
      const { error: matchError } = await supabaseAdmin
        .from('job_matches')
        .insert(scoredMatches)

      if (matchError) {
        return NextResponse.json({ error: matchError.message }, { status: 500 })
      }

      const notifications = scoredMatches.slice(0, 10).map((match) => ({
        user_id: match.worker_id,
        title: 'New matching job',
        body: `${job.title || 'A new job'} looks like a good match for you.`,
        link_url: `/jobs/${job.id}`,
        read: false,
        is_read: false,
      }))

      await supabaseAdmin.from('notifications').insert(notifications)
    }

    return NextResponse.json({
      success: true,
      jobId,
      matchesCreated: scoredMatches.length,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create job matches.',
      },
      { status: 500 }
    )
  }
}