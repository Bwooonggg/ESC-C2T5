import { Router } from 'express'
import * as controller from '../controllers/screenerController.ts'

/** Internal routes. Public callers use the gateway prefix /api/screening. */
const router = Router()

router.get('/ping', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

router.post('/sessions', controller.createSession)
router.get('/sessions/:id', controller.getSession)
router.post('/sessions/:id/messages', controller.postMessage)
router.post('/sessions/:id/responses', controller.recordAnswer)
router.post('/sessions/:id/report', controller.finishScreener)
router.post('/sessions/:id/contact', controller.submitContact)

export default router
