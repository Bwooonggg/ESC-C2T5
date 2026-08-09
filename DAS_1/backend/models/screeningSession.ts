import { randomUUID } from 'node:crypto'
import type {
  ChatRole,
  ContactDetails,
  ScreenerType,
  ScreeningSession,
} from '../../demo_app/shared/types.ts'

/**
 * Model: the screening session and the rules that govern how it may change.
 * Every mutation returns a new session rather than editing in place, so a
 * failed rule leaves the caller's copy untouched.
 */

export class DomainError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'DomainError'
    this.status = status
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isScreenerType(value: unknown): value is ScreenerType {
  return value === 'adult' || value === 'child'
}

export function createSession(screenerType: ScreenerType): ScreeningSession {
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    screenerType,
    stage: 'screening',
    messages: [],
    responses: {},
    notes: '',
    report: null,
    contact: null,
    createdAt: now,
    updatedAt: now,
  }
}

function touch(session: ScreeningSession): ScreeningSession {
  return { ...session, updatedAt: new Date().toISOString() }
}

export function appendMessage(
  session: ScreeningSession,
  role: ChatRole,
  content: string,
): ScreeningSession {
  if (session.stage === 'completed') {
    throw new DomainError('This screening session is already complete.', 409)
  }

  const trimmed = content.trim()
  if (!trimmed) {
    throw new DomainError('A message cannot be empty.')
  }

  return touch({
    ...session,
    messages: [...session.messages, { role, content: trimmed }],
  })
}

export function recordResponse(
  session: ScreeningSession,
  question: string,
  answer: string,
): ScreeningSession {
  if (session.stage !== 'screening') {
    throw new DomainError(
      'Answers can only be recorded while the screener is still in progress.',
      409,
    )
  }

  if (!question.trim() || !answer.trim()) {
    throw new DomainError('Both a question and an answer are required.')
  }

  return touch({
    ...session,
    responses: { ...session.responses, [question]: answer },
  })
}

export function setNotes(session: ScreeningSession, notes: string): ScreeningSession {
  return touch({ ...session, notes })
}

export function attachReport(
  session: ScreeningSession,
  report: string,
): ScreeningSession {
  const trimmed = report.trim()
  if (!trimmed) {
    throw new DomainError('The screener produced an empty report.', 502)
  }

  return touch({ ...session, report: trimmed, stage: 'report' })
}

export function attachContact(
  session: ScreeningSession,
  contact: ContactDetails,
): ScreeningSession {
  if (session.report === null) {
    throw new DomainError(
      'A screening report must exist before DAS services can be engaged.',
      409,
    )
  }

  return touch({ ...session, contact, stage: 'completed' })
}

export function validateContact(input: unknown): ContactDetails {
  const value = (input ?? {}) as Record<string, unknown>
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  const email = typeof value.email === 'string' ? value.email.trim() : ''
  const phone = typeof value.phone === 'string' ? value.phone.trim() : ''

  const errors: string[] = []
  if (!name) errors.push('Name is required.')
  if (!EMAIL_PATTERN.test(email)) errors.push('A valid email address is required.')
  if (phone.replace(/\D/g, '').length < 8) {
    errors.push('A valid phone number is required.')
  }

  if (errors.length > 0) {
    throw new DomainError(errors.join(' '))
  }

  return { name, email, phone }
}

export function conversationTranscript(session: ScreeningSession): string {
  if (session.messages.length === 0) return 'None yet.'
  return session.messages
    .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
    .join('\n')
}

export function answerSummary(session: ScreeningSession): string {
  const entries = Object.entries(session.responses)
  if (entries.length === 0) return 'None yet.'
  return entries.map(([question, answer]) => `- ${question}: ${answer}`).join('\n')
}
