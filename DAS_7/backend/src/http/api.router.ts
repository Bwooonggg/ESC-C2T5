import { Router } from 'express'
import { authRouter } from '../modules/auth/http/auth.routes.js'
import { ingestionRouter } from '../modules/ingestion/http/ingestion.routes.js'
import { parentRouter } from '../modules/parents/http/parent.routes.js'
import { preferenceRouter } from '../modules/preferences/http/preference.routes.js'
import { trackProgressRouter } from '../modules/track-progress/http/track-progress.routes.js'
import { healthRouter } from './health/health.routes.js'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/', parentRouter)
apiRouter.use('/students', trackProgressRouter)
apiRouter.use('/parents', preferenceRouter)
apiRouter.use('/v1', ingestionRouter)
