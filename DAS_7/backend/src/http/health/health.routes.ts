import { Router } from 'express'
import {
    createReadinessHandler,
    getHealth,
} from './health.controller.js'
import type { ReadinessProbe } from '../../shared/readiness.js'

export function createHealthRouter(probe?: ReadinessProbe): Router {
    const router = Router()

    router.get('/', getHealth)
    router.get('/ready', createReadinessHandler(probe))

    return router
}

export const healthRouter = createHealthRouter()
