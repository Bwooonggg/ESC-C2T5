import type { RequestHandler } from 'express';
import type { AppConfig } from '../config.js';
import type { ParentRepo, StudentRepo } from '../deps.js';
import type { Parent } from '../types.js';
import { NotFoundError, UnauthorizedError } from '../errors.js';

/**
 * Authentication middleware factory. PHASE 1 PLACEHOLDER:
 * only supports the AUTH_DEV_SUB dev fallback; Phase 3 adds real JWT verification.
 */
export function createAuthenticate(
    deps: { parentRepo: ParentRepo; config: AppConfig },
): RequestHandler {
    return async (req, _res, next) => {
        const { config, parentRepo } = deps;
        if (!req.headers.authorization && config.authDevSub && config.nodeEnv !== 'production') {
            const parent = await parentRepo.byAuthUserId(config.authDevSub);
            if (!parent) throw new UnauthorizedError();
            req.parent = parent;
            return next();
        }
        throw new UnauthorizedError(); // Phase 3 replaces this branch with JWT verification
    };
}

/** FINAL. Unowned and nonexistent students are deliberately indistinguishable (both 404). */
export async function requireOwnStudent(
    studentRepo: StudentRepo, parent: Parent, studentId: string,
): Promise<void> {
    if (!(await studentRepo.isGuardian(parent.parentId, studentId))) {
        throw new NotFoundError('progressUnavailable');
    }
}

/** FINAL. A foreign parentId is indistinguishable from a nonexistent one (404). */
export function requireOwnParent(parent: Parent, parentId: string): void {
    if (parent.parentId !== parentId) throw new NotFoundError();
}
