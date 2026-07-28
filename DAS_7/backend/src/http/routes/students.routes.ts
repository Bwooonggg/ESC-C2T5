import { Router } from 'express';
import type { Deps } from '../../deps.js';
import { ApiError } from '../../errors.js';

/** PHASE 1 STUB — signature is final; a later phase fills in the handlers. */
export function studentsRoutes(_deps: Deps): Router {
    const router = Router();

    router.get('/:studentId/track-progress', () => {
        throw new ApiError(501, 'notImplemented');
    });

    router.get('/:studentId/summary', () => {
        throw new ApiError(501, 'notImplemented');
    });

    router.post('/:studentId/recommendations', () => {
        throw new ApiError(501, 'notImplemented');
    });

    return router;
}
