import type { Response } from 'express'
import type { ApiEnvelope } from '../types/domain.js'

// Every route answers in the same envelope, so the client has exactly one
// success branch and one failure branch to handle.

export function ok<T>(res: Response, data: T, status = 200): void {
  const body: ApiEnvelope<T> = { ok: true, data }
  res.status(status).json(body)
}

export function fail(res: Response, error: string, status = 400): void {
  const body: ApiEnvelope<never> = { ok: false, error }
  res.status(status).json(body)
}
