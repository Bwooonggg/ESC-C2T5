import cors from 'cors'
import express, { type Express } from 'express'
import { createApiContainer, type ApiContainer } from './api-container.js'
import { apiRouter } from '../http/api.router.js'
import { errorHandler } from '../http/middleware/error-handler.middleware.js'
import { notFound } from '../http/middleware/not-found.middleware.js'
import { requestId } from '../http/middleware/request-id.middleware.js'

export function createApiApp(
    container: ApiContainer = createApiContainer(),
): Express {
    const app = express()

    app.disable('x-powered-by')
    app.use(cors({ origin: container.config.api.corsOrigin }))
    app.use(express.json({ limit: '1mb' }))
    app.use(requestId)

    app.use('/api', apiRouter)

    app.use(notFound)
    app.use(errorHandler)

    return app
}
