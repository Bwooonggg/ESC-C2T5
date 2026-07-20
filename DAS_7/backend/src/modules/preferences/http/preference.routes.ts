import { Router } from 'express'
import { notImplemented } from '../../../http/responses/not-implemented.js'

export const preferenceRouter = Router()

preferenceRouter.get('/:parentId/preferences', notImplemented)
preferenceRouter.put('/:parentId/preferences', notImplemented)
