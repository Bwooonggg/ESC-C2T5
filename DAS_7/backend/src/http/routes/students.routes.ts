import { Router } from 'express';
import type { Deps } from '../../deps.js';
import { requireOwnStudent } from '../auth.js';
import { ok } from '../envelope.js';

/** Student-scoped reads: progress, its AI summary, and recommendations. */
export function studentsRoutes(deps: Deps): Router {
    const router = Router();

    router.get('/:studentId/track-progress', async (req, res) => {
        const { studentId } = req.params;
        await requireOwnStudent(deps.studentRepo, req.parent!, studentId);
        ok(res, await deps.insightService.trackProgress(studentId));
    });

    router.get('/:studentId/summary', async (req, res) => {
        const { studentId } = req.params;
        await requireOwnStudent(deps.studentRepo, req.parent!, studentId);
        ok(res, await deps.insightService.getSummary(studentId));
    });

    router.post('/:studentId/recommendations', async (req, res) => {
        const { studentId } = req.params;
        await requireOwnStudent(deps.studentRepo, req.parent!, studentId);
        ok(res, await deps.insightService.createRecommendation(studentId));
    });

    return router;
}
