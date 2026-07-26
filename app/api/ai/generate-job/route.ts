import { NextResponse } from 'next/server'

type GenerateJobRequest = {
  trade?: string
  location?: string
  payRate?: string
  notes?: string
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
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
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

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'OPENAI_API_KEY is not configured. Add it to .env.local and restart CrewCall.',
        },
        { status: 500 }
      )
    }

    const body = (await request.json().catch(() => null)) as
      | GenerateJobRequest
      | null

    const trade = clean(body?.trade, 100)
    const location = clean(body?.location, 150)
    const payRate = clean(body?.payRate, 100)
    const notes = clean(body?.notes, 2_500)

    if (!trade) {
      return NextResponse.json(
        {
          error: 'Enter the trade before generating the job.',
        },
        { status: 400 }
      )
    }

    if (!location) {
      return NextResponse.json(
        {
          error: 'Enter the job location before generating the job.',
        },
        { status: 400 }
      )
    }

    const prompt = `
Create a professional skilled-trades job posting for CrewCall, a platform
that connects contractors and skilled workers.

Job information:
Trade: ${trade}
Location: ${location}
Pay: ${payRate || 'Not provided'}
Company notes: ${notes || 'No additional notes provided'}

Requirements:
- Write for real skilled-trades workers.
- Keep the title clear and specific.
- The description should be professional, practical, and easy to scan.
- Do not invent a company name.
- Do not promise benefits, overtime, per diem, tools, lodging, or reimbursement
  unless stated in the company notes.
- Do not invent licensing requirements that are not reasonably related to the trade.
- Mention that final schedule, scope, and terms should be confirmed with the hiring company.
- Suggested pay must preserve the provided pay when one was supplied.
- Estimated matches is only a rough platform estimate, not a guarantee.
- Return only the requested structured JSON.
`.trim()

    const openAIResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_JOB_MODEL || 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content:
              'You are CrewCall AI, an expert recruiter for plumbing, HVAC, electrical, construction, and other skilled trades.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.4,
        text: {
          format: {
            type: 'json_schema',
            name: 'crewcall_job_posting',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: {
                  type: 'string',
                },
                description: {
                  type: 'string',
                },
                requiredSkills: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                },
                recommendedCertifications: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                },
                suggestedPayRange: {
                  type: 'string',
                },
                hiringDifficulty: {
                  type: 'string',
                  enum: ['Easy', 'Moderate', 'Difficult'],
                },
                estimatedMatches: {
                  type: 'integer',
                  minimum: 0,
                  maximum: 500,
                },
              },
              required: [
                'title',
                'description',
                'requiredSkills',
                'recommendedCertifications',
                'suggestedPayRange',
                'hiringDifficulty',
                'estimatedMatches',
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
      console.error('OpenAI job generation failed:', openAIResult)

      return NextResponse.json(
        {
          error:
            openAIResult?.error?.message ||
            'CrewCall AI could not generate the job posting.',
        },
        { status: openAIResponse.status }
      )
    }

    if (!openAIResult) {
      return NextResponse.json(
        {
          error: 'CrewCall AI returned an empty response.',
        },
        { status: 502 }
      )
    }

    const outputText = extractOutputText(openAIResult)

    if (!outputText) {
      return NextResponse.json(
        {
          error: 'CrewCall AI did not return generated job content.',
        },
        { status: 502 }
      )
    }

    let generated: unknown

    try {
      generated = JSON.parse(outputText)
    } catch {
      console.error('Invalid AI job JSON:', outputText)

      return NextResponse.json(
        {
          error: 'CrewCall AI returned an unreadable response.',
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      generated,
    })
  } catch (error) {
    console.error('AI job generator route error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to generate the job posting.',
      },
      { status: 500 }
    )
  }
}
