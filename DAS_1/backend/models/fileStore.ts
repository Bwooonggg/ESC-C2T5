import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ScreeningSession } from '../../demo_app/shared/types.ts'
import { dataFile } from '../config.ts'

/**
 * Model: persistence. The whole table lives in one JSON file, so writes are
 * chained rather than concurrent. Single-process only — swapping this file for
 * a MongoDB or MySQL driver is the intended upgrade path.
 */

export type SessionTable = Record<string, ScreeningSession>

let pendingWrite: Promise<void> = Promise.resolve()

export async function readAll(): Promise<SessionTable> {
  try {
    const raw = await readFile(dataFile, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as SessionTable
    }
    return {}
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw error
  }
}

export function writeAll(table: SessionTable): Promise<void> {
  const write = pendingWrite.then(async () => {
    await mkdir(path.dirname(dataFile), { recursive: true })
    await writeFile(dataFile, JSON.stringify(table, null, 2), 'utf8')
  })

  pendingWrite = write.catch(() => undefined)
  return write
}
