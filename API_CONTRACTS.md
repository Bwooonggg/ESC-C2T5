# Shared API contracts

## Browser-facing routes

All browser requests use same-origin relative URLs. The gateway and the Vite
development proxy remove the service prefix before forwarding the request.

| Service | Public prefix | Internal example |
|---|---|---|
| DAS 1 screening | `/api/screening` | `/sessions` |
| DAS 3 worksheet | `/api/worksheet` | LangGraph `/threads` and `/runs` routes |
| DAS 7 insights | `/api/insights` | `/me`, `/students/*`, `/parents/*` |

Frontend code must not hardcode backend origins or ports. The central prefix map
lives in `frontend/src/config/api.ts`.

## Authentication and authorization

The browser signs in directly through Supabase Auth. Before a protected API call,
the frontend reads the current session and sends its access token as:

```http
Authorization: Bearer <Supabase access token>
```

Traefik and development proxies must forward this header unchanged.

- DAS 7 verifies the JWT signature and issuer, resolves `sub` to a parent, and
  checks ownership of requested parent/student resources.
- DAS 1's current anonymous screening-session API remains public. A UUID identifies
  a session but is not authorization. Any future educator/result endpoint must
  verify the Supabase JWT and enforce ownership or role checks.
- DAS 3 does not yet verify JWTs. Add authentication at the LangGraph deployment
  boundary before connecting its learner-specific features to the shared frontend.

Frontend publishable keys may be present in browser code. Supabase service-role or
secret keys must only exist in backend environment files.

## Response conventions

- DAS 7 JSON endpoints use `{ "ok": true, "data": ... }` and
  `{ "ok": false, "error": "..." }`.
- DAS 1 currently returns a `ScreeningSession` directly and errors as
  `{ "error": "..." }`. Its typed client owns that decoding.
- DAS 3 retains the LangGraph SDK's native thread/run and streaming protocol.

The common contract is the gateway prefix, same-origin transport, bearer-token
header, and HTTP status semantics. Protocol-specific response bodies remain behind
service-specific frontend clients rather than being forced into one envelope.
