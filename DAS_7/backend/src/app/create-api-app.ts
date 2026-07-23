import express, { type Express } from 'express'
import { createApiContainer, type ApiContainer } from './api-container.js'
import { createApiRouter } from '../http/api.router.js'
import { errorHandler } from '../http/middleware/error-handler.middleware.js'
import { notFound } from '../http/middleware/not-found.middleware.js'
import { requestId } from '../http/middleware/request-id.middleware.js'

export function createApiApp(
    container: ApiContainer = createApiContainer(),
): Express {
    const app = express()

    app.disable('x-powered-by')
    app.use(express.json({ limit: '1mb' }))
    app.use(requestId)

    // Traefik owns the public /api/insights prefix and strips it before the
    // request reaches this service. Express therefore exposes service-local
    // paths directly at the application root.
    app.use(createApiRouter(container))

    app.use(notFound)
    app.use(errorHandler)

    return app
}
