# Phase 3 — Authentication (Supabase JWT) & /api/me

> **Wave 2 · runs in parallel with Phases 2, 4, 5, 6 · depends only on Phase 1.**
> You are replacing the placeholder authentication middleware with real Supabase JWT verification, and implementing the `GET /api/me` route. You also write the auth integration tests (they self-skip until Wave 3, when a human has provisioned the test environment).

## Context

The platform uses Supabase Auth: the browser signs in with supabase-js and sends `Authorization: Bearer <access token>` on every API call. This backend verifies tokens **locally** (no network call per request) and maps the token's `sub` claim to a parent row. Two flavors of Supabase token signing exist:

- **Asymmetric (preferred, modern projects):** RS256/ES256, verified against the project's public **JWKS** at `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`.
- **Legacy symmetric:** HS256 with the project's shared JWT secret. Some Supabase projects still use this until migrated (Dashboard → Settings → JWT keys).

You must support both: if `config.supabaseJwtSecret` is set, verify HS256 with that secret; otherwise verify via a cached remote JWKS. A human confirms which one the team's project uses (orchestrator's job — you implement both paths regardless).

## Files you own

```
backend/src/http/auth.ts                     # REWRITE the middleware; keep helpers + all export signatures
backend/src/http/routes/me.routes.ts         # replace the 501 stub
backend/test/helpers/test-auth.ts
backend/test/unit/auth.test.ts
backend/test/integration/auth.int.test.ts
```

**Touch nothing else.** Dependencies you need (`jose`, `@supabase/supabase-js`, `supertest`) are already in `package.json` — do not edit it.

## Contracts (already frozen in Phase 1 files — import, never edit)

From `src/deps.ts`: `ParentRepo { byAuthUserId, byId }`, `StudentRepo { listByParent, ... }`, `Deps`.
From `src/errors.ts`: `UnauthorizedError` (401 `unauthorised`), `NotFoundError`.
From `src/http/envelope.ts`: `ok(res, data)`.
From `src/config.ts` (`AppConfig`): `supabaseUrl`, `supabaseJwksUrl`, `supabaseJwtSecret: string | null`, `authDevSub: string | null`, `nodeEnv`.
`src/types.ts` augments `Express.Request` with `parent?: Parent` — set it, don't re-declare it.

**Export signatures of `src/http/auth.ts` must remain exactly:**

```ts
export function createAuthenticate(
    deps: { parentRepo: ParentRepo; config: AppConfig },
): RequestHandler;
export async function requireOwnStudent(
    studentRepo: StudentRepo, parent: Parent, studentId: string,
): Promise<void>;
export function requireOwnParent(parent: Parent, parentId: string): void;
```

`requireOwnStudent` / `requireOwnParent` are already final — keep their bodies as-is (other phases' routes call them).

## Progress

Tick each box (`[ ]` → `[x]`) in this file as you complete the step. Do not change any other text in this document.

- [x] Step 1 — rewrite `createAuthenticate` (JWT verification, both signing modes)
- [x] Step 2 — `/api/me` route
- [x] Step 3 — `test/helpers/test-auth.ts`
- [x] Step 4 — auth unit tests
- [x] Step 5 — auth integration tests (compile + self-skip)
- [x] Done criteria verified (typecheck + tests green, export signatures unchanged)

## Step 1 — rewrite `createAuthenticate`

Behavior, in order:

1. **Dev fallback (keep from placeholder):** no `Authorization` header AND `config.authDevSub` set AND `config.nodeEnv !== 'production'` → look up `parentRepo.byAuthUserId(config.authDevSub)`; found → attach `req.parent`, `next()`; not found → `UnauthorizedError`.
2. Header missing or not `Bearer <token>` → throw `UnauthorizedError`.
3. Verify with `jose`:
   - Build the verifier **once per factory call** (closure state, not per request):
     - HS256 path: `const key = new TextEncoder().encode(config.supabaseJwtSecret)` and `jwtVerify(token, key, opts)`.
     - JWKS path: `const jwks = createRemoteJWKSet(new URL(config.supabaseJwksUrl))` and `jwtVerify(token, jwks, opts)` — `createRemoteJWKSet` caches keys in memory and only re-fetches on unknown `kid`.
   - `opts = { issuer: \`${config.supabaseUrl}/auth/v1\` }`. Do not require an audience (Supabase uses `aud: 'authenticated'`, but roles are not this service's concern).
   - Any verification error (bad signature, expired, wrong issuer, malformed) → `UnauthorizedError`. Never leak the underlying reason to the client.
4. `payload.sub` missing → `UnauthorizedError`.
5. `parentRepo.byAuthUserId(payload.sub)` → null → `UnauthorizedError` (a valid platform user who is not a registered parent of this service). Found → `req.parent = parent; next()`.

The middleware is `async`; Express 5 forwards thrown/rejected errors to the error middleware — do not try/catch around `next()`.

## Step 2 — `src/http/routes/me.routes.ts`

Replace the stub, keeping `export function meRoutes(deps: Deps): Router`:

- `GET /` → the middleware has set `req.parent`; respond
  `ok(res, { parent: req.parent, students: await deps.studentRepo.listByParent(req.parent.parentId) })`.
- Response shape is the frontend contract: `{ parent: Parent, students: Student[] }`.

## Step 3 — `test/helpers/test-auth.ts`

Helper for all integration suites (yours and Phase 7's harness):

```ts
export interface TestUserSession { accessToken: string; authUserId: string; }
/** Signs in a pre-created Supabase Auth user with the anon key; returns real token + user id. */
export async function signInTestUser(email: string, password: string): Promise<TestUserSession>;
```

Implementation: `createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false } })` → `auth.signInWithPassword({ email, password })` → throw a descriptive error on failure, else return `{ accessToken: data.session.access_token, authUserId: data.user.id }`.

## Step 4 — `test/unit/auth.test.ts` (offline)

Test `createAuthenticate` with an in-file fake `ParentRepo` (a plain object; do not import anything from `src/repos/`) and hand-built `AppConfig` literals. Run the middleware directly against minimal `req`/`res`/`next` fakes, or via a small supertest app with an error handler. Cases:

1. No header, no `authDevSub` → 401.
2. No header, `authDevSub` set, `nodeEnv: 'production'` → 401 (fence works).
3. No header, `authDevSub` set, dev, parent found → `req.parent` attached.
4. `Authorization: Basic xyz` / `Bearer not-a-jwt` → 401.
5. HS256 path: sign a token yourself with `jose`'s `SignJWT` using a test secret + issuer `${supabaseUrl}/auth/v1`, config with the same `supabaseJwtSecret` → parent attached; expired token (`exp` in the past) → 401; wrong issuer → 401; valid token whose `sub` has no parent row → 401.
6. `requireOwnStudent` (fake `StudentRepo`): guardian → resolves; not guardian → throws `NotFoundError` with message `progressUnavailable`.
7. `requireOwnParent`: match → returns; mismatch → throws `NotFoundError`.

(The JWKS path is covered by the integration suite with real Supabase tokens — do not attempt to unit test it with a mock JWKS server.)

## Step 5 — `test/integration/auth.int.test.ts`

Use the frozen harness API from `test/helpers/harness.ts` (Phase 1 placeholder; implemented in Phase 7 — your suite must compile now and run later):

```ts
import { createHarness, describeIntegration, type TestHarness } from '../helpers/harness.js';

describeIntegration('auth integration (IT7A-06)', () => {
    let h: TestHarness;
    beforeAll(async () => { h = await createHarness(); });
    afterAll(async () => { await h?.cleanup(); });
    ...
});
```

Cases (supertest against `h.app`):

1. `GET /api/me` with no token → 401 `{ ok: false, error: 'unauthorised' }`.
2. `GET /api/me` with `Bearer garbage` → 401.
3. `GET /api/me` with `h.tokenA` → 200; `data.parent.parentId === h.parentA.parentId`; `data.students` contains `studentA1` and `studentA2`.
4. **IT7A-06 (authn):** `GET /api/students/{h.studentA1.studentId}/track-progress` with no token → 401.
5. **IT7A-06 (authz):** same route for `h.studentB1.studentId` with `h.tokenA` (parent A requesting parent B's student) → **404** `progressUnavailable`, and the response is byte-identical in shape to requesting a random nonexistent UUID (assert both, compare bodies).

## Done criteria

- `npm run typecheck` clean; `npm test` green — auth unit suite passes; integration suite **skips** (prints as skipped) when env is unconfigured.
- Export signatures of `auth.ts` unchanged (compiler + existing app.ts prove it).
- No file outside your ownership list changed.

## Human intervention this phase depends on (orchestrator's job, before Wave 3)

- Confirm the Supabase project's signing mode: if legacy HS256, put the JWT secret in `SUPABASE_JWT_SECRET`; if migrated to signing keys, leave it blank (JWKS path).
- Create two test users in Supabase Auth (email+password, email-confirmed) and record credentials in `.env` as `TEST_USER_A_*` / `TEST_USER_B_*`.
