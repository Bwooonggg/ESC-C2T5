import { readFile, rm } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { dataFile } from '../../config.ts'

/**
 * Top-down stub: claudeService.ts crosses a network boundary to a paid,
 * non-deterministic external service, so the controller/routes layer above it
 * is exercised here against a stubbed decision instead of a live call.
 * `vi.mock` calls are hoisted above these imports by Vitest's transform.
 */
vi.mock('../../services/claudeService.ts', () => ({
  decideNextStep: vi.fn(),
  generateReport: vi.fn(),
}))

import { createApp } from '../../app.ts'
import { decideNextStep } from '../../services/claudeService.ts'

const app = createApp()

beforeEach(async () => {
  await rm(dataFile, { force: true })
  vi.mocked(decideNextStep).mockReset()
})

describe('POST /api/sessions/:id/messages', () => {
  // IT-02 — Continue path via /messages
  it('appends the user message and returns the assistant question when Claude says continue', async () => {
    vi.mocked(decideNextStep).mockResolvedValue({
      status: 'continue',
      question: 'How long have you noticed this?',
    })

    const createRes = await request(app).post('/api/sessions').send({ screenerType: 'adult' })
    expect(createRes.status).toBe(201)
    const session = createRes.body as { id: string; stage: string }
    expect(session.stage).toBe('screening')

    const messageRes = await request(app)
      .post(`/api/sessions/${session.id}/messages`)
      .send({ message: 'I mix up letters' })

    expect(messageRes.status).toBe(200)
    expect(messageRes.body.messages).toEqual([
      { role: 'user', content: 'I mix up letters' },
      { role: 'assistant', content: 'How long have you noticed this?' },
    ])
    expect(messageRes.body.stage).toBe('screening')

    const persisted = JSON.parse(await readFile(dataFile, 'utf8'))
    expect(persisted[session.id].messages).toHaveLength(2)
  })

  // IT-03 — Complete path via /messages
  it('attaches a report and flips the stage when Claude says complete', async () => {
    vi.mocked(decideNextStep).mockResolvedValue({
      status: 'complete',
      report: 'Summary...',
    })

    const createRes = await request(app).post('/api/sessions').send({ screenerType: 'adult' })
    const session = createRes.body as { id: string }

    const messageRes = await request(app)
      .post(`/api/sessions/${session.id}/messages`)
      .send({ message: "That's everything" })

    expect(messageRes.status).toBe(200)
    expect(messageRes.body.stage).toBe('report')
    expect(messageRes.body.report).toBe('Summary...')
    expect(messageRes.body.messages).toEqual([{ role: 'user', content: "That's everything" }])
  })
})
