import { rm } from 'node:fs/promises'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { dataFile } from '../../config.ts'
import { createApp } from '../../app.ts'

const app = createApp()

beforeEach(async () => {
  await rm(dataFile, { force: true })
})

// IT-05 — Checklist round trip
describe('POST /sessions/:id/responses', () => {
  it('persists an answer that a later GET reflects, with no Claude call involved', async () => {
    const createRes = await request(app).post('/sessions').send({ screenerType: 'child' })
    expect(createRes.status).toBe(201)
    const session = createRes.body as { id: string }

    const question = 'Does the child confuse letters that look similar, such as b and d?'
    const answerRes = await request(app)
      .post(`/sessions/${session.id}/responses`)
      .send({ question, answer: 'Yes' })

    expect(answerRes.status).toBe(200)
    expect(answerRes.body.responses).toEqual({ [question]: 'Yes' })

    const getRes = await request(app).get(`/sessions/${session.id}`)

    expect(getRes.status).toBe(200)
    expect(getRes.body.responses).toEqual(answerRes.body.responses)
  })
})
