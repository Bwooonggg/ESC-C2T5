import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { exportJWK, generateKeyPair, generateSecret, SignJWT } from 'jose';
import type { AppConfig } from '../../src/config.js';
import type { ParentRepo, StudentRepo } from '../../src/deps.js';
import type { Parent, Student } from '../../src/types.js';
import { ForbiddenError, NotFoundError, UnauthorizedError, UnavailableError } from '../../src/errors.js';
import { createAuthenticate, requireOwnParent, requireOwnStudent } from '../../src/http/auth.js';

const SUPABASE_URL = 'https://test-project.supabase.co';
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;
const JWKS_KEY_ID = 'test-signing-key';

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
    supabaseJwksUrl: JWKS_URL,
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

let signingKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let originalFetch: typeof fetch;
let requestedJwksUrls: string[];
let fetchJwks: () => Promise<globalThis.Response>;

beforeAll(async () => {
    const keyPair = await generateKeyPair('RS256');
    signingKey = keyPair.privateKey;
    const jwk = await exportJWK(keyPair.publicKey);
    originalFetch = globalThis.fetch;
    fetchJwks = async () => new globalThis.Response(JSON.stringify({
        keys: [{ ...jwk, alg: 'RS256', kid: JWKS_KEY_ID, use: 'sig' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    globalThis.fetch = async (input) => {
        requestedJwksUrls.push(String(input));
        return fetchJwks();
    };
});

afterAll(() => {
    globalThis.fetch = originalFetch;
});

beforeEach(() => {
    requestedJwksUrls = [];
});

function signRs256(
    claims: { sub?: string; issuer?: string; expiresIn?: string | number },
    key = signingKey,
    keyId = JWKS_KEY_ID,
): Promise<string> {
    const token = new SignJWT({ role: 'authenticated' })
        .setProtectedHeader({ alg: 'RS256', kid: keyId })
        .setIssuer(claims.issuer ?? ISSUER)
        .setAudience('authenticated')
        .setIssuedAt()
        .setExpirationTime(claims.expiresIn ?? '1h');
    if (claims.sub !== undefined) token.setSubject(claims.sub);
    return token.sign(key);
}

async function signHs256(claims: { sub: string }): Promise<string> {
    const token = new SignJWT({ role: 'authenticated' })
        .setProtectedHeader({ alg: 'HS256', kid: 'legacy-key' })
        .setIssuer(ISSUER)
        .setIssuedAt()
        .setExpirationTime('1h')
        .setSubject(claims.sub);
    return token.sign(await generateSecret('HS256'));
}

describe('createAuthenticate — Authorization header shape', () => {
    const authenticate = createAuthenticate({
        parentRepo: fakeParentRepo({ [AUTH_USER_A]: PARENT_A }),
        config: config(),
    });

    const badHeaders: Array<{ name: string; header?: string }> = [
        { name: 'no header' },
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
});

describe('createAuthenticate — JWKS verification', () => {
    function authenticateWith(parents: Record<string, Parent>): RequestHandler {
        return createAuthenticate({ parentRepo: fakeParentRepo(parents), config: config() });
    }

    it('attaches the parent behind a valid JWKS-signed token', async () => {
        const token = await signRs256({ sub: AUTH_USER_A });

        const { req, nextCalls, thrown } = await run(
            authenticateWith({ [AUTH_USER_A]: PARENT_A }), `Bearer ${token}`,
        );

        expect(thrown).toBeUndefined();
        expect(nextCalls).toBe(1);
        expect(req.parent).toEqual(PARENT_A);
    });

    it('requests the configured JWKS URL', async () => {
        const token = await signRs256({ sub: AUTH_USER_A });

        await run(authenticateWith({ [AUTH_USER_A]: PARENT_A }), `Bearer ${token}`);

        expect(requestedJwksUrls).toEqual([JWKS_URL]);
    });

    it.each([
        ['an expired token', { sub: AUTH_USER_A, expiresIn: '-1h' }],
        ['a token from another issuer', { sub: AUTH_USER_A, issuer: 'https://other.supabase.co/auth/v1' }],
        ['a token with no sub claim', {}],
    ])('rejects %s', async (_name, claims) => {
        const token = await signRs256(claims);

        const { thrown } = await run(
            authenticateWith({ [AUTH_USER_A]: PARENT_A }), `Bearer ${token}`,
        );

        expect(thrown).toBeInstanceOf(UnauthorizedError);
    });

    it('distinguishes an invalid token from a valid user in the wrong group', async () => {
        const wrongKey = (await generateKeyPair('RS256')).privateKey;
        const invalidToken = await signRs256({ sub: AUTH_USER_A }, wrongKey);
        const validUnmappedToken = await signRs256({ sub: 'teacher-auth-user' });
        const authenticate = authenticateWith({ [AUTH_USER_A]: PARENT_A });

        const invalid = await run(authenticate, `Bearer ${invalidToken}`);
        const wrongGroup = await run(authenticate, `Bearer ${validUnmappedToken}`);

        expect(invalid.thrown).toBeInstanceOf(UnauthorizedError);
        expect(invalid.thrown).toMatchObject({ status: 401, message: 'unauthorised' });
        expect(wrongGroup.thrown).toBeInstanceOf(ForbiddenError);
        expect(wrongGroup.thrown).toMatchObject({ status: 403, message: 'forbidden' });
    });

    it('rejects an unknown kid and legacy HS256 token as 401', async () => {
        const unknownKid = await signRs256({ sub: AUTH_USER_A }, signingKey, 'unknown-key');
        const hs256 = await signHs256({ sub: AUTH_USER_A });
        const authenticate = authenticateWith({ [AUTH_USER_A]: PARENT_A });

        const unknownKidResult = await run(authenticate, `Bearer ${unknownKid}`);
        const hs256Result = await run(authenticateWith({ [AUTH_USER_A]: PARENT_A }), `Bearer ${hs256}`);

        expect(unknownKidResult.thrown).toBeInstanceOf(UnauthorizedError);
        expect(hs256Result.thrown).toBeInstanceOf(UnauthorizedError);
    });

    it('returns generic 503 when the remote JWKS is unavailable', async () => {
        fetchJwks = async () => { throw new TypeError('network unavailable'); };
        const token = await signRs256({ sub: AUTH_USER_A });

        const { req, nextCalls, thrown } = await run(
            authenticateWith({ [AUTH_USER_A]: PARENT_A }), `Bearer ${token}`,
        );

        expect(thrown).toBeInstanceOf(UnavailableError);
        expect(thrown).toMatchObject({ status: 503, message: 'authUnavailable' });
        expect(nextCalls).toBe(0);
        expect(req.parent).toBeUndefined();
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
