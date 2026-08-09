import { Anthropic } from '@anthropic-ai/sdk'
import type { ScreeningSession } from '../../demo_app/shared/types.ts'
import { model, requireApiKey } from '../config.ts'
import { answerSummary, conversationTranscript } from '../models/screeningSession.ts'

/**
 * Service: everything that knows about Claude. Controllers call the two
 * exported functions and never see a prompt, a model id, or a content block.
 */

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: requireApiKey() })
  }
  return client
}

export type ScreenerDecision =
  | { status: 'continue'; question: string }
  | { status: 'complete'; report: string }

/**
 * Claude answers against this schema, so the decision arrives as validated JSON
 * instead of a "NEXT QUESTION:" / "FINISHED:" prefix we have to string-match.
 */
const decisionSchema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['continue', 'complete'],
      description:
        'Use "continue" when another question is needed, "complete" when the screener has enough information.',
    },
    question: {
      type: 'string',
      description: 'The next question to ask. Empty string when status is "complete".',
    },
    report: {
      type: 'string',
      description:
        'The screening report and recommended next step. Empty string when status is "continue".',
    },
  },
  required: ['status', 'question', 'report'],
  additionalProperties: false,
}

function systemPrompt(session: ScreeningSession): string {
  return [
    `You are a screening assistant for the ${session.screenerType} dyslexia screener`,
    'run by the Dyslexia Association of Singapore.',
    'Ask one clear, plain-language question at a time.',
    'You are not making a diagnosis — you are gathering enough information for a',
    'short screening summary and a recommended next step.',
  ].join(' ')
}

function sessionContext(session: ScreeningSession): string {
  return [
    `Conversation so far:\n${conversationTranscript(session)}`,
    `Checklist answers:\n${answerSummary(session)}`,
    `Notes from the user:\n${session.notes.trim() || 'None'}`,
  ].join('\n\n')
}

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

/** Decide whether to ask one more question or wrap up with a report. */
export async function decideNextStep(session: ScreeningSession): Promise<ScreenerDecision> {
  const message = await getClient().messages.create({
    model,
    max_tokens: 1024,
    system: `${systemPrompt(session)} Decide whether you need to ask one more question, or whether you have enough information to finish and write the report.`,
    output_config: { format: { type: 'json_schema', schema: decisionSchema } },
    messages: [{ role: 'user', content: sessionContext(session) }],
  })

  return parseDecision(extractText(message))
}

/** Write the report from whatever has been gathered, without asking for more. */
export async function generateReport(session: ScreeningSession): Promise<string> {
  const message = await getClient().messages.create({
    model,
    max_tokens: 1024,
    system: `${systemPrompt(session)} Write the screening report now, based only on what has already been gathered. Summarise the responses and recommend a next step.`,
    messages: [{ role: 'user', content: sessionContext(session) }],
  })

  return extractText(message)
}

function parseDecision(text: string): ScreenerDecision {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Claude returned a response that was not valid JSON.')
  }

  const value = parsed as { status?: unknown; question?: unknown; report?: unknown }

  if (value.status === 'complete' && typeof value.report === 'string' && value.report.trim()) {
    return { status: 'complete', report: value.report }
  }

  if (value.status === 'continue' && typeof value.question === 'string' && value.question.trim()) {
    return { status: 'continue', question: value.question }
  }

  throw new Error('Claude returned a decision that did not match the expected shape.')
}
