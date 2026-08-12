import { readFile, rm } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import type { ScreeningSession } from '../../../demo_app/shared/types.ts'
import { dataFile } from '../../config.ts'

/**
 * Both network-crossing leaves are stubbed top-down: claudeService.ts (paid,
 * non-deterministic) and table.ts, which reaches Supabase *and* renames the
 * real data file out from under the suite. Everything between the route and
 * those two stubs runs for real.
 */
vi.mock('../../services/claudeService.ts', () => ({
  decideNextStep: vi.fn(),
  generateReport: vi.fn(),
}))

vi.mock('../../models/table.ts', () => ({
  insertSupa: vi.fn().mockResolvedValue(undefined),
  moveSessionFile: vi.fn().mockResolvedValue(undefined),
}))

import { createApp } from '../../app.ts'
import { insertSupa, moveSessionFile } from '../../models/table.ts'
import { decideNextStep } from '../../services/claudeService.ts'

/**
 * IT-23 — the whole child-screener journey across five endpoints in one
 * session. The existing cases each test one endpoint from a fresh session, so
 * nothing yet proved the stages compose: that a checklist answer survives two
 * chat turns, that the report Claude writes mid-conversation is the one the
 * contact step later requires, and that the contact hand-off fires exactly once
 * with the finished session.
 */

const app = createApp()
const contact = { name: 'Tan Wei Ling', email: 'wl.tan@example.com', phone: '+65 9123 4567' }
const question = 'Does the child confuse letters that look similar, such as b and d?'

beforeEach(async () => {
  await rm(dataFile, { force: true })
  vi.mocked(decideNextStep).mockReset()
  vi.mocked(insertSupa).mockClear()
  vi.mocked(moveSessionFile).mockClear()
})

describe('child screener, create → chat → checklist → report → contact', () => {
  it('carries state across every stage and hands the finished session to storage once', async () => {
    // 1. Create
    const createRes = await request(app).post('/api/sessions').send({ screenerType: 'child' })
    expect(createRes.status).toBe(201)
    const { id } = createRes.body as ScreeningSession
    expect(createRes.body.stage).toBe('screening')

    // 2. First chat turn — Claude asks for more
    vi.mocked(decideNextStep).mockResolvedValueOnce({
      status: 'continue',
      question: 'How long have you noticed this?',
    })
    const firstTurn = await request(app)
      .post(`/api/sessions/${id}/messages`)
      .send({ message: 'He reverses letters', notes: 'He is 9.' })
    expect(firstTurn.status).toBe(200)
    expect(firstTurn.body.messages).toHaveLength(2)

    // 3. Checklist answer, mid-conversation
    const answerRes = await request(app)
      .post(`/api/sessions/${id}/responses`)
      .send({ question, answer: 'Yes' })
    expect(answerRes.status).toBe(200)
    expect(answerRes.body.responses[question]).toBe('Yes')
    // The chat history from step 2 is still there.
    expect(answerRes.body.messages).toHaveLength(2)

    // 4. Second chat turn — Claude finishes and writes the report
    vi.mocked(decideNextStep).mockResolvedValueOnce({
      status: 'complete',
      report: 'Summary: signs consistent with dyslexia. Recommend a full assessment.',
    })
    const secondTurn = await request(app)
      .post(`/api/sessions/${id}/messages`)
      .send({ message: 'Since primary one' })
    expect(secondTurn.status).toBe(200)
    expect(secondTurn.body.stage).toBe('report')
    expect(secondTurn.body.messages).toHaveLength(3)
    expect(secondTurn.body.responses[question]).toBe('Yes')
    expect(secondTurn.body.notes).toBe('He is 9.')

    // 5. Contact — allowed now that a report exists
    const contactRes = await request(app).post(`/api/sessions/${id}/contact`).send(contact)
    expect(contactRes.status).toBe(200)
    expect(contactRes.body.stage).toBe('completed')
    expect(contactRes.body.contact).toEqual(contact)
    // Nothing gathered along the way was dropped by the final write.
    expect(contactRes.body.report).toContain('Recommend a full assessment.')
    expect(contactRes.body.messages).toHaveLength(3)

    // The storage hand-off happens once, with the completed session.
    expect(insertSupa).toHaveBeenCalledTimes(1)
    expect(moveSessionFile).toHaveBeenCalledTimes(1)
    const [handedOff] = vi.mocked(insertSupa).mock.calls[0]!
    expect(handedOff.stage).toBe('completed')
    expect(handedOff.contact).toEqual(contact)

    // The JSON store agrees with the response body.
    const table = JSON.parse(await readFile(dataFile, 'utf8')) as Record<string, ScreeningSession>
    expect(table[id]!.stage).toBe('completed')
    expect(table[id]!.updatedAt >= table[id]!.createdAt).toBe(true)
  })

  it('does not reach storage when the contact details are invalid', async () => {
    const createRes = await request(app).post('/api/sessions').send({ screenerType: 'child' })
    const { id } = createRes.body as ScreeningSession

    const res = await request(app)
      .post(`/api/sessions/${id}/contact`)
      .send({ name: '', email: 'nope', phone: '1' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({
      error: 'Name is required. A valid email address is required. A valid phone number is required.',
    })
    // validateContact runs before requireById, so neither the store nor
    // Supabase is touched.
    expect(insertSupa).not.toHaveBeenCalled()
    expect(moveSessionFile).not.toHaveBeenCalled()
  })
})
