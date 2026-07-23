import type { RequestHandler } from 'express'
import { fail } from './api-envelope.js'

export const notConfigured: RequestHandler = (_request, response) => {
    fail(response, 'This service is not configured.', 503)
}
