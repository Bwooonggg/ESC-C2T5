import { describe, expect, it } from 'vitest'
import {
  answerSummary,
  appendMessage,
  conversationTranscript,
  createSession,
  recordResponse,
  setNotes,
} from '../../models/screeningSession.ts'
import type { ScreeningSession } from '../../../demo_app/shared/types.ts'

/**
 * UT-18..UT-23 — the three screeningSession.ts helpers the first plan left
 * uncovered: setNotes, conversationTranscript and answerSummary.
 *
 * These three are the only reason claudeService.ts can describe a session to
 * Claude, so their exact output strings are part of the prompt contract, not
 * cosmetic formatting.
 */

function screeningSession(overrides: Partial<ScreeningSession> = {}): ScreeningSession {
  return { ...createSession('adult'), ...overrides }
}

describe('setNotes', () => {
  // UT-18 — Store free-text notes
  it('stores the note verbatim, refreshes updatedAt and leaves the input untouched', () => {
    const original = screeningSession({ notes: '' })

    const updated = setNotes(original, '  He is 9 and reads slowly.  ')

    // Unlike appendMessage, setNotes deliberately does not trim: the raw text
    // is what claudeService.ts puts in the prompt.
    expect(updated.notes).toBe('  He is 9 and reads slowly.  ')
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(original.updatedAt).getTime(),
    )
    expect(updated).not.toBe(original)
    expect(original.notes).toBe('')
  })

  // UT-19 — Clear previously entered notes
  it('accepts an empty string, clearing a note that was set earlier', () => {
    const withNotes = setNotes(screeningSession(), 'Reads slowly.')

    const cleared = setNotes(withNotes, '')

    expect(cleared.notes).toBe('')
    expect(cleared.stage).toBe('screening')
  })
})

describe('conversationTranscript', () => {
  // UT-20 — Transcript of an empty conversation
  it('returns "None yet." when no messages have been exchanged', () => {
    expect(conversationTranscript(screeningSession({ messages: [] }))).toBe('None yet.')
  })

  // UT-21 — Transcript labels each speaker
  it('labels user and assistant turns and joins them with newlines, in order', () => {
    let session = screeningSession({ messages: [] })
    session = appendMessage(session, 'user', 'I mix up b and d')
    session = appendMessage(session, 'assistant', 'How long have you noticed this?')
    session = appendMessage(session, 'user', 'Since primary school')

    expect(conversationTranscript(session)).toBe(
      [
        'User: I mix up b and d',
        'Assistant: How long have you noticed this?',
        'User: Since primary school',
      ].join('\n'),
    )
  })
})

describe('answerSummary', () => {
  // UT-22 — Summary of an unanswered checklist
  it('returns "None yet." when no checklist answers have been recorded', () => {
    expect(answerSummary(screeningSession({ responses: {} }))).toBe('None yet.')
  })

  // UT-23 — Summary renders one bullet per answer
  it('renders one "- question: answer" line per response, in insertion order', () => {
    let session = screeningSession({ responses: {} })
    session = recordResponse(session, 'Does the child confuse b/d?', 'Yes')
    session = recordResponse(session, 'Does the child avoid reading aloud?', 'No')

    expect(answerSummary(session)).toBe(
      ['- Does the child confuse b/d?: Yes', '- Does the child avoid reading aloud?: No'].join(
        '\n',
      ),
    )
  })
})
