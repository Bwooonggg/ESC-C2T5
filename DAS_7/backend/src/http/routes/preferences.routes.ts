import { Router } from 'express';
import type { Deps } from '../../deps.js';
import { ApiError } from '../../errors.js';

/** PHASE 1 STUB — signature is final; a later phase fills in the handlers. */
export function preferencesRoutes(_deps: Deps): Router {
    const router = Router();

    router.get('/:parentId/preferences', () => {
        throw new ApiError(501, 'notImplemented');
    });

    router.put('/:parentId/preferences', () => {
        throw new ApiError(501, 'notImplemented');
    });

    return router;
}
