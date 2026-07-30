# Phase 3 Handoff — Authentication & `/api/me`

**Status:** complete. `npm run typecheck` clean; `npm test` → 33 passed, 5 skipped (integration), 0 failed.

## What was built

| File | Change |
| --- | --- |
| `src/http/auth.ts` | Placeholder middleware replaced with real Supabase JWT verification. Helpers and all three export signatures unchanged. |
| `src/http/routes/me.routes.ts` | 501 stub replaced with `GET /` → `{ parent, students }`. |
| `test/helpers/test-auth.ts` | New. `signInTestUser(email, password)` → real access token + auth user id. |
| `test/unit/auth.test.ts` | New. 23 offline cases, in-file fake repos. |
| `test/integration/auth.int.test.ts` | New. 5 cases incl. both IT7A-06 halves; self-skips until the env is provisioned. |

Nothing outside this list changed, apart from ticking the Progress checklist in `PHASE_3_AUTH.md`.

## How authentication now works

`createAuthenticate({ parentRepo, config })` resolves its signing mode **once per factory call**, not per request:

- `config.supabaseJwtSecret` set → legacy symmetric **HS256** against the encoded secret.
- otherwise → asymmetric, via `createRemoteJWKSet(config.supabaseJwksUrl)`. That set caches keys in memory and only re-fetches on an unknown `kid`, so steady-state requests do no network I/O.

Both paths verify `issuer` (`${supabaseUrl}/auth/v1`). Audience is deliberately **not** checked — Supabase issues `aud: 'authenticated'`, but roles aren't this service's concern; ownership is decided by the parent row.

Request order:

1. No `Authorization` header **and** `authDevSub` set **and** `nodeEnv !== 'production'` → look up that dev parent.
2. Header missing or not `Bearer <token>` → 401.
3. Token fails verification (bad signature, expired, wrong issuer, malformed) → 401, reason never disclosed.
4. `sub` claim missing → 401.
5. `parentRepo.byAuthUserId(sub)` returns null → 401. A valid platform user who isn't a registered parent here is simply not a caller.
6. Otherwise `req.parent` is set and the request continues.

The middleware is `async` and throws; Express 5 forwards rejections to `errorHandler`, which renders `{ ok: false, error: 'unauthorised' }`.

## For other phases

- `req.parent` is guaranteed non-null in any route mounted after `createAuthenticate` in `createApp` — that is every route except `/api/health`.
- `requireOwnStudent(studentRepo, parent, studentId)` and `requireOwnParent(parent, parentId)` are unchanged and behave exactly as before. Both deliberately return 404, not 403, so "not yours" and "not there" are indistinguishable.
- Phase 7's harness can import `signInTestUser` from `test/helpers/test-auth.js` to mint `tokenA` / `tokenB`.

## Decisions worth knowing

- **Trailing slashes.** The phase doc specifies `issuer: ${config.supabaseUrl}/auth/v1`; the implementation strips trailing slashes from `supabaseUrl` first, matching what `config.ts` already does when deriving `supabaseJwksUrl`. Without this a `SUPABASE_URL` ending in `/` would silently 401 every request.
- **Empty header.** `Authorization: ""` is falsy and therefore treated as *no header*, so it takes the dev-fallback branch when `authDevSub` is set. This reads as the intent; a unit test pins the behaviour so it can't drift unnoticed.
- **Bearer parsing** is case-insensitive on the scheme and tolerates repeated spaces.
- **`/api/me` guard.** The handler throws `UnauthorizedError` if `req.parent` is unset rather than using a non-null assertion. Unreachable in the current wiring; it keeps the route safe if ever remounted outside the authenticated section.
- **JWKS is not unit tested.** Per the phase doc, that path is covered by the integration suite against real Supabase tokens rather than a mock JWKS server.

## Environment / setup still required (orchestrator)

Integration tests skip cleanly until all of this is in place.

- [ ] **Confirm the project's signing mode.** Dashboard → Settings → JWT keys. Legacy HS256 → put the secret in `SUPABASE_JWT_SECRET`. Migrated to signing keys → leave it blank so the JWKS path is used.
- [ ] **`SUPABASE_ANON_KEY` in `.env`.** `signInTestUser` needs it. This is *not* listed in the phase doc's env table — flagging it as a gap.
- [ ] **Two test users** in Supabase Auth: email + password, **email-confirmed**. Record as `TEST_USER_A_*` / `TEST_USER_B_*`.
- [ ] **`TEST_SUPABASE_REF`** — the existing guard in `test/helpers/harness.ts`; integration suites stay skipped without it.
- [ ] Parent rows whose `auth_user_id` matches each test user's id (Phase 2 / Phase 7 territory).

## Issue encountered and resolved

The working tree carried an uncommitted downgrade of `jest` (^30.2.0 → ^25.0.0) and `ts-jest` (^29.4.4 → ^29.1.2). jest@25 doesn't satisfy ts-jest's `^29.0.0` peer, so the transform failed and **no** suite could run — including the pre-existing `error-handler.test.ts`, before any Phase 3 work. Resolved on the orchestrator's instruction with `git checkout -- package.json package-lock.json && npm install`, restoring jest 30.4.2 / ts-jest 29.4.12. Both files now match HEAD; there is nothing to commit there.

## Known noise (not fixed — frozen files)

`ts-jest` prints `TS151002` on every run, asking for `isolatedModules: true` in `tsconfig.json`. Harmless, but `tsconfig.json` is a frozen contract file so it was left alone. Whoever owns the build config may want to add it, or add `151002` to `diagnostics.ignoreCodes` in `jest.config.cjs`.
