import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

export const requestId: RequestHandler = (request, response, next) => {
    const incomingId = request.header('x-request-id')
    const id = incomingId && incomingId.length <= 128 ? incomingId : randomUUID()

    response.setHeader('x-request-id', id)
    response.locals.requestId = id
    next()
}
