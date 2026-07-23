import { Router } from 'express'
import { notConfigured } from '../../../http/responses/not-configured.js'
import type { RecommendationModel } from '../application/recommendation.model.js'
import type { TrackProgressModel } from '../application/track-progress.model.js'
import {
    createRecommendationController,
    createTrackProgressController,
} from './track-progress.controller.js'

export function createTrackProgressRouter(
    trackProgressModel?: TrackProgressModel,
    recommendationModel?: RecommendationModel,
): Router {
    const router = Router()

    if (trackProgressModel) {
        const controller = createTrackProgressController(trackProgressModel)
        router.get('/:studentId/track-progress', controller.trackProgress)
        router.get('/:studentId/summary', controller.getSummary)
    } else {
        router.get('/:studentId/track-progress', notConfigured)
        router.get('/:studentId/summary', notConfigured)
    }

    if (recommendationModel) {
        router.post(
            '/:studentId/recommendations',
            createRecommendationController(recommendationModel),
        )
    } else {
        router.post('/:studentId/recommendations', notConfigured)
    }

    return router
}
