# API contracts

## Service boundaries

The centralized frontend has one API client per service. Each client calls only its
own backend.

| Service | Browser-facing base URL | Local backend |
| --- | --- | --- |
| DAS1 screening | `/api/screening` | `http://127.0.0.1:4173` |
| DAS3 worksheet | `/api/worksheet` | `http://localhost:2024` |
| DAS7 insights | `/api/insights` | `http://localhost:4000` |

The root Vite server proxies these relative paths and removes the service prefix.
Production may use the same style of hosting rewrite or full backend URLs supplied
through:

```dotenv
VITE_DAS1_API_URL=/api/screening
VITE_DAS3_API_URL=/api/worksheet
VITE_DAS7_API_URL=/api/insights
```

Frontend components must not hardcode backend ports or import another service's API
client.

## Authentication transport

DAS1 screening routes are public. DAS3 and DAS7 requests use a Supabase access JWT:

```http
Authorization: Bearer <access-token>
```

The frontend holds two independent Supabase sessions:

- The worksheet auth client supplies only DAS3 requests.
- The insights auth client supplies only DAS7 requests.

Both clients use the same Supabase project but have different browser storage keys.
The Supabase client handles sign-in and token refresh. Each service uses local
sign-out so it does not clear the other service's session.

The backends verify the token signature, issuer, and expiry before using `sub` to
find the matching profile. DAS3 requires a teacher profile. DAS7 requires a parent
profile. A route guard may improve navigation, but backend verification is required
for every protected request.

Frontend code may contain the Supabase URL and publishable key. Service-role and
secret keys belong only in backend environment files.

## Status codes

| Status | Contract |
| --- | --- |
| `200 OK` | Request succeeded |
| `201 Created` | Resource was created |
| `400 Bad Request` | Request body or parameters are invalid |
| `401 Unauthorized` | JWT is missing, expired, malformed, or invalid |
| `403 Forbidden` | JWT is valid, but the account belongs to the wrong service group |
| `404 Not Found` | Resource is absent or is not owned by the caller |
| `500 Internal Server Error` | Unexpected server failure |
| `503 Service Unavailable` | A required provider is temporarily unavailable |

Do not reveal whether another user's parent, student, thread, worksheet, or other
record exists. Return the same `404` for a missing record and an unowned record.
Login errors must use a generic invalid-credentials message.

## Response bodies

The services do not need one artificial response envelope:

- DAS1 currently returns screening session objects directly and uses
  `{ "error": "..." }` for errors.
- DAS3 keeps the LangGraph SDK's thread, run, interrupt, and streaming formats.
- DAS7 uses `{ "ok": true, "data": ... }` for success and
  `{ "ok": false, "error": "..." }` for errors.

Each frontend API client owns the decoding for its backend. The shared contract is
limited to service routing, JWT transport, HTTP status meaning, and anti-enumeration
behavior.

## CORS and proxies

No CORS configuration is required when the browser calls relative `/api/*` paths
through the Vite development proxy or an equivalent production rewrite.

If production uses separate backend URLs, each backend must allow the exact
frontend origin and the headers it needs, including `Authorization` and
`Content-Type`. Do not use a wildcard origin on protected DAS3 or DAS7 APIs.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the complete system design.
