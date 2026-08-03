import type { RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { AppConfig } from '../config.js';
import type { ParentRepo, StudentRepo } from '../deps.js';
import type { Parent } from '../types.js';
import { NotFoundError, UnauthorizedError } from '../errors.js';

/** `Authorization: Bearer <token>`; anything else is treated as no credentials at all. */
const BEARER = /^Bearer +(\S+)$/i;

/**
 * Authentication middleware factory. Tokens are Supabase Auth access tokens and are
 * verified locally — no network round trip per request — then mapped to a parent row
 * through the token's `sub` claim.
 *
 * Two Supabase signing modes are supported: legacy symmetric HS256 (when
 * `supabaseJwtSecret` is set) and asymmetric signing keys verified against the
 * project's remote JWKS. Whichever applies is resolved once, here, not per request.
 */
export function createAuthenticate(
    deps: { parentRepo: ParentRepo; config: AppConfig },
): RequestHandler {
    const { config, parentRepo } = deps;
    const verifyOptions = { issuer: `${config.supabaseUrl.replace(/\/+$/, '')}/auth/v1` };

    // No audience check: Supabase issues `aud: 'authenticated'`, but roles are not
    // this service's concern — ownership is decided by the parent row we resolve below.
    let verify: (token: string) => Promise<JWTPayload>;
    if (config.supabaseJwtSecret !== null) {
        const secret = new TextEncoder().encode(config.supabaseJwtSecret);
        verify = async (token) => (await jwtVerify(token, secret, verifyOptions)).payload;
    } else {
        // createRemoteJWKSet caches the key set in memory and only re-fetches on an unknown kid.
        const jwks = createRemoteJWKSet(new URL(config.supabaseJwksUrl));
        verify = async (token) => (await jwtVerify(token, jwks, verifyOptions)).payload;
    }

    return async (req, _res, next) => {
        const header = req.headers.authorization;

        // Dev convenience: outside production, a tokenless request may act as a fixed parent.
        if (!header && config.authDevSub && config.nodeEnv !== 'production') {
            const parent = await parentRepo.byAuthUserId(config.authDevSub);
            if (!parent) throw new UnauthorizedError();
            req.parent = parent;
            return next();
        }

        const token = header?.match(BEARER)?.[1];
        if (!token) throw new UnauthorizedError();

        let payload: JWTPayload;
        try {
            payload = await verify(token);
        } catch {
            // Bad signature, expired, wrong issuer, malformed: the caller learns only
            // that it is unauthenticated, never which check failed.
            throw new UnauthorizedError();
        }

        if (!payload.sub) throw new UnauthorizedError();

        // A valid platform user who is not a registered parent here is simply not a caller.
        const parent = await parentRepo.byAuthUserId(payload.sub);
        if (!parent) throw new UnauthorizedError();

        req.parent = parent;
        next();
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
