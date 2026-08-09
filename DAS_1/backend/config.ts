import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

dotenv.config()

export const projectRoot = fileURLToPath(new URL('..', import.meta.url))

export const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5'
export const port = Number(process.env.PORT ?? 4173)
export const dataFile =
  process.env.SESSIONS_FILE ?? path.join(projectRoot, './backend/data', 'sessions.json')

export function requireApiKey(): string {
  const apiKey = process.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('Missing VITE_ANTHROPIC_API_KEY in backend/.env')
  }
  return apiKey
}
