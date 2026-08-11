import type { RequestHandler } from 'express';
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTPayload } from 'jose';
import type { AppConfig } from '../config.js';
import type { ParentRepo, StudentRepo } from '../deps.js';
import type { Parent } from '../types.js';
import { ForbiddenError, NotFoundError, UnauthorizedError, UnavailableError } from '../errors.js';

/** `Authorization: Bearer <token>`; anything else is treated as no credentials at all. */
const BEARER = /^Bearer +(\S+)$/i;

/** Remote JWKS faults are service failures; token and claim faults remain 401. */
function isJwksInfrastructureFailure(error: unknown): boolean {
    if (!(error instanceof joseErrors.JOSEError)) return true;

    return error instanceof joseErrors.JWKSTimeout
        || error instanceof joseErrors.JWKSInvalid
        || error instanceof joseErrors.JWKInvalid
        || error instanceof joseErrors.JWKSMultipleMatchingKeys
        || error.code === 'ERR_JOSE_GENERIC';
}

/**
 * Authentication middleware factory. Tokens are Supabase Auth access tokens and are
 * verified locally — no network round trip per request — then mapped to a parent row
 * through the token's `sub` claim.
 *
 * Asymmetric signing keys are verified against the project's remote JWKS, resolved
 * once here rather than per request.
 */
export function createAuthenticate(
    deps: { parentRepo: ParentRepo; config: AppConfig },
): RequestHandler {
    const { config, parentRepo } = deps;
    const verifyOptions = { issuer: `${config.supabaseUrl.replace(/\/+$/, '')}/auth/v1` };

    // No audience check: Supabase issues `aud: 'authenticated'`, but roles are not
    // this service's concern — ownership is decided by the parent row we resolve below.
    // createRemoteJWKSet caches the key set in memory and only re-fetches on an unknown kid.
    const jwks = createRemoteJWKSet(new URL(config.supabaseJwksUrl));
    const verify = async (token: string) => (await jwtVerify(token, jwks, verifyOptions)).payload;

    return async (req, _res, next) => {
        const header = req.headers.authorization;

        const token = header?.match(BEARER)?.[1];
        if (!token) throw new UnauthorizedError();

        let payload: JWTPayload;
        try {
            payload = await verify(token);
        } catch (error) {
            if (isJwksInfrastructureFailure(error)) throw new UnavailableError('authUnavailable');
            // Bad signature, expired, wrong issuer, malformed, and unknown kid all
            // remain authentication failures. The caller learns no specific reason.
            throw new UnauthorizedError();
        }

        if (!payload.sub) throw new UnauthorizedError();

        // A valid platform user who is not a registered parent is in the wrong group.
        const parent = await parentRepo.byAuthUserId(payload.sub);
        if (!parent) throw new ForbiddenError();

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
