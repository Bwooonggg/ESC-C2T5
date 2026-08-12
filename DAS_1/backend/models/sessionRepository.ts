import type { ScreenerType, ScreeningSession } from '../../demo_app/shared/types.ts'
import { readAll, updateAll } from './fileStore.ts'
import { createSession, DomainError } from './screeningSession.ts'

/**
 * Model: the repository. Controllers talk to these five functions and never to
 * the store beneath them, so the storage backend can change without touching
 * anything above this file.
 */

export async function create(screenerType: ScreenerType): Promise<ScreeningSession> {
  const session = createSession(screenerType)
  return save(session)
}

export async function findById(id: string): Promise<ScreeningSession | null> {
  const table = await readAll()
  return table[id] ?? null
}

export async function requireById(id: string): Promise<ScreeningSession> {
  const session = await findById(id)
  if (!session) {
    throw new DomainError(`No screening session found with id ${id}.`, 404)
  }
  return session
}

export async function save(session: ScreeningSession): Promise<ScreeningSession> {
  await updateAll((table) => {
    table[session.id] = session
  })
  return session
}

export async function list(): Promise<ScreeningSession[]> {
  return Object.values(await readAll())
}
