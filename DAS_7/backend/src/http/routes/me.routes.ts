import { Router } from 'express';
import type { Deps } from '../../deps.js';
import { ApiError } from '../../errors.js';

/** PHASE 1 STUB — signature is final; a later phase fills in the handler. */
export function meRoutes(_deps: Deps): Router {
    const router = Router();

    router.get('/', () => {
        throw new ApiError(501, 'notImplemented');
    });

    return router;
}
