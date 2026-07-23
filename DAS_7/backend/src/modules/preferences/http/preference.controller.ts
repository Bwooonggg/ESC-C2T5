import type {
    NextFunction,
    Request,
    RequestHandler,
    Response,
} from 'express'
import { fail, ok } from '../../../http/responses/api-envelope.js'
import { notConfigured } from '../../../http/responses/not-configured.js'
import type { GetPreferencesModel } from '../application/get-preferences.js'
import type { SavePreferencesModel } from '../application/save-preferences.js'
import {
    parseParentId,
    parseSavePreferencesBody,
} from './preference.schemas.js'
import { toNotificationPreferenceResponse } from './preference.responses.js'

export interface PreferenceController {
    readonly getPreferences: RequestHandler
    readonly savePreferences: RequestHandler
}

export function createPreferenceController(
    getPreferencesModel?: GetPreferencesModel,
    savePreferencesModel?: SavePreferencesModel,
): PreferenceController {
    return {
        getPreferences: getPreferencesModel
            ? createGetPreferencesHandler(getPreferencesModel)
            : notConfigured,
        savePreferences: savePreferencesModel
            ? createSavePreferencesHandler(savePreferencesModel)
            : notConfigured,
    }
}

function createGetPreferencesHandler(
    model: GetPreferencesModel,
): RequestHandler {
    return async (
        request: Request,
        response: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const parentId = parseParentId(request.params)
            const preference = await model.execute(parentId)

            if (!preference) {
                fail(response, 'preferencesUnavailable', 404)
                return
            }

            ok(response, toNotificationPreferenceResponse(preference))
        } catch (error) {
            next(error)
        }
    }
}

function createSavePreferencesHandler(
    model: SavePreferencesModel,
): RequestHandler {
    return async (
        request: Request,
        response: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const parentId = parseParentId(request.params)
            const input = parseSavePreferencesBody(request.body)
            const preference = await model.execute(parentId, input)

            ok(response, toNotificationPreferenceResponse(preference))
        } catch (error) {
            next(error)
        }
    }
}
