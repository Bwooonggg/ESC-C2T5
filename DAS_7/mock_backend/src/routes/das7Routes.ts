import { Router } from 'express'
import * as parentController from '../controllers/parentController.js'
import * as preferencesController from '../controllers/preferencesController.js'
import * as trackProgressController from '../controllers/trackProgressController.js'
import { ok } from '../utils/envelope.js'

// Notify Parent is absent from this table on purpose — it is Clock-triggered.
// See controllers/notificationController.ts and utils/clock.ts.

export const das7Routes = Router()

das7Routes.get('/health', (_req, res) => ok(res, { ok: true }))

das7Routes.get('/me', parentController.getCurrentParent)

das7Routes.get('/students/:studentId/track-progress', trackProgressController.trackProgress)
das7Routes.get('/students/:studentId/summary', trackProgressController.getSummary)
das7Routes.post('/students/:studentId/recommendations', trackProgressController.requestRecommendations)

das7Routes.get('/parents/:parentId/preferences', preferencesController.getPreferences)
das7Routes.put('/parents/:parentId/preferences', preferencesController.savePreferences)
