# DAS 7 Backend

This directory contains the TypeScript/Express backend scaffold described in
[`docs/backend-architecture.md`](docs/backend-architecture.md).

## Development

```powershell
npm install
npm run dev
```

The API listens on `http://localhost:4000` by default. The frontend's Vite
configuration proxies `/api` to this port, so browser requests remain on the
frontend's local origin.

Useful checks:

```powershell
npm run typecheck
npm run build
npm test
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

Unit, HTTP, and contract suites must not require a running MySQL instance.
The default `npm test` command excludes the integration directory. The
integration suite runs serially against a dedicated MySQL test database and
requires `MYSQL_TEST_HOST`, `MYSQL_TEST_PORT`, `MYSQL_TEST_DATABASE`,
`MYSQL_TEST_USER`, and `MYSQL_TEST_PASSWORD`. Copy
`.env.integration.example` to `.env.integration` or export those variables
before running `npm run test:integration`.

The ordered implementation plan is recorded in [`docs/plan.md`](docs/plan.md).
Current phase status is tracked in [`docs/progress.md`](docs/progress.md).

## Configuration

Copy `.env.example` to `.env` for local development. The backend loads and
validates environment values at process startup through
`src/config/environment.ts`.

Development and test runs use safe local defaults. Production requires explicit
values for the MySQL connection, summary generator, recommendation generator,
and email provider. Authentication configuration is introduced with the final
authentication and authorization phase.

MySQL remains a transitional development dependency while the hosted Supabase
migration is completed. Supabase configuration is currently optional so the
existing backend can still start during the transition. The intended database
workflow uses the hosted development project through the Supabase CLI; this
repository does not require `supabase start`, `supabase stop`, or a local
Supabase database.

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

The migration runner reads the `MYSQL_*` values from the same environment,
resolves `db/migrations/` relative to its entrypoint, records applied
migrations in `schema_migrations`, and does not depend on a developer-specific
filesystem path:

```powershell
# Development entrypoint
npm run migrate

# Compiled/deployment entrypoint
npm run build
npm run migrate:compiled
```

The integration suite applies the same migrations to the configured test
database, verifies migration replay, checks the expected InnoDB tables and
indexes, exercises key foreign-key and value constraints, and verifies the
non-authentication repository read/write and notification-job claim paths. The
database-backed Track Progress and Recommendation API workflows are also
exercised with controlled generator services. The test database must be isolated from
development and production data; its name must identify it as a test database,
such as `das7_integration_test`.

The API and worker read the same validated configuration through separate
composition containers. The worker is disabled by default until notification
processing is implemented.

## Deployment model

The React application and API use one public domain. The public web host serves
the frontend at `/` and forwards `/api/*` to the Express process. The browser
therefore calls relative `/api` URLs on the same origin. Local development uses
the existing Vite proxy to preserve that behavior.

## Current scaffold behavior

- `GET /api/health` returns a liveness response.
- `GET /api/health/ready` reports that database readiness is not wired yet.
- `GET /api/students/:studentId/track-progress` loads progress from MySQL,
  generates and persists a summary through the configured external summary
  service, and returns the frontend-compatible progress/summary envelope.
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
  respective implementation phases. Authentication routes and authorization
  middleware remain unmounted until the final phase.
