import { randomUUID } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { dataFile } from '../../config.ts'
import { createApp } from '../../app.ts'

const app = createApp()

async function readDataFile(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(dataFile, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw error
  }
}

beforeEach(async () => {
  await rm(dataFile, { force: true })
})

// IT-08 — Malformed session creation → clean 400
describe('POST /sessions with an invalid screenerType', () => {
  it('responds 400 with the documented error shape and creates nothing', async () => {
    const res = await request(app).post('/sessions').send({ screenerType: 'teenager' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'screenerType must be either "adult" or "child".' })
    expect(Object.keys(await readDataFile())).toHaveLength(0)
  })
})

// IT-09 — Unknown session id → 404
describe('GET /sessions/:id for an unknown id', () => {
  it('responds 404 with the documented error shape and has no side effects', async () => {
    const unknownId = randomUUID()

    const res = await request(app).get(`/sessions/${unknownId}`)

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: `No screening session found with id ${unknownId}.` })
    expect(Object.keys(await readDataFile())).toHaveLength(0)
  })
})
