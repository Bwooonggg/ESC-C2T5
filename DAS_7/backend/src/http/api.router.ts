import { Router } from 'express'
import type { ApiContainer } from '../app/api-container.js'
import { ingestionRouter } from '../modules/ingestion/http/ingestion.routes.js'
import { parentRouter } from '../modules/parents/http/parent.routes.js'
import { preferenceRouter } from '../modules/preferences/http/preference.routes.js'
import { createTrackProgressRouter } from '../modules/track-progress/http/track-progress.routes.js'
import { healthRouter } from './health/health.routes.js'

export function createApiRouter(container: ApiContainer): Router {
    const router = Router()

    router.use('/health', healthRouter)
    router.use('/', parentRouter)
    router.use('/students', createTrackProgressRouter(container.trackProgressModel))
    router.use('/parents', preferenceRouter)
    router.use('/v1', ingestionRouter)

    return router
}
