import { readFile, rm } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { dataFile } from '../../config.ts'

vi.mock('../../services/claudeService.ts', () => ({
  decideNextStep: vi.fn(),
  generateReport: vi.fn(),
}))

import { createApp } from '../../app.ts'
import { attachContact, attachReport } from '../../models/screeningSession.ts'
import { create, save } from '../../models/sessionRepository.ts'
import { decideNextStep, generateReport } from '../../services/claudeService.ts'

/**
 * IT-15..IT-17 — what the HTTP layer does once a session is finished, and what
 * it does with payloads of the wrong type. The model-level guards are unit
 * tested; these prove the same answers survive routing, JSON parsing and
 * errorHandler.
 */

const app = createApp()
const contact = { name: 'Tan Wei Ling', email: 'wl.tan@example.com', phone: '91234567' }

/** Drives a session all the way to stage "completed" through the Model layer. */
async function completedSession() {
  const fresh = await create('adult')
  return save(attachContact(attachReport(fresh, 'Summary: recommend follow-up.'), contact))
}

async function readDataFile(): Promise<Record<string, { stage: string }>> {
  try {
    return JSON.parse(await readFile(dataFile, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw error
  }
}

beforeEach(async () => {
  await rm(dataFile, { force: true })
  vi.mocked(decideNextStep).mockReset()
  vi.mocked(generateReport).mockReset()
})

// IT-15 — Chat is closed once the session is completed
describe('POST /sessions/:id/messages on a completed session', () => {
  it('responds 409, never calls Claude, and leaves the stored session alone', async () => {
    const session = await completedSession()

    const res = await request(app)
      .post(`/sessions/${session.id}/messages`)
      .send({ message: 'One more thing' })

    expect(res.status).toBe(409)
    expect(res.body).toEqual({ error: 'This screening session is already complete.' })
    expect(decideNextStep).not.toHaveBeenCalled()

    const stored = await readDataFile()
    expect(stored[session.id]!.stage).toBe('completed')
  })
})

// IT-16 — The report endpoint is closed once the session is completed (DEF-01)
describe('POST /sessions/:id/report on a completed session', () => {
  it('responds 409, never calls Claude, and leaves the stored session completed', async () => {
    vi.mocked(generateReport).mockResolvedValue('A second, later report.')
    const session = await completedSession()

    const res = await request(app).post(`/sessions/${session.id}/report`).send({})

    expect(res.status).toBe(409)
    expect(res.body).toEqual({ error: 'This screening session is already complete.' })
    // The guard runs before the service call, so a finished session cannot cost
    // another report generation.
    expect(generateReport).not.toHaveBeenCalled()

    const stored = await readDataFile()
    expect(stored[session.id]!.stage).toBe('completed')
  })
})

// IT-17 — Wrong-typed payloads are rejected before any Model call
describe('type validation on the write endpoints', () => {
  it('rejects a non-string message with 400 and no Claude call', async () => {
    const session = await create('adult')

    const res = await request(app).post(`/sessions/${session.id}/messages`).send({ message: 42 })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'message must be a string.' })
    expect(decideNextStep).not.toHaveBeenCalled()
  })

  it('rejects a non-string question or answer with 400 and records nothing', async () => {
    const session = await create('adult')

    const res = await request(app)
      .post(`/sessions/${session.id}/responses`)
      .send({ question: 1, answer: true })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'question and answer must both be strings.' })

    const stored = await readDataFile()
    expect((stored[session.id] as unknown as { responses: object }).responses).toEqual({})
  })

  it('checks the payload type before it checks that the session exists', async () => {
    // Ordering matters for the client: a bad body reports the body problem,
    // not a misleading 404.
    const res = await request(app)
      .post('/sessions/00000000-0000-0000-0000-000000000000/messages')
      .send({ message: null })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'message must be a string.' })
  })
})
