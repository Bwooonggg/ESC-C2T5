import { Router } from 'express';
import type { Deps } from '../../deps.js';
import { UnauthorizedError } from '../../errors.js';
import { ok } from '../envelope.js';

/** The signed-in parent plus their students — the dashboard's bootstrap call. */
export function meRoutes(deps: Deps): Router {
    const router = Router();

    router.get('/', async (req, res) => {
        // createAuthenticate always sets this; the guard keeps the route honest if
        // it is ever mounted somewhere unauthenticated.
        const parent = req.parent;
        if (!parent) throw new UnauthorizedError();

        ok(res, {
            parent,
            students: await deps.studentRepo.listByParent(parent.parentId),
        });
    });

    return router;
}
