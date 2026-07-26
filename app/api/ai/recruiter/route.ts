import { NextResponse } from 'next/server'

type RecruiterWorker = {
  workerId: string
  name: string
  trade: string
  location: string
  matchScore: number
  matchLabel: string
  experience: string
  availability: string
  crewcallScore: number | null
  preferredPay: string
  skills: string[]
  credentials: string[]
  reasons: string[]
  warnings: string[]
}

type RecruiterRequest = {
  question?: string
  job?: {
    id?: string
    title?: string
    trade?: string
    location?: string
    payRate?: string
    description?: string
  }
  workers?: RecruiterWorker[]
}

type OpenAIResponse = {
  output_text?: string
  error?: {
    message?: string
  }
  output?: Array<{
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
}

const OPENAI_API_URL = 'https://api.openai.com/v1/responses'

function clean(value: unknown, maximumLength: number) {
  return String(value ?? '').trim().slice(0, maximumLength)
}

function extractOutputText(response: OpenAIResponse) {
  if (
    typeof response.output_text === 'string' &&
    response.output_text.trim()
  ) {
    return response.output_text.trim()
  }

  for (const outputItem of response.output ?? []) {
    for (const contentItem of outputItem.content ?? []) {
      if (
        contentItem.type === 'output_text' &&
        typeof contentItem.text === 'string'
      ) {
        return contentItem.text.trim()
      }
    }
  }

  return ''
}

function sanitizeWorkers(value: unknown): RecruiterWorker[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.slice(0, 15).map((worker) => {
    const record =
      typeof worker === 'object' && worker !== null
        ? (worker as Record<string, unknown>)
        : {}

    return {
      workerId: clean(record.workerId, 100),
      name: clean(record.name, 150) || 'CrewCall Worker',
      trade: clean(record.trade, 100),
      location: clean(record.location, 150),
      matchScore: Math.max(
        0,
        Math.min(100, Number(record.matchScore) || 0)
      ),
      matchLabel: clean(record.matchLabel, 50),
      experience: clean(record.experience, 100),
      availability: clean(record.availability, 100),
      crewcallScore:
        record.crewcallScore === null ||
        record.crewcallScore === undefined
          ? null
          : Math.max(
              0,
              Math.min(100, Number(record.crewcallScore) || 0)
            ),
      preferredPay: clean(record.preferredPay, 100),
      skills: Array.isArray(record.skills)
        ? record.skills
            .slice(0, 15)
            .map((item) => clean(item, 100))
            .filter(Boolean)
        : [],
      credentials: Array.isArray(record.credentials)
        ? record.credentials
            .slice(0, 15)
            .map((item) => clean(item, 100))
            .filter(Boolean)
        : [],
      reasons: Array.isArray(record.reasons)
        ? record.reasons
            .slice(0, 10)
            .map((item) => clean(item, 250))
            .filter(Boolean)
        : [],
      warnings: Array.isArray(record.warnings)
        ? record.warnings
            .slice(0, 10)
            .map((item) => clean(item, 250))
            .filter(Boolean)
        : [],
    }
  })
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'OPENAI_API_KEY is not configured in the CrewCall environment.',
        },
        { status: 500 }
      )
    }

    const body = (await request.json().catch(() => null)) as
      | RecruiterRequest
      | null

    const question = clean(body?.question, 1_500)

    const job = {
      id: clean(body?.job?.id, 100),
      title: clean(body?.job?.title, 200),
      trade: clean(body?.job?.trade, 100),
      location: clean(body?.job?.location, 200),
      payRate: clean(body?.job?.payRate, 100),
      description: clean(body?.job?.description, 4_000),
    }

    const workers = sanitizeWorkers(body?.workers)

    if (!question) {
      return NextResponse.json(
        { error: 'Enter a question for the AI recruiter.' },
        { status: 400 }
      )
    }

    if (!job.id) {
      return NextResponse.json(
        { error: 'The job information is missing.' },
        { status: 400 }
      )
    }

    if (workers.length === 0) {
      return NextResponse.json(
        {
          error:
            'No worker matches were supplied. Run AI matching before using the recruiter.',
        },
        { status: 400 }
      )
    }

    const workerContext = workers
      .map(
        (worker, index) => `
Candidate ${index + 1}
Worker ID: ${worker.workerId}
Name: ${worker.name}
Trade: ${worker.trade || 'Not listed'}
Location: ${worker.location || 'Not listed'}
AI match: ${worker.matchScore}% (${worker.matchLabel})
Experience: ${worker.experience || 'Not listed'}
Availability: ${worker.availability || 'Not listed'}
CrewCall score: ${
          worker.crewcallScore === null
            ? 'Not scored'
            : `${worker.crewcallScore}/100`
        }
Preferred pay: ${worker.preferredPay || 'Not listed'}
Skills: ${worker.skills.join(', ') || 'None listed'}
Credentials: ${worker.credentials.join(', ') || 'None listed'}
Match strengths: ${worker.reasons.join('; ') || 'None listed'}
Items to confirm: ${worker.warnings.join('; ') || 'None listed'}
`.trim()
      )
      .join('\n\n')

    const prompt = `
You are CrewCall AI Recruiter, a hiring assistant for skilled-trades companies.

Answer the hiring manager's question using only the job and candidate data
provided below.

JOB
Title: ${job.title || 'Untitled job'}
Trade: ${job.trade || 'Not listed'}
Location: ${job.location || 'Not listed'}
Pay: ${job.payRate || 'Not listed'}
Description: ${job.description || 'Not listed'}

CANDIDATES
${workerContext}

HIRING MANAGER QUESTION
${question}

Rules:
- Do not invent worker qualifications, distances, licenses, experience,
  availability, ratings, pay expectations, or certifications.
- Clearly distinguish confirmed information from information that should be
  verified.
- Do not make decisions based on protected personal characteristics.
- Treat the existing match score as one decision-support signal, not proof
  that someone should be hired.
- Keep the answer practical and written for a contractor.
- When recommending candidates, use their exact names and worker IDs.
- Provide invitation drafts only for candidates you actually recommend.
- Each invitation should be professional, concise, and personalized from the
  supplied job and candidate data.
- Interview questions should be directly relevant to this particular job.
- Return only the requested structured JSON.
`.trim()

    const openAIResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:
          process.env.OPENAI_RECRUITER_MODEL ||
          process.env.OPENAI_JOB_MODEL ||
          'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content:
              'You are CrewCall AI Recruiter, an expert but careful skilled-trades hiring assistant.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        text: {
          format: {
            type: 'json_schema',
            name: 'crewcall_recruiter_answer',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                answer: { type: 'string' },
                recommendation: { type: 'string' },
                hiringRisk: {
                  type: 'string',
                  enum: ['Low', 'Moderate', 'High', 'Unknown'],
                },
                confidence: {
                  type: 'integer',
                  minimum: 0,
                  maximum: 100,
                },
                recommendedWorkerIds: {
                  type: 'array',
                  items: { type: 'string' },
                },
                strengths: {
                  type: 'array',
                  items: { type: 'string' },
                },
                concerns: {
                  type: 'array',
                  items: { type: 'string' },
                },
                interviewQuestions: {
                  type: 'array',
                  items: { type: 'string' },
                },
                invitationDrafts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      workerId: { type: 'string' },
                      workerName: { type: 'string' },
                      message: { type: 'string' },
                    },
                    required: [
                      'workerId',
                      'workerName',
                      'message',
                    ],
                  },
                },
              },
              required: [
                'answer',
                'recommendation',
                'hiringRisk',
                'confidence',
                'recommendedWorkerIds',
                'strengths',
                'concerns',
                'interviewQuestions',
                'invitationDrafts',
              ],
            },
          },
        },
      }),
    })

    const openAIResult = (await openAIResponse
      .json()
      .catch(() => null)) as OpenAIResponse | null

    if (!openAIResponse.ok) {
      console.error('OpenAI recruiter failed:', openAIResult)

      return NextResponse.json(
        {
          error:
            openAIResult?.error?.message ||
            'CrewCall AI Recruiter could not answer the question.',
        },
        { status: openAIResponse.status }
      )
    }

    if (!openAIResult) {
      return NextResponse.json(
        { error: 'CrewCall AI Recruiter returned an empty response.' },
        { status: 502 }
      )
    }

    const outputText = extractOutputText(openAIResult)

    if (!outputText) {
      return NextResponse.json(
        {
          error:
            'CrewCall AI Recruiter did not return readable content.',
        },
        { status: 502 }
      )
    }

    let recruiterResult: unknown

    try {
      recruiterResult = JSON.parse(outputText)
    } catch {
      console.error('Invalid recruiter JSON:', outputText)

      return NextResponse.json(
        {
          error:
            'CrewCall AI Recruiter returned an unreadable response.',
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      result: recruiterResult,
    })
  } catch (error) {
    console.error('AI recruiter route error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to use CrewCall AI Recruiter.',
      },
      { status: 500 }
    )
  }
}