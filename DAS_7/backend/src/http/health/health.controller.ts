import type { Request, Response } from 'express'
import { fail, ok } from '../responses/api-envelope.js'

export function getHealth(_request: Request, response: Response): void {
    ok(response, { ok: true })
}

export function getReadiness(_request: Request, response: Response): void {
    fail(response, 'Database readiness is not configured yet.', 503)
}
