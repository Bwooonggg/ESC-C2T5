import { rm } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { dataFile } from '../../config.ts'

vi.mock('../../services/claudeService.ts', () => ({
  decideNextStep: vi.fn(),
  generateReport: vi.fn(),
}))

import { createApp } from '../../app.ts'
import { decideNextStep, generateReport } from '../../services/claudeService.ts'

const app = createApp()

beforeEach(async () => {
  await rm(dataFile, { force: true })
  vi.mocked(decideNextStep).mockReset()
  vi.mocked(generateReport).mockReset()
})

// IT-04 — Early-finish path via /report
describe('POST /sessions/:id/report', () => {
  it('calls generateReport (not decideNextStep) and attaches its output regardless of conversation length', async () => {
    vi.mocked(generateReport).mockResolvedValue('Early report based on minimal input.')

    const createRes = await request(app).post('/sessions').send({ screenerType: 'adult' })
    const session = createRes.body as { id: string }

    const reportRes = await request(app)
      .post(`/sessions/${session.id}/report`)
      .send({ notes: 'just tired eyes, please still check' })

    expect(reportRes.status).toBe(200)
    expect(reportRes.body.stage).toBe('report')
    expect(reportRes.body.report).toBe('Early report based on minimal input.')

    expect(decideNextStep).not.toHaveBeenCalled()
    expect(generateReport).toHaveBeenCalledTimes(1)

    const [sessionPassedToClaude] = vi.mocked(generateReport).mock.calls[0]!
    expect(sessionPassedToClaude.notes).toBe('just tired eyes, please still check')
  })
})
