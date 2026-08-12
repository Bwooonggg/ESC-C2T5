import { rm } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { dataFile } from '../../config.ts'

vi.mock('../../services/claudeService.ts', () => ({
  decideNextStep: vi.fn(),
  generateReport: vi.fn(),
}))

import { createApp } from '../../app.ts'
import { decideNextStep } from '../../services/claudeService.ts'

/**
 * IT-14 — notes ride along with a chat message.
 *
 * postMessage does three things in a fixed order: setNotes, appendMessage, then
 * hand the result to claudeService. IT-02/IT-03 only checked the message half.
 * This pins the ordering, because Claude sees a stale session if setNotes runs
 * after the service call.
 */

const app = createApp()

beforeEach(async () => {
  await rm(dataFile, { force: true })
  vi.mocked(decideNextStep).mockReset()
})

describe('POST /api/sessions/:id/messages with notes attached', () => {
  it('persists the notes and hands Claude a session that already carries them', async () => {
    vi.mocked(decideNextStep).mockResolvedValue({
      status: 'continue',
      question: 'How long have you noticed this?',
    })

    const createRes = await request(app).post('/api/sessions').send({ screenerType: 'child' })
    const session = createRes.body as { id: string }

    const messageRes = await request(app)
      .post(`/api/sessions/${session.id}/messages`)
      .send({ message: 'He reverses letters', notes: 'He is 9 and reads slowly.' })

    expect(messageRes.status).toBe(200)
    expect(messageRes.body.notes).toBe('He is 9 and reads slowly.')

    const [sessionPassedToClaude] = vi.mocked(decideNextStep).mock.calls[0]!
    expect(sessionPassedToClaude.notes).toBe('He is 9 and reads slowly.')
    expect(sessionPassedToClaude.messages).toEqual([
      { role: 'user', content: 'He reverses letters' },
    ])

    const getRes = await request(app).get(`/api/sessions/${session.id}`)
    expect(getRes.body.notes).toBe('He is 9 and reads slowly.')
  })

  it('leaves existing notes untouched when the field is omitted', async () => {
    vi.mocked(decideNextStep).mockResolvedValue({ status: 'continue', question: 'And then?' })

    const createRes = await request(app).post('/api/sessions').send({ screenerType: 'child' })
    const session = createRes.body as { id: string }

    await request(app)
      .post(`/api/sessions/${session.id}/messages`)
      .send({ message: 'First', notes: 'Keep me.' })

    // No `notes` key at all — the controller only calls setNotes for strings.
    const second = await request(app)
      .post(`/api/sessions/${session.id}/messages`)
      .send({ message: 'Second' })

    expect(second.status).toBe(200)
    expect(second.body.notes).toBe('Keep me.')
  })
})
