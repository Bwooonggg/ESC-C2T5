import { Router } from 'express';
import type { Deps } from '../../deps.js';
import { requireOwnParent } from '../auth.js';
import { ok } from '../envelope.js';

export function preferencesRoutes(deps: Deps): Router {
    const router = Router();

    router.get('/:parentId/preferences', async (req, res) => {
        const { parentId } = req.params;
        // throws error if trying to get from another Parent's account
        requireOwnParent(req.parent!, parentId);
        ok(res, await deps.preferenceService.get(parentId));
    });

    router.put('/:parentId/preferences', async (req, res) => {
        const { parentId } = req.params;
        // throws error if trying to modify another Parent's account
        requireOwnParent(req.parent!, parentId);
        ok(res, await deps.preferenceService.save(parentId, req.body));
    });

    return router;
}
