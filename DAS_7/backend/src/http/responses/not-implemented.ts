import type { RequestHandler } from 'express'
import { fail } from './api-envelope.js'

export const notImplemented: RequestHandler = (_request, response) => {
    fail(response, 'This endpoint is not implemented yet.', 501)
}
