import { Router } from 'express';
import type { Deps } from '../../deps.js';
import { UnavailableError } from '../../errors.js';
import { requireOwnParent } from '../auth.js';
import { ok } from '../envelope.js';

/** Parent-triggered delivery. Scheduled delivery continues to use the timer. */
export function notificationRoutes(deps: Deps): Router {
    const router = Router();

    router.post('/:parentId/notifications', async (req, res) => {
        const { parentId } = req.params;
        requireOwnParent(req.parent!, parentId);

        const outcome = await deps.notifierService.notifyParent(parentId, new Date());
        if (outcome === 'notificationFailed') {
            throw new UnavailableError('notificationFailed');
        }

        ok(res, { outcome });
    });

    return router;
}
