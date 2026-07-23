# DAS 7 Backend

This directory contains the TypeScript/Express backend scaffold described in
[`docs/backend-architecture.md`](docs/backend-architecture.md).

## Development

```powershell
npm install
npm run dev
```

The API listens on `http://localhost:4000` by default. The final deployment
uses service-local routes behind Traefik's `/api/insights` prefix; the current
baseline still exposes its historical `/api` mount until revision R6 completes.

Useful checks:

```powershell
npm run typecheck
npm run build
npm run test:http -- --runInBand
```

## Testing

The backend uses Jest with `ts-jest` for TypeScript tests and Supertest for
HTTP tests. Production code remains ESM/NodeNext; the test-only TypeScript
configuration compiles modules as CommonJS so Jest can resolve the `.js`
suffixes used by production imports.

```powershell
npm test
npm run test:watch
npm run test:coverage
npm run test:unit
npm run test:http
npm run test:integration
npm run test:contract
npm run test:e2e
```

The existing MySQL suites are a historical baseline and are being replaced by
hosted-Supabase verification. New Supabase repository, RPC, provider, and
end-to-end test files are intentionally deferred to the dedicated testing
phase; the implementation phases run only applicable existing tests.
The full `npm test` command may therefore stop at the four deferred identity
and MySQL suites until the dedicated testing phase updates those historical
fixtures.

The ordered implementation plan is recorded in [`docs/plan.md`](docs/plan.md).
Current phase status is tracked in [`docs/progress.md`](docs/progress.md).

## Configuration

Copy `.env.example` to `.env` for local development. The backend loads and
validates environment values at process startup through
`src/config/environment.ts`.

Development and test runs use safe defaults. The current transitional
composition still accepts MySQL settings, while the target runtime uses
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SCHEMA` for API
requests and a worker-only `SUPABASE_SECRET_KEY`. DAS7 does not implement
login, signup, password security, session management, or token issuance; those
remain platform/Auth responsibilities.

MySQL remains a transitional development dependency while the hosted Supabase
workflow is composed into the existing feature models. Supabase configuration
is currently optional so the historical baseline can still start during the
transition. The intended database workflow uses the hosted development project
through the Supabase CLI; this repository does not require `supabase start`,
`supabase stop`, or a local Supabase database.

## Hosted Supabase development

Install dependencies, authenticate the CLI, and link only the dedicated
development project:

```powershell
npm install
npx supabase login
npx supabase link --project-ref <development-project-ref>
```

Review pending migrations before applying them:

```powershell
npm run supabase:db:push:dry-run
npm run supabase:migrations
```

The migration push and generated-type commands operate on the linked hosted
development project. Do not link this checkout to production until the final
production handoff phase.

The legacy MySQL migration runner still reads the `MYSQL_*` values from the
same environment and is retained only until revision R9. The current database
source of truth is the hosted Supabase migration chain under `supabase/`:

```powershell
# Legacy transitional runner
npm run migrate

# Compiled/deployment entrypoint
npm run build
npm run migrate:compiled
```

Do not use the legacy MySQL integration workflow as evidence for the Supabase
target. Hosted Supabase smoke and integration checks will use unique development
records and will be added during the dedicated testing phase.

The API and worker read the same validated configuration through separate
composition containers. The worker is disabled by default until notification
processing is implemented.

## Deployment model

The React application and API use one public domain. The public web host serves
the frontend at `/` and Traefik forwards `/api/insights/*` to the service after
stripping that prefix. No CORS configuration is required for the browser.

## Current scaffold behavior

The following `/api` paths describe the historical baseline while R6 changes
the service-local mount and R7 composes Supabase repositories into the feature
models:

- `GET /api/health` returns a liveness response.
- `GET /api/health/ready` reports that the transitional database readiness
  dependency is not configured unless a probe is injected.
- The historical workflow routes currently load persistence through MySQL;
  their Supabase repository equivalents and bounded readiness probe are now
  implemented under `src/infrastructure/supabase/` and are composed in later
  revision phases.
- `GET /api/students/:studentId/summary` runs the same summary workflow and
  returns only the summary object in the standard envelope.
- `POST /api/students/:studentId/recommendations` loads the latest persisted
  summary, generates a recommendation through the configured external service,
  persists its summary basis, and returns the frontend-compatible response.
- `GET /api/parents/:parentId/preferences` reads the persisted notification
  preference, while `PUT /api/parents/:parentId/preferences` validates,
  normalizes, persists, and returns the updated preference.
- Overlapping summary requests for the same student progress version share one
  in-flight generation operation.
- Existing frontend and future ingestion routes are registered, but business
  handlers currently return a JSON `501 Not implemented` envelope.
- Ingestion, email-delivery, and worker-job workflows remain reserved for their
  respective implementation phases. JWT verification and gateway-aligned
  routing are next; DAS7 will not mount login or signup routes.
