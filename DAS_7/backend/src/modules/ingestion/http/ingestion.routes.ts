import { Router } from 'express'
import { notImplemented } from '../../../http/responses/not-implemented.js'

export const ingestionRouter = Router()

ingestionRouter.post('/parents', notImplemented)
ingestionRouter.post('/students', notImplemented)
ingestionRouter.put('/parents/:parentId/students/:studentId', notImplemented)
ingestionRouter.post(
    '/students/:studentId/progress-records',
    notImplemented,
)
ingestionRouter.patch(
    '/students/:studentId/progress-records/:recordId',
    notImplemented,
)
