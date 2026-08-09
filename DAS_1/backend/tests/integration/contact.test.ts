import { readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { dataFile, projectRoot } from '../../config.ts'
import { createApp } from '../../app.ts'
import { create, save } from '../../models/sessionRepository.ts'
import { attachReport } from '../../models/screeningSession.ts'

const app = createApp()
const contact = { name: 'Tan Wei Ling', email: 'wl.tan@example.com', phone: '91234567' }

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

// IT-07 — Contact rejected before a report exists
describe('POST /api/sessions/:id/contact before a report exists', () => {
  it('rejects with 409 and leaves the session and data file untouched', async () => {
    const createRes = await request(app).post('/api/sessions').send({ screenerType: 'adult' })
    const session = createRes.body as { id: string }

    const contactRes = await request(app).post(`/api/sessions/${session.id}/contact`).send(contact)

    expect(contactRes.status).toBe(409)
    expect(contactRes.body).toEqual({
      error: 'A screening report must exist before DAS services can be engaged.',
    })

    const stored = await readDataFile()
    expect((stored[session.id] as { stage: string }).stage).toBe('screening')
  })
})

/**
 * IT-06 — Contact persists to MySQL and archives the file.
 *
 * This is the one case in the plan where the leaf (db.ts) is deliberately
 * exercised for real rather than stubbed, per the "hybrid" integration
 * strategy in docs/Test Plans for DAS 1.docx: everything else stubs the
 * network-crossing leaves, but IT-06 exists specifically to prove table.ts +
 * db.ts work against a real schema. That needs a reachable, disposable MySQL
 * database, which this sandbox does not have — so it's skipped unless you
 * point RUN_DB_INTEGRATION_TESTS=1 and real DB_HOST/DB_USER/DB_PASSWORD/
 * DB_NAME at a throwaway schema (see backend/tests/setup/env.ts).
 *
 * Known quirk carried over from table.ts, not introduced by this test:
 * moveSessionFile() always moves the data file to
 * <projectRoot>/backend/data/just_submitted/sessions.json, ignoring
 * SESSIONS_FILE. That means running this for real writes into the real
 * working tree, which the afterEach below cleans up.
 */
const runDbTests = process.env.RUN_DB_INTEGRATION_TESTS === '1'

describe.skipIf(!runDbTests)('POST /api/sessions/:id/contact with a real MySQL schema', () => {
  const justSubmittedFile = path.join(
    projectRoot,
    'backend',
    'data',
    'just_submitted',
    'sessions.json',
  )

  afterEach(async () => {
    await rm(justSubmittedFile, { force: true })
  })

  it('inserts a row into responses and archives sessions.json into just_submitted/', async () => {
    const { pool } = await import('../../models/db.ts')

    let session = await create('adult')
    session = attachReport(session, 'Summary: recommend follow-up.')
    session = await save(session)

    const contactRes = await request(app).post(`/api/sessions/${session.id}/contact`).send(contact)

    expect(contactRes.status).toBe(200)
    expect(contactRes.body.stage).toBe('completed')

    const [rows] = await pool.query('SELECT id FROM responses WHERE id = ?', [session.id])
    expect((rows as unknown[]).length).toBe(1)

    await expect(stat(dataFile)).rejects.toMatchObject({ code: 'ENOENT' })

    const archived = JSON.parse(await readFile(justSubmittedFile, 'utf8'))
    expect(archived[session.id].id).toBe(session.id)
  })
})
