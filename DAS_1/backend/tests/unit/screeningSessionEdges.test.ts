import { describe, expect, it } from 'vitest'
import {
  DomainError,
  appendMessage,
  attachContact,
  attachReport,
  createSession,
  recordResponse,
  validateContact,
} from '../../models/screeningSession.ts'
import type { ScreeningSession } from '../../../demo_app/shared/types.ts'

/**
 * UT-24..UT-31 — boundary and equivalence-partition cases the first plan's
 * happy/sad pairs skipped: the stage boundaries either side of each guard, and
 * the exact accept/reject edges of validateContact.
 */

function captureDomainError(fn: () => unknown): DomainError {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    return error as DomainError
  }
  throw new Error('Expected the function to throw a DomainError, but it did not throw.')
}

function screeningSession(overrides: Partial<ScreeningSession> = {}): ScreeningSession {
  return { ...createSession('adult'), ...overrides }
}

const contact = { name: 'Tan Wei Ling', email: 'wl.tan@example.com', phone: '91234567' }

describe('stage boundaries', () => {
  // UT-24 — A message is still allowed at the "report" stage
  it('allows appendMessage at the "report" stage, since only "completed" is blocked', () => {
    const original = screeningSession({ stage: 'report', report: 'Summary: follow up.' })

    const updated = appendMessage(original, 'user', 'One more thing I forgot')

    // UT-05 proves "completed" is rejected; this pins the other side of that
    // boundary so a future guard change cannot silently widen the rule.
    expect(updated.messages).toEqual([{ role: 'user', content: 'One more thing I forgot' }])
    expect(updated.stage).toBe('report')
  })

  // UT-25 — Re-answering a checklist question overwrites the previous answer
  it('overwrites an existing answer for the same question rather than duplicating it', () => {
    const question = 'Does the child confuse b/d?'
    const first = recordResponse(screeningSession(), question, 'Yes')

    const second = recordResponse(first, question, 'No')

    expect(second.responses[question]).toBe('No')
    expect(Object.keys(second.responses)).toEqual([question])
    expect(first.responses[question]).toBe('Yes')
  })

  // UT-26 — Reject a blank answer
  it('rejects a whitespace-only answer, the partner case to UT-08 blank question', () => {
    const original = screeningSession({ stage: 'screening' })

    const error = captureDomainError(() => recordResponse(original, 'Q1', '   '))

    expect(error.message).toBe('Both a question and an answer are required.')
    expect(error.status).toBe(400)
    expect(original.responses).toEqual({})
  })

  // UT-27 — A completed session cannot be reopened by a second report (DEF-01)
  it('refuses attachReport on a completed session, matching the appendMessage guard', () => {
    const completed = attachContact(
      attachReport(screeningSession(), 'Summary: recommend follow-up.'),
      contact,
    )
    expect(completed.stage).toBe('completed')

    const error = captureDomainError(() => attachReport(completed, 'A second, later report.'))

    expect(error.message).toBe('This screening session is already complete.')
    expect(error.status).toBe(409)
    // The session the caller holds is untouched: same report, same stage, so the
    // JSON store and the database cannot disagree about whether it is finished.
    expect(completed.stage).toBe('completed')
    expect(completed.report).toBe('Summary: recommend follow-up.')
    expect(completed.contact).toEqual(contact)
  })
})

describe('validateContact boundaries', () => {
  // UT-28 — Phone length boundary (8 digits is the documented minimum)
  it('accepts exactly 8 digits and rejects 7', () => {
    expect(validateContact({ ...contact, phone: '12345678' }).phone).toBe('12345678')

    const error = captureDomainError(() => validateContact({ ...contact, phone: '1234567' }))
    expect(error.message).toBe('A valid phone number is required.')
    expect(error.status).toBe(400)
  })

  // UT-29 — Reject a completely absent payload
  it('reports all three field errors for null and for undefined input', () => {
    const expected =
      'Name is required. A valid email address is required. A valid phone number is required.'

    expect(captureDomainError(() => validateContact(null)).message).toBe(expected)
    expect(captureDomainError(() => validateContact(undefined)).message).toBe(expected)
  })

  // UT-30 — Non-string field values count as missing
  it('treats non-string field values as missing rather than coercing them', () => {
    const error = captureDomainError(() =>
      validateContact({ name: 42, email: ['wl.tan@example.com'], phone: 91234567 }),
    )

    expect(error.message).toBe(
      'Name is required. A valid email address is required. A valid phone number is required.',
    )
  })

  // UT-31 — Email pattern boundary
  it('accepts the shortest well-formed email and rejects near-misses', () => {
    expect(validateContact({ ...contact, email: 'a@b.c' }).email).toBe('a@b.c')

    for (const email of ['user@example', 'userexample.com', 'a b@example.com', '@example.com']) {
      const error = captureDomainError(() => validateContact({ ...contact, email }))
      expect(error.message).toBe('A valid email address is required.')
    }
  })
})
