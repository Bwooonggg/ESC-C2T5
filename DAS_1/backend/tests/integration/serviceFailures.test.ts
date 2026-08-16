import { readFile, rm } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { dataFile } from '../../config.ts'

vi.mock('../../services/claudeService.ts', () => ({
  decideNextStep: vi.fn(),
  generateReport: vi.fn(),
}))

import { createApp } from '../../app.ts'
import { decideNextStep, generateReport } from '../../services/claudeService.ts'

/**
 * IT-18..IT-19 — the failure half of the Claude boundary. IT-02/IT-03/IT-04
 * only ever gave the stub a successful decision, so nothing yet proved that a
 * rejected service promise reaches errorHandler at all (Express 5 forwards
 * rejections from async handlers) or that a failed turn leaves the stored
 * session exactly as it was.
 */

const app = createApp()

async function storedSession(id: string) {
  const table = JSON.parse(await readFile(dataFile, 'utf8')) as Record<
    string,
    { stage: string; messages: unknown[]; report: string | null }
  >
  return table[id]!
}

beforeEach(async () => {
  await rm(dataFile, { force: true })
  vi.mocked(decideNextStep).mockReset()
  vi.mocked(generateReport).mockReset()
  // errorHandler console.errors anything >= 500; keep the suite output readable.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// IT-18 — Claude is unreachable
describe('POST /sessions/:id/messages when the Claude service rejects', () => {
  it('surfaces a 500 in the documented error shape and rolls the turn back', async () => {
    const createRes = await request(app).post('/sessions').send({ screenerType: 'adult' })
    const session = createRes.body as { id: string }

    vi.mocked(decideNextStep).mockRejectedValue(new Error('Claude is temporarily unavailable.'))

    const res = await request(app)
      .post(`/sessions/${session.id}/messages`)
      .send({ message: 'I mix up letters' })

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Claude is temporarily unavailable.' })

    // save() runs only after a successful decision, so the user's message is
    // not persisted — the client can safely retry the same turn.
    const stored = await storedSession(session.id)
    expect(stored.messages).toEqual([])
    expect(stored.stage).toBe('screening')
  })
})

// IT-19 — Claude returns an empty report
describe('POST /sessions/:id/report when Claude returns an empty report', () => {
  it('maps the model rule to 502 and leaves the session in the screening stage', async () => {
    const createRes = await request(app).post('/sessions').send({ screenerType: 'adult' })
    const session = createRes.body as { id: string }

    vi.mocked(generateReport).mockResolvedValue('   ')

    const res = await request(app).post(`/sessions/${session.id}/report`).send({})

    expect(res.status).toBe(502)
    expect(res.body).toEqual({ error: 'The screener produced an empty report.' })

    const stored = await storedSession(session.id)
    expect(stored.stage).toBe('screening')
    expect(stored.report).toBeNull()
  })
})

// IT-19b — a non-Error thrown anywhere below still produces the {error} shape
describe('errorHandler with a non-Error rejection', () => {
  it('falls back to 500 "Server error" rather than leaking the raw value', async () => {
    const createRes = await request(app).post('/sessions').send({ screenerType: 'adult' })
    const session = createRes.body as { id: string }

    vi.mocked(decideNextStep).mockRejectedValue('socket hang up')

    const res = await request(app)
      .post(`/sessions/${session.id}/messages`)
      .send({ message: 'hello' })

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Server error' })
  })
})
