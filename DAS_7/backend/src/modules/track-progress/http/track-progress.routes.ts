import { Router } from 'express'
import { notImplemented } from '../../../http/responses/not-implemented.js'
import { notConfigured } from '../../../http/responses/not-configured.js'
import type { TrackProgressModel } from '../application/track-progress.model.js'
import { createTrackProgressController } from './track-progress.controller.js'

export function createTrackProgressRouter(
    model?: TrackProgressModel,
): Router {
    const router = Router()

    if (model) {
        const controller = createTrackProgressController(model)
        router.get('/:studentId/track-progress', controller.trackProgress)
        router.get('/:studentId/summary', controller.getSummary)
    } else {
        router.get('/:studentId/track-progress', notConfigured)
        router.get('/:studentId/summary', notConfigured)
    }

    router.post('/:studentId/recommendations', notImplemented)

    return router
}
