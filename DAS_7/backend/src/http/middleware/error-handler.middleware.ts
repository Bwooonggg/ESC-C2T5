import type { ErrorRequestHandler } from 'express'
import { fail } from '../responses/api-envelope.js'
import { mapError } from '../responses/error-mapper.js'

export const errorHandler: ErrorRequestHandler = (
    error,
    _request,
    response,
    _next,
) => {
    console.error('[server] unhandled error:', error)
    const mappedError = mapError(error)
    fail(response, mappedError.message, mappedError.status)
}
