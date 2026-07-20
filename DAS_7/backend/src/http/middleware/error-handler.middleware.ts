import type { ErrorRequestHandler } from 'express'
import { fail } from '../responses/api-envelope.js'

export const errorHandler: ErrorRequestHandler = (
    error,
    _request,
    response,
    _next,
) => {
    console.error('[server] unhandled error:', error)
    fail(response, 'Something went wrong on the server.', 500)
}
