# Authentication and authorization

This document describes how authentication and authorization work across the
integrated ESC application. It covers the current backend-mediated design and
contrasts it with direct browser-to-Supabase access.

## Terminology

- **Authentication** establishes who the caller is.
- **Role authorization** determines whether that authenticated account is a
  teacher or parent allowed to use a subsystem.
- **Resource authorization** determines which threads, students, and parent
  records that account may access.
- **JWT** is the short-lived Supabase access token presented on protected
  requests.
- **JWKS** is the public key set used to verify that Supabase signed a JWT.

## Service policy

| Service | Authentication | Role authorization | Resource authorization |
|---|---|---|---|
| DAS1 screening | None; routes are public | None | Public screening-session IDs |
| DAS3 worksheet | Supabase JWT verified by LangGraph auth | `worksheet.teachers.auth_user_id = JWT sub` | LangGraph thread owner metadata equals `JWT sub` |
| DAS7 insights | Supabase JWT verified by Express middleware | `insight.parents.auth_user_id = JWT sub` | Parent ID and guardian relationship checks |

DAS3 and DAS7 use the same Supabase Auth project. Their role profiles are
separate, and the same Auth user must not be inserted into both profile tables.

## Establishing a Supabase session

The frontend signs a user in with their email and password through
`supabase.auth.signInWithPassword()`. Supabase verifies the submitted credential
against the Auth account and, on success, creates a session containing:

- a short-lived access-token JWT; and
- a refresh token used to obtain later access tokens.

The JWT `sub` claim contains the immutable UUID of the matching `auth.users`
record. Supabase signs the JWT with the project's private signing key. A backend
can verify the signature with the corresponding public key, but possession of
that public key cannot be used to mint a valid token.

A verified JWT proves that Supabase issued the token for the stated Auth user and
that its signed claims were not changed. It proves possession of that session; it
does not independently prove the current human's real-world identity. A stolen
password, access token, refresh token, or browser session can be used to
impersonate the account.

## Separate browser sessions

The frontend creates two Supabase clients with separate browser storage keys:

- `dial-worksheet-auth` for DAS3; and
- `dial-insights-auth` for DAS7.

Both clients use the same Supabase URL and browser-safe publishable key. Separate
storage allows a teacher and a parent to remain signed in at the same time. Local
sign-out from one client does not clear the other client's session.

The relevant frontend files are:

- [`frontend/src/lib/supabaseClientFactory.ts`](../frontend/src/lib/supabaseClientFactory.ts)
- [`frontend/src/api/auth.ts`](../frontend/src/api/auth.ts)
- [`frontend/src/components/ProtectedRoute.tsx`](../frontend/src/components/ProtectedRoute.tsx)

`ProtectedRoute` improves navigation, but it is not the security boundary. A
caller can bypass frontend code, so every protected backend request is verified
again by the target backend.

## Protected request flow

For each DAS3 or DAS7 API operation:

1. The frontend reads the current access token for that service.
2. It sends `Authorization: Bearer <access-token>` to a relative `/api/*` URL.
3. The root Vite proxy removes the service prefix and forwards the request.
4. The backend validates the bearer format and verifies the JWT.
5. The backend uses the verified `sub` to find the service-specific profile.
6. The backend applies resource-ownership checks.
7. Only then does the requested operation run.

```text
Browser session
    │ Authorization: Bearer <JWT>
    ▼
Root Vite proxy
    │ strips /api/worksheet or /api/insights
    ▼
DAS3 or DAS7
    │ verify JWT using Supabase JWKS
    │ resolve sub to teacher or parent profile
    │ enforce thread or record ownership
    ▼
Protected operation
```

Authentication is therefore performed per request. The user's password is not
submitted again, and the backend does not create its own login session.

## JWT and JWKS verification

The default public key endpoint is:

```text
<SUPABASE_URL>/auth/v1/.well-known/jwks.json
```

The JWT header includes a key ID (`kid`). The verification library selects the
matching public key from the JWKS and validates the signature. Both backends also
validate the expected issuer and token expiry and require a non-empty `sub`.

The JWKS is cached in memory, so the public keys are not normally downloaded on
every request. The JWT itself is still cryptographically verified on every
protected request. A new or rotated `kid` causes the verifier to obtain updated
keys when needed.

Neither backend accepts a tokenless development bypass or the legacy shared
`SUPABASE_JWT_SECRET` flow. Both use asymmetric Supabase signing keys.

The current implementations do not configure an audience check. Role access is
instead determined by the server-side teacher or parent profile lookup after
signature, issuer, expiry, and subject validation.

## DAS3 flow

DAS3 registers a custom LangGraph `Auth` handler from
[`DAS_3/src/das_agent/auth.py`](../DAS_3/src/das_agent/auth.py).

For every request except the public `/ok` health check:

1. The handler extracts the bearer token.
2. PyJWT verifies it with the Supabase JWKS.
3. The handler queries `worksheet.teachers` using the verified `sub`.
4. A matching teacher profile becomes the LangGraph identity.
5. New threads receive `metadata.owner = sub`.
6. Search, read, update, delete, and run operations are filtered by that owner.
7. Any LangGraph resource without an explicit authorization handler is denied.

This prevents one valid teacher from accessing another teacher's threads. The
frontend creates a LangGraph client with the current worksheet token in
[`frontend/src/worksheet/client.ts`](../frontend/src/worksheet/client.ts).

## DAS7 flow

DAS7 installs `createAuthenticate()` from
[`DAS_7/src/http/auth.ts`](../DAS_7/src/http/auth.ts) after its public `/health`
route. All `/me`, `/students/*`, and `/parents/*` routes pass through this
middleware.

For every protected request:

1. The middleware requires a correctly formed bearer token.
2. `jose.jwtVerify()` verifies the token using a remote JWKS created once when
   the middleware is assembled.
3. The verified payload must contain `sub`.
4. `ParentRepo.byAuthUserId(sub)` queries `insight.parents`.
5. The resolved parent, including linked student IDs, is attached to
   `req.parent`.
6. The route applies `requireOwnParent()` or `requireOwnStudent()` when it
   accesses a parent- or student-scoped resource.

The backend queries Supabase through a server-only service-role client. That
client bypasses RLS, so the Express authentication and ownership checks are a
required security boundary, not an optional frontend convenience.

Foreign and nonexistent parent/student resources return the same `404`. This
prevents callers from using response differences to discover whether another
user's record exists.

## Error contract

| Status | Meaning |
|---|---|
| `401 Unauthorized` | JWT is missing, malformed, expired, wrongly signed, from the wrong issuer, or lacks `sub` |
| `403 Forbidden` | JWT is valid, but the account has no profile for the requested service |
| `404 Not Found` | Resource is missing or is not owned by the caller; those cases are intentionally indistinguishable |
| `500 Internal Server Error` | Unexpected backend or database failure |
| `503 Service Unavailable` | JWKS, profile lookup, or another required provider is unavailable, where explicitly mapped |

DAS7 returns errors as `{ "ok": false, "error": "..." }`; its exact error
values are documented in [`DAS_7/README.md`](../DAS_7/README.md#error-responses).
DAS3 retains LangGraph's response format.

## Database access model

The frontend uses Supabase directly only for Auth. Application data travels
through DAS1, DAS3, or DAS7.

The application tables have RLS enabled as defense in depth. Browser `anon` and
`authenticated` roles have their table privileges revoked for the service-owned
profile and response tables. Backend service-role credentials are stored only in
ignored backend `.env` files and must never be placed in frontend configuration.

The relevant migrations are:

- [`db/migrations/0004_worksheet_teachers.sql`](../db/migrations/0004_worksheet_teachers.sql)
- [`db/migrations/0005_parent_auth_user_constraint.sql`](../db/migrations/0005_parent_auth_user_constraint.sql)
- [`db/migrations/0006_public_responses.sql`](../db/migrations/0006_public_responses.sql)

The teacher and parent `auth_user_id` columns are required, unique foreign keys
to `auth.users.id` with `ON DELETE CASCADE`.

## Direct browser-to-Supabase comparison

Supabase also supports a valid architecture where the browser queries its Data
API directly. In that design, `supabase-js` sends the signed-in user's JWT on
each query, Supabase verifies it, and Postgres grants plus RLS policies authorize
the rows using helpers such as `auth.uid()`.

That is not the current ESC application-data path:

| Concern | Direct Supabase design | Current ESC design |
|---|---|---|
| Browser calls | Supabase Data API | DAS backend through Vite proxy |
| JWT verified by | Supabase | DAS3 or DAS7 |
| User authorization | Postgres grants and RLS | Backend profile and ownership checks |
| Database identity | User JWT | Server-only service role |
| Protected provider keys | Require a server/function boundary | Kept in DAS backends |

Switching back to direct application-data access would require deliberate grants
and complete user-scoped RLS policies. It is not sufficient to remove the backend
middleware because the current service-role database clients bypass RLS.

## Session and revocation limitation

Local JWT verification checks the signed token and its expiry, but it does not
contact Supabase Auth to confirm session state on each request. DAS3 and DAS7 do
not currently validate the JWT `session_id` against `auth.sessions`.

As a result, a previously issued access token may remain usable until it expires
after logout, session revocation, or deletion of the Auth user. The profile lookup
provides an additional practical restriction after profile deletion, but it is
not a general immediate-revocation mechanism. Sensitive future operations that
require immediate revocation guarantees should explicitly validate session state
or use an equivalent server-side control.

## References

- [Supabase JWTs](https://supabase.com/docs/guides/auth/jwts)
- [Supabase user sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api)
