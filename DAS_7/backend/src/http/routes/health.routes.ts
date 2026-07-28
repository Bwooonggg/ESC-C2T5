import { Router } from 'express';
import { ok } from '../envelope.js';

/** Unauthenticated liveness probe, mounted at /api/health. */
export function healthRoutes(): Router {
    const router = Router();

    router.get('/', (_req, res) => {
        ok(res, { ok: true });
    });

    return router;
}
