import { Router } from 'express'
import { notImplemented } from '../../../http/responses/not-implemented.js'

export const trackProgressRouter = Router()

trackProgressRouter.get('/:studentId/track-progress', notImplemented)
trackProgressRouter.get('/:studentId/summary', notImplemented)
trackProgressRouter.post('/:studentId/recommendations', notImplemented)
