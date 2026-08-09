import { readFile, rm } from 'node:fs/promises'
import { beforeEach, describe, expect, it } from 'vitest'
import { dataFile } from '../../config.ts'
import { create, findById } from '../../models/sessionRepository.ts'

/**
 * Bottom-up integration: fileStore.ts is a real-filesystem leaf, exercised
 * here through sessionRepository.ts with no HTTP layer involved. Each test
 * file gets its own throwaway SESSIONS_FILE (see tests/setup/env.ts), so this
 * starts against an empty/non-existent data file as IT-01 requires.
 */

beforeEach(async () => {
  await rm(dataFile, { force: true })
})

// IT-01 — Save/read round trip
describe('sessionRepository save/read round trip', () => {
  it('persists a session such that an independent read returns an equal object', async () => {
    const sessionA = await create('adult')
    expect(sessionA.stage).toBe('screening')

    const reread = await findById(sessionA.id)
    expect(reread).toEqual(sessionA)

    const raw = JSON.parse(await readFile(dataFile, 'utf8')) as Record<string, unknown>
    expect(Object.keys(raw)).toEqual([sessionA.id])
    expect(raw[sessionA.id]).toEqual(sessionA)
  })
})
