import type { RequestHandler } from 'express'
import { fail } from '../responses/api-envelope.js'

export const notFound: RequestHandler = (_request, response) => {
    fail(response, 'Not found.', 404)
}
