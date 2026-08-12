import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { dataFile } from '../../config.ts'
import { readAll, writeAll } from '../../models/fileStore.ts'
import { create, findById, list, save } from '../../models/sessionRepository.ts'
import { appendMessage } from '../../models/screeningSession.ts'

/**
 * IT-20..IT-22 — bottom-up integration of sessionRepository.ts over the real
 * filesystem leaf, no HTTP involved. IT-01 covered one session written once;
 * these cover the three things that actually go wrong with a
 * whole-table-in-one-file store: other records, a damaged file, and two writes
 * racing each other.
 */

beforeEach(async () => {
  await rm(dataFile, { force: true })
})

// IT-20 — Records do not clobber each other
describe('saving one session among many', () => {
  it('rewrites the whole table without disturbing the other records', async () => {
    const a = await create('adult')
    const b = await create('child')
    const c = await create('adult')

    const updatedB = await save(appendMessage(b, 'user', 'He reverses letters'))

    expect(updatedB.messages).toHaveLength(1)
    expect(await findById(a.id)).toEqual(a)
    expect(await findById(c.id)).toEqual(c)

    const table = JSON.parse(await readFile(dataFile, 'utf8')) as Record<string, unknown>
    expect(Object.keys(table).sort()).toEqual([a.id, b.id, c.id].sort())
  })
})

// IT-21 — A damaged data file degrades to empty rather than crashing
describe('readAll against a data file that is not a session table', () => {
  it('returns an empty table for a JSON array and lets the next create heal the file', async () => {
    await mkdir(path.dirname(dataFile), { recursive: true })
    await writeFile(dataFile, JSON.stringify([1, 2, 3]), 'utf8')

    expect(await readAll()).toEqual({})
    expect(await list()).toEqual([])

    const healed = await create('adult')
    const table = JSON.parse(await readFile(dataFile, 'utf8')) as Record<string, unknown>
    expect(Object.keys(table)).toEqual([healed.id])
  })

  it('propagates a genuine parse failure instead of silently returning empty', async () => {
    await mkdir(path.dirname(dataFile), { recursive: true })
    await writeFile(dataFile, '{ not json', 'utf8')

    // Only ENOENT is swallowed; corrupt-but-present content is a real fault and
    // must be loud, or a bad write would quietly erase every session.
    await expect(readAll()).rejects.toThrow(SyntaxError)
  })
})

describe('concurrent writes', () => {
  // IT-22a — sequential saves are durable
  it('keeps every record when saves are awaited one at a time', async () => {
    const ids: string[] = []
    for (let i = 0; i < 10; i += 1) {
      ids.push((await create('adult')).id)
    }

    const table = JSON.parse(await readFile(dataFile, 'utf8')) as Record<string, unknown>
    expect(Object.keys(table).sort()).toEqual([...ids].sort())
  })

  /**
   * IT-22b — Concurrent saves keep every record (DEF-02).
   *
   * save() used to read the table outside writeAll's chain, so ten concurrent
   * saves all read the same empty table and the last writer won. updateAll now
   * chains the read as well, so each mutation starts from the table the
   * previous one left behind.
   */
  it('keeps every record when ten saves run concurrently', async () => {
    const sessions = await Promise.all(
      Array.from({ length: 10 }, (_, i) => create(i % 2 === 0 ? 'adult' : 'child')),
    )

    const table = JSON.parse(await readFile(dataFile, 'utf8')) as Record<
      string,
      { id: string; stage: string }
    >
    expect(Object.keys(table).sort()).toEqual(sessions.map((s) => s.id).sort())

    // Every surviving record is complete, not a truncated or interleaved write.
    for (const [id, record] of Object.entries(table)) {
      expect(record.id).toBe(id)
      expect(record.stage).toBe('screening')
    }
  })

  // IT-22c — writeAll's own chain is sound when the caller supplies the table
  it('applies queued writeAll calls in order, with the last one winning', async () => {
    const [a, b] = [await create('adult'), await create('child')]

    await Promise.all([writeAll({ [a.id]: a }), writeAll({ [a.id]: a, [b.id]: b })])

    const table = JSON.parse(await readFile(dataFile, 'utf8')) as Record<string, unknown>
    expect(Object.keys(table).sort()).toEqual([a.id, b.id].sort())
  })
})
