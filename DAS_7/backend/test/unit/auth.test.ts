import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { SignJWT } from 'jose';
import type { AppConfig } from '../../src/config.js';
import type { ParentRepo, StudentRepo } from '../../src/deps.js';
import type { Parent, Student } from '../../src/types.js';
import { NotFoundError, UnauthorizedError } from '../../src/errors.js';
import { createAuthenticate, requireOwnParent, requireOwnStudent } from '../../src/http/auth.js';

const SUPABASE_URL = 'https://test-project.supabase.co';
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const JWT_SECRET = 'super-secret-legacy-hs256-signing-key';

const PARENT_A: Parent = {
    parentId: 'parent-a',
    name: 'Ada Tan',
    email: 'ada@example.com',
    mobileNumber: '+6591234567',
    studentIds: ['student-a1'],
};
const AUTH_USER_A = 'auth-user-a';

const BASE_CONFIG: AppConfig = {
    nodeEnv: 'test',
    port: 4000,
    supabaseUrl: SUPABASE_URL,
    supabaseServiceRoleKey: 'service-role-key',
    supabaseDbSchema: 'insight',
    supabaseJwksUrl: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
    supabaseJwtSecret: null,
    authDevSub: null,
    llmProvider: 'stub',
    llmApiKey: null,
    llmModel: null,
    llmTimeoutMs: 10000,
    emailProvider: 'fake',
    brevoApiKey: null,
    emailFrom: null,
    schedulerEnabled: false,
    schedulerTickMs: 900000,
    notifyIntervalsMs: { Weekly: 604800000, Fortnightly: 1209600000, Monthly: 2592000000 },
};

function config(overrides: Partial<AppConfig> = {}): AppConfig {
    return { ...BASE_CONFIG, ...overrides };
}

/** In-file fake: maps auth user ids to parents. Never touches src/repos. */
function fakeParentRepo(byAuthUser: Record<string, Parent> = {}): ParentRepo {
    const parents = Object.values(byAuthUser);
    return {
        async byAuthUserId(authUserId) { return byAuthUser[authUserId] ?? null; },
        async byId(parentId) { return parents.find((p) => p.parentId === parentId) ?? null; },
    };
}

/** In-file fake: only the guardian pairs listed here exist. */
function fakeStudentRepo(guardianPairs: Array<[string, string]> = []): StudentRepo {
    const pairs = new Set(guardianPairs.map(([parentId, studentId]) => `${parentId}:${studentId}`));
    return {
        async byId(): Promise<Student | null> { return null; },
        async listByParent(): Promise<Student[]> { return []; },
        async isGuardian(parentId, studentId) { return pairs.has(`${parentId}:${studentId}`); },
    };
}

/** Runs the middleware against minimal fakes and reports what it did. */
async function run(handler: RequestHandler, authorization?: string) {
    const headers: Record<string, string> = {};
    if (authorization !== undefined) headers.authorization = authorization;

    const req = { headers } as unknown as Request;
    let nextCalls = 0;
    let thrown: unknown;

    try {
        await handler(req, {} as Response, (() => { nextCalls += 1; }) as NextFunction);
    } catch (err) {
        thrown = err;
    }

    return { req, nextCalls, thrown };
}

function signHs256(claims: {
    sub?: string; issuer?: string; expiresIn?: string | number; secret?: string;
}): Promise<string> {
    const token = new SignJWT({ role: 'authenticated' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer(claims.issuer ?? ISSUER)
        .setAudience('authenticated')
        .setIssuedAt()
        .setExpirationTime(claims.expiresIn ?? '1h');
    if (claims.sub !== undefined) token.setSubject(claims.sub);
    return token.sign(new TextEncoder().encode(claims.secret ?? JWT_SECRET));
}

describe('createAuthenticate — dev fallback', () => {
    it('rejects a headerless request when authDevSub is not configured', async () => {
        const authenticate = createAuthenticate({
            parentRepo: fakeParentRepo({ [AUTH_USER_A]: PARENT_A }),
            config: config(),
        });

        const { req, nextCalls, thrown } = await run(authenticate);

        expect(thrown).toBeInstanceOf(UnauthorizedError);
        expect(nextCalls).toBe(0);
        expect(req.parent).toBeUndefined();
    });

    it('refuses the fallback in production even when authDevSub is set', async () => {
        const authenticate = createAuthenticate({
            parentRepo: fakeParentRepo({ [AUTH_USER_A]: PARENT_A }),
            config: config({ authDevSub: AUTH_USER_A, nodeEnv: 'production' }),
        });

        const { req, nextCalls, thrown } = await run(authenticate);

        expect(thrown).toBeInstanceOf(UnauthorizedError);
        expect(nextCalls).toBe(0);
        expect(req.parent).toBeUndefined();
    });

    it('attaches the dev parent outside production', async () => {
        const authenticate = createAuthenticate({
            parentRepo: fakeParentRepo({ [AUTH_USER_A]: PARENT_A }),
            config: config({ authDevSub: AUTH_USER_A }),
        });

        const { req, nextCalls, thrown } = await run(authenticate);

        expect(thrown).toBeUndefined();
        expect(nextCalls).toBe(1);
        expect(req.parent).toEqual(PARENT_A);
    });

    it('rejects when authDevSub matches no parent row', async () => {
        const authenticate = createAuthenticate({
            parentRepo: fakeParentRepo(),
            config: config({ authDevSub: AUTH_USER_A }),
        });

        const { nextCalls, thrown } = await run(authenticate);

        expect(thrown).toBeInstanceOf(UnauthorizedError);
        expect(nextCalls).toBe(0);
    });
});

describe('createAuthenticate — Authorization header shape', () => {
    // A secret is configured throughout so verification stays offline.
    const authenticate = createAuthenticate({
        parentRepo: fakeParentRepo({ [AUTH_USER_A]: PARENT_A }),
        config: config({ supabaseJwtSecret: JWT_SECRET, authDevSub: AUTH_USER_A }),
    });

    const badHeaders: Array<{ name: string; header: string }> = [
        { name: 'a Basic credential', header: 'Basic xyz' },
        { name: 'a bare token with no scheme', header: 'not-a-jwt' },
        { name: 'Bearer with a non-JWT token', header: 'Bearer not-a-jwt' },
        { name: 'Bearer with nothing after it', header: 'Bearer ' },
    ];

    it.each(badHeaders)('rejects $name', async ({ header }) => {
        const { req, nextCalls, thrown } = await run(authenticate, header);

        expect(thrown).toBeInstanceOf(UnauthorizedError);
        expect(nextCalls).toBe(0);
        expect(req.parent).toBeUndefined();
    });

    it('never falls back to authDevSub once a header is present', async () => {
        // The dev fallback is headerless-only; a wrong header must not open the door.
        const { thrown } = await run(authenticate, 'Bearer not-a-jwt');

        expect(thrown).toBeInstanceOf(UnauthorizedError);
    });

    it('rejects an empty header when there is no dev fallback to fall into', async () => {
        const strict = createAuthenticate({
            parentRepo: fakeParentRepo({ [AUTH_USER_A]: PARENT_A }),
            config: config({ supabaseJwtSecret: JWT_SECRET }),
        });

        const { thrown } = await run(strict, '');

        expect(thrown).toBeInstanceOf(UnauthorizedError);
    });
});

describe('createAuthenticate — HS256 verification', () => {
    function authenticateWith(parents: Record<string, Parent>): RequestHandler {
        return createAuthenticate({
            parentRepo: fakeParentRepo(parents),
            config: config({ supabaseJwtSecret: JWT_SECRET }),
        });
    }

    it('attaches the parent behind a valid token', async () => {
        const token = await signHs256({ sub: AUTH_USER_A });

        const { req, nextCalls, thrown } = await run(
            authenticateWith({ [AUTH_USER_A]: PARENT_A }), `Bearer ${token}`,
        );

        expect(thrown).toBeUndefined();
        expect(nextCalls).toBe(1);
        expect(req.parent).toEqual(PARENT_A);
    });

    it('rejects an expired token', async () => {
        const token = await signHs256({ sub: AUTH_USER_A, expiresIn: '-1h' });

        const { req, nextCalls, thrown } = await run(
            authenticateWith({ [AUTH_USER_A]: PARENT_A }), `Bearer ${token}`,
        );

        expect(thrown).toBeInstanceOf(UnauthorizedError);
        expect(nextCalls).toBe(0);
        expect(req.parent).toBeUndefined();
    });

    it('rejects a token from another issuer', async () => {
        const token = await signHs256({
            sub: AUTH_USER_A, issuer: 'https://someone-else.supabase.co/auth/v1',
        });

        const { thrown } = await run(
            authenticateWith({ [AUTH_USER_A]: PARENT_A }), `Bearer ${token}`,
        );

        expect(thrown).toBeInstanceOf(UnauthorizedError);
    });

    it('rejects a token signed with the wrong secret', async () => {
        const token = await signHs256({ sub: AUTH_USER_A, secret: 'not-the-projects-secret' });

        const { thrown } = await run(
            authenticateWith({ [AUTH_USER_A]: PARENT_A }), `Bearer ${token}`,
        );

        expect(thrown).toBeInstanceOf(UnauthorizedError);
    });

    it('rejects a valid token with no sub claim', async () => {
        const token = await signHs256({});

        const { thrown } = await run(
            authenticateWith({ [AUTH_USER_A]: PARENT_A }), `Bearer ${token}`,
        );

        expect(thrown).toBeInstanceOf(UnauthorizedError);
    });

    it('rejects a platform user who is not a registered parent', async () => {
        const token = await signHs256({ sub: 'auth-user-with-no-parent-row' });

        const { req, nextCalls, thrown } = await run(
            authenticateWith({ [AUTH_USER_A]: PARENT_A }), `Bearer ${token}`,
        );

        expect(thrown).toBeInstanceOf(UnauthorizedError);
        expect(nextCalls).toBe(0);
        expect(req.parent).toBeUndefined();
    });

    it('reports nothing about why verification failed', async () => {
        const token = await signHs256({ sub: AUTH_USER_A, secret: 'not-the-projects-secret' });

        const { thrown } = await run(
            authenticateWith({ [AUTH_USER_A]: PARENT_A }), `Bearer ${token}`,
        );

        expect((thrown as UnauthorizedError).message).toBe('unauthorised');
        expect((thrown as UnauthorizedError).status).toBe(401);
    });
});

describe('requireOwnStudent', () => {
    it('resolves for a student the parent is guardian of', async () => {
        const repo = fakeStudentRepo([[PARENT_A.parentId, 'student-a1']]);

        await expect(requireOwnStudent(repo, PARENT_A, 'student-a1')).resolves.toBeUndefined();
    });

    it("throws progressUnavailable for another parent's student", async () => {
        const repo = fakeStudentRepo([[PARENT_A.parentId, 'student-a1']]);

        await expect(requireOwnStudent(repo, PARENT_A, 'student-b1'))
            .rejects.toThrow(new NotFoundError('progressUnavailable'));
    });

    it('throws the same error for a student that does not exist', async () => {
        const repo = fakeStudentRepo();

        // Unowned and nonexistent must be indistinguishable to the caller.
        await expect(requireOwnStudent(repo, PARENT_A, 'no-such-student'))
            .rejects.toThrow(new NotFoundError('progressUnavailable'));
    });
});

describe('requireOwnParent', () => {
    it('returns for the caller\'s own parentId', () => {
        expect(() => requireOwnParent(PARENT_A, PARENT_A.parentId)).not.toThrow();
    });

    it('throws NotFoundError for someone else\'s parentId', () => {
        expect(() => requireOwnParent(PARENT_A, 'parent-b')).toThrow(NotFoundError);
        expect(() => requireOwnParent(PARENT_A, 'parent-b')).toThrow('notFound');
    });
});
