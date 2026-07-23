import type { Request, Response } from 'express'
import { fail, ok } from '../responses/api-envelope.js'
import type { ReadinessProbe } from '../../shared/readiness.js'

export function getHealth(_request: Request, response: Response): void {
    ok(response, { ok: true })
}

export function getReadiness(_request: Request, response: Response): void {
    fail(response, 'Database readiness is not configured yet.', 503)
}

export function createReadinessHandler(
    probe?: ReadinessProbe,
): (_request: Request, response: Response) => Promise<void> {
    return async (_request, response) => {
        if (probe === undefined) {
            getReadiness(_request, response)
            return
        }

        try {
            await probe.check()
            ok(response, { ok: true })
        } catch {
            fail(response, 'Database readiness check failed.', 503)
        }
    }
}
