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
Integration and end-to-end suites will use a dedicated test database once the
MySQL layer is implemented, and those suites run serially to avoid sharing
mutable database state.

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
- Existing frontend and future ingestion routes are registered, but business
  handlers currently return a JSON `501 Not implemented` envelope.
- MySQL, authentication, generator services, email delivery, and worker job
  processing are intentionally reserved for their respective implementation
  slices. Authentication routes remain unmounted until the final phase.
