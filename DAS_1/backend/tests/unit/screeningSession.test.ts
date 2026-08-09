import { describe, expect, it } from 'vitest'
import {
  DomainError,
  appendMessage,
  attachContact,
  attachReport,
  createSession,
  isScreenerType,
  recordResponse,
  validateContact,
} from '../../models/screeningSession.ts'
import type { ScreeningSession } from '../../../demo_app/shared/types.ts'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Runs `fn`, asserts it threw a DomainError, and returns that error so the
 * caller can assert on both `.message` and `.status` in one place.
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

// UT-01 — Create adult session
describe('createSession', () => {
  it('creates a fresh adult session', () => {
    const session = createSession('adult')

    expect(session.id).toMatch(UUID_PATTERN)
    expect(session.screenerType).toBe('adult')
    expect(session.stage).toBe('screening')
    expect(session.messages).toEqual([])
    expect(session.responses).toEqual({})
    expect(session.notes).toBe('')
    expect(session.report).toBeNull()
    expect(session.contact).toBeNull()
    expect(session.createdAt).toBe(session.updatedAt)
  })

  // UT-02 — Create child session
  it('creates a fresh child session with the same shape', () => {
    const session = createSession('child')

    expect(session.id).toMatch(UUID_PATTERN)
    expect(session.screenerType).toBe('child')
    expect(session.stage).toBe('screening')
    expect(session.messages).toEqual([])
    expect(session.responses).toEqual({})
    expect(session.notes).toBe('')
    expect(session.report).toBeNull()
    expect(session.contact).toBeNull()
    expect(session.createdAt).toBe(session.updatedAt)
  })
})

describe('appendMessage', () => {
  // UT-03 — Append a chat message while screening
  it('trims and appends a message, refreshing updatedAt without mutating the input', () => {
    const original = screeningSession({ stage: 'screening' })

    const updated = appendMessage(original, 'user', '  I mix up b and d  ')

    expect(updated.messages).toEqual([{ role: 'user', content: 'I mix up b and d' }])
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(original.updatedAt).getTime(),
    )
    expect(updated).not.toBe(original)
    expect(original.messages).toEqual([])
  })

  // UT-04 — Reject an empty chat message
  it('rejects a whitespace-only message', () => {
    const original = screeningSession({ stage: 'screening' })

    const error = captureDomainError(() => appendMessage(original, 'user', '   '))

    expect(error.message).toBe('A message cannot be empty.')
    expect(error.status).toBe(400)
    expect(original.messages).toEqual([])
  })

  // UT-05 — Reject a message on a completed session
  it('rejects a message once the session is completed', () => {
    const original = screeningSession({ stage: 'completed' })

    const error = captureDomainError(() => appendMessage(original, 'user', 'hello'))

    expect(error.message).toBe('This screening session is already complete.')
    expect(error.status).toBe(409)
    expect(original.messages).toEqual([])
  })
})

describe('recordResponse', () => {
  // UT-06 — Record a checklist answer while screening
  it('records an answer while screening', () => {
    const original = screeningSession({ stage: 'screening', responses: {} })

    const updated = recordResponse(original, 'Does the child confuse b/d?', 'Yes')

    expect(updated.responses['Does the child confuse b/d?']).toBe('Yes')
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(original.updatedAt).getTime(),
    )
  })

  // UT-07 — Reject an answer outside the screening stage
  it('rejects an answer once the session has left the screening stage', () => {
    const original = screeningSession({ stage: 'report' })

    const error = captureDomainError(() => recordResponse(original, 'Q1', 'Yes'))

    expect(error.message).toBe(
      'Answers can only be recorded while the screener is still in progress.',
    )
    expect(error.status).toBe(409)
    expect(original.responses).toEqual({})
  })

  // UT-08 — Reject a blank question or answer
  it('rejects a blank question', () => {
    const original = screeningSession({ stage: 'screening' })

    const error = captureDomainError(() => recordResponse(original, '', 'Yes'))

    expect(error.message).toBe('Both a question and an answer are required.')
    expect(error.status).toBe(400)
    expect(original.responses).toEqual({})
  })
})

describe('attachReport', () => {
  // UT-09 — Attach a non-empty report
  it('trims and stores a non-empty report, advancing the stage', () => {
    const original = screeningSession({ stage: 'screening', report: null })

    const updated = attachReport(original, '  Summary: ...recommend follow-up.  ')

    expect(updated.report).toBe('Summary: ...recommend follow-up.')
    expect(updated.stage).toBe('report')
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(original.updatedAt).getTime(),
    )
  })

  // UT-10 — Reject an empty report
  it('rejects a whitespace-only report', () => {
    const original = screeningSession({ stage: 'screening', report: null })

    const error = captureDomainError(() => attachReport(original, '   '))

    expect(error.message).toBe('The screener produced an empty report.')
    expect(error.status).toBe(502)
    expect(original.report).toBeNull()
    expect(original.stage).toBe('screening')
  })
})

describe('attachContact', () => {
  const contact = { name: 'Tan Wei Ling', email: 'wl.tan@example.com', phone: '91234567' }

  // UT-11 — Attach contact once a report exists
  it('attaches contact details once a report exists, completing the session', () => {
    const original = screeningSession({ report: 'Summary: recommend follow-up.' })

    const updated = attachContact(original, contact)

    expect(updated.contact).toEqual(contact)
    expect(updated.stage).toBe('completed')
  })

  // UT-12 — Reject contact before a report exists
  it('rejects contact details before a report exists', () => {
    const original = screeningSession({ stage: 'screening', report: null })

    const error = captureDomainError(() => attachContact(original, contact))

    expect(error.message).toBe(
      'A screening report must exist before DAS services can be engaged.',
    )
    expect(error.status).toBe(409)
    expect(original.contact).toBeNull()
    expect(original.stage).toBe('screening')
  })
})

describe('validateContact', () => {
  // UT-13 — Accept a well-formed contact submission
  it('accepts a well-formed submission and trims each field', () => {
    const result = validateContact({
      name: '  Tan Wei Ling  ',
      email: '  wl.tan@example.com  ',
      phone: '  +65 9123 4567  ',
    })

    expect(result).toEqual({
      name: 'Tan Wei Ling',
      email: 'wl.tan@example.com',
      phone: '+65 9123 4567',
    })
  })

  // UT-14 — Reject a submission missing all fields
  it('rejects a submission missing every field, with one combined message', () => {
    const error = captureDomainError(() =>
      validateContact({ name: '', email: 'not-an-email', phone: '123' }),
    )

    expect(error.message).toBe(
      'Name is required. A valid email address is required. A valid phone number is required.',
    )
  })

  // UT-15 — Accept a phone number with formatting characters
  it('accepts a phone number with formatting characters, keeping the original string', () => {
    const result = validateContact({
      name: 'Tan Wei Ling',
      email: 'wl.tan@example.com',
      phone: '+65 9123-4567',
    })

    expect(result.phone).toBe('+65 9123-4567')
  })
})

// UT-16 — Identify valid vs. invalid screener types
describe('isScreenerType', () => {
  it('accepts "adult" and "child", rejects anything else', () => {
    expect(isScreenerType('adult')).toBe(true)
    expect(isScreenerType('child')).toBe(true)
    expect(isScreenerType('teen')).toBe(false)
    expect(isScreenerType(undefined)).toBe(false)
  })
})
