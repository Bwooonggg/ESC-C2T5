import { Router } from 'express'
import type { GetPreferencesModel } from '../application/get-preferences.js'
import type { SavePreferencesModel } from '../application/save-preferences.js'
import { createPreferenceController } from './preference.controller.js'

export function createPreferenceRouter(
    getPreferencesModel?: GetPreferencesModel,
    savePreferencesModel?: SavePreferencesModel,
): Router {
    const router = Router()

    const controller = createPreferenceController(
        getPreferencesModel,
        savePreferencesModel,
    )
    router.get('/:parentId/preferences', controller.getPreferences)
    router.put('/:parentId/preferences', controller.savePreferences)

    return router
}

export const preferenceRouter = createPreferenceRouter()
