import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { TrackProgressModel } from '../application/track-progress.model.js'
import { createGeneratorInvocationContext } from '../../../shared/generator-context.js'
import { ok } from '../../../http/responses/api-envelope.js'
import { parseStudentId } from './track-progress.schemas.js'
import {
    toSummaryResponse,
    toTrackProgressResponse,
} from './track-progress.responses.js'

export interface TrackProgressController {
    readonly trackProgress: RequestHandler
    readonly getSummary: RequestHandler
}

export function createTrackProgressController(
    model: TrackProgressModel,
): TrackProgressController {
    return {
        trackProgress: createTrackProgressHandler(model, false),
        getSummary: createTrackProgressHandler(model, true),
    }
}

function createTrackProgressHandler(
    model: TrackProgressModel,
    summaryOnly: boolean,
): RequestHandler {
    return async (
        request: Request,
        response: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const studentId = parseStudentId(request.params)
            const result = await model.trackProgress(
                studentId,
                createRequestGeneratorContext(request, response),
            )

            if (summaryOnly) {
                ok(response, toSummaryResponse(result.summary))
                return
            }

            ok(
                response,
                toTrackProgressResponse(result.records, result.summary),
            )
        } catch (error) {
            next(error)
        }
    }
}

function createRequestGeneratorContext(
    request: Request,
    response: Response,
) {
    const fallback = createGeneratorInvocationContext()
    const correlationId =
        typeof response.locals.requestId === 'string'
            ? response.locals.requestId
            : fallback.correlationId

    return {
        correlationId,
        idempotencyKey:
            request.header('idempotency-key') ||
            `${request.method}:${request.originalUrl}:${randomUUID()}`,
    }
}
