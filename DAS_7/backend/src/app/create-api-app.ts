import cors from 'cors'
import express, { type Express } from 'express'
import { apiRouter } from '../http/api.router.js'
import { errorHandler } from '../http/middleware/error-handler.middleware.js'
import { notFound } from '../http/middleware/not-found.middleware.js'
import { requestId } from '../http/middleware/request-id.middleware.js'

export function createApiApp(): Express {
    const app = express()
    const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

    app.disable('x-powered-by')
    app.use(cors({ origin: corsOrigin }))
    app.use(express.json({ limit: '1mb' }))
    app.use(requestId)

    app.use('/api', apiRouter)

    app.use(notFound)
    app.use(errorHandler)

    return app
}
