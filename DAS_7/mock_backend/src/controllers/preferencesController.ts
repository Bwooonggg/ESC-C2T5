import type { Request, Response } from 'express'
import { database } from '../repositories/database.js'
import type { NotificationFrequency, NotificationPreference } from '../types/domain.js'
import { fail, ok } from '../utils/envelope.js'

// `PreferencesController` — PM2 DELTA. See plan gap 3.1.
//
// There is no NotificationPreference entity in the PM2 class diagram and no use
// case where a parent sets one. This is a new requirement beyond PM2, added
// because PS7 lists "improve parent engagement and communication" as an
// objective while Notify Parent currently gives the parent no control at all.
// It needs legitimising in the report: add the class (Parent 1 -- 1
// NotificationPreference) and either extend Notify Parent or add a small
// Set Notification Preferences use case.

const FREQUENCIES: NotificationFrequency[] = ['Weekly', 'Fortnightly', 'Monthly']

function isFrequency(value: unknown): value is NotificationFrequency {
  return typeof value === 'string' && (FREQUENCIES as string[]).includes(value)
}

// Hand-rolled rather than pulled from a validation library: it is one shape,
// and the mock backend should not grow dependencies the real one will not want.
function parsePreferences(parentId: string, body: unknown): NotificationPreference | string {
  if (typeof body !== 'object' || body === null) return 'Request body must be an object.'

  const { enabled, frequency, recipientEmail } = body as Record<string, unknown>

  if (typeof enabled !== 'boolean') return '`enabled` must be true or false.'
  if (!isFrequency(frequency)) return `\`frequency\` must be one of: ${FREQUENCIES.join(', ')}.`
  if (typeof recipientEmail !== 'string' || !recipientEmail.includes('@')) {
    return '`recipientEmail` must be a valid email address.'
  }

  return { parentId, enabled, frequency, recipientEmail }
}

// GET /api/parents/:parentId/preferences
export function getPreferences(req: Request, res: Response): void {
  const { parentId } = req.params
  const prefs = database.getPreferences(parentId!)

  if (!prefs) {
    fail(res, 'No preferences found for this parent.', 404)
    return
  }

  ok(res, prefs)
}

// PUT /api/parents/:parentId/preferences
export function savePreferences(req: Request, res: Response): void {
  const { parentId } = req.params

  if (!database.getParent(parentId!)) {
    fail(res, 'No such parent.', 404)
    return
  }

  const parsed = parsePreferences(parentId!, req.body)
  if (typeof parsed === 'string') {
    fail(res, parsed, 400)
    return
  }

  ok(res, database.savePreferences(parsed))
}
