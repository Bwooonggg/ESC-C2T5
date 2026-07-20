import type { Response } from 'express'

export type ApiEnvelope<T> =
    | { ok: true; data: T }
    | { ok: false; error: string }

export function ok<T>(response: Response, data: T, status = 200): void {
    const body: ApiEnvelope<T> = { ok: true, data }
    response.status(status).json(body)
}

export function fail(
    response: Response,
    error: string,
    status = 400,
): void {
    const body: ApiEnvelope<never> = { ok: false, error }
    response.status(status).json(body)
}
