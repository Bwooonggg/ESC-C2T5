# DAS 7 Backend Architecture

**Status:** Approved target architecture; revision R1-R6B implemented.
Platform-auth integration is deferred to R6C.

**Scope:** DAS 7 Insight backend only

**Related documents:** [`overall-architecture.md`](overall-architecture.md), [`revision-plan.md`](revision-plan.md), and [`plan.md`](plan.md)

## 1. Purpose

This document defines the target architecture for the DAS 7 backend after the
platform pivot to Supabase.

DAS 7 is one independently deployable subsystem in a larger platform. It owns
the Insight backend and its data, but it does not own the shared frontend,
canonical user identity, login flows, or the other DAS subsystems.

The backend remains a TypeScript and Express.js modular monolith with two
runtime processes:

1. An HTTP API.
2. A scheduled notification worker.

The implementation uses ports and adapters so Supabase, the LLM provider, and
the email provider remain replaceable infrastructure rather than domain
dependencies.

## 2. Fixed Architectural Decisions

- Use TypeScript, Express.js, ESM/NodeNext, Jest, `ts-jest`, and Supertest.
- Use four spaces for indentation.
- Use Supabase PostgreSQL through the Supabase Data API.
- Use `@supabase/supabase-js` at the infrastructure boundary.
- Use a Supabase-hosted development project during implementation. Do not run
  a local Supabase database or use Supabase as local storage.
- Link the production Supabase project only after implementation and the
  dedicated testing phase are complete.
- Store DAS 7 tables in a custom `insight` PostgreSQL schema.
- Use Supabase Auth tokens issued by the platform.
- Verify bearer tokens at the DAS 7 service boundary, but do not implement
  login, signup, password, token issuance, token refresh, or logout.
- Leave role assignment, custom authorization claims, and RLS policy design to
  the platform/authentication team.
- Keep the frontend outside this repository and outside the DAS 7 plan.
- Accept normalized data through versioned ingestion APIs instead of querying
  or calling other DAS subsystems.
- Treat parent and student identity as platform-owned. DAS 7 stores only the
  local projections needed by Insight workflows.
- Use a provider-neutral LLM boundary for summaries and recommendations.
- Run the API and notification worker as separate processes from one codebase.
- Expose the API through Traefik at `/api/insights/*`.
- Do not configure CORS because browser traffic uses the same public origin.
- Do not migrate existing MySQL development data.
- Preserve the existing test baseline, but defer new or rewritten permanent
  test files until the dedicated testing phase after feature implementation.

The implementation checkpoint includes the hosted-development Supabase
CLI configuration, the committed PostgreSQL migration chain for the `insight`
schema, its generated TypeScript database types, the verified RLS/grant
boundary, Supabase clients, mappers, repositories, RPC wrappers, and a bounded
readiness probe. Identity ownership, gateway-aligned routing, and the
worker-authorized hosted-development smoke validation are complete.
Platform-auth integration, workflow composition, provider integration, and
MySQL removal remain in the later revision phases described by
[`revision-plan.md`](revision-plan.md).

## 3. System Context and Ownership

```text
Browser / other platform clients
              |
              | HTTPS /api/insights/*
              v
         Traefik gateway
              |
              | strips /api/insights
              v
       DAS 7 Express API
          |           |
          |           +--------> Online LLM API
          |
          +--------------------> Supabase Data API
                                      |
                                      v
                             PostgreSQL insight schema

       DAS 7 notification worker
          |           |          |
          |           |          +--> Email provider
          |           +-------------> Online LLM API
          +-------------------------> Supabase Data API

Browser login and session refresh ----------> Supabase Auth
Platform/authentication team ---------------> claims and RLS policy contract
Other DAS subsystems -----------------------> versioned DAS 7 ingestion API
```

### 3.1 DAS 7 owns

- Progress-record ingestion and corrections.
- Local parent and student projections required by DAS 7.
- Parent-student guardian relationships used by DAS 7.
- Progress retrieval and progress-version consistency.
- Summary generation and persistence.
- Recommendation generation and persistence.
- Notification preferences.
- Durable notification jobs and email delivery history.
- DAS 7 API contracts, domain rules, database schema, and operational behavior.
- Technical verification of incoming Supabase JWTs.

### 3.2 DAS 7 does not own

- Frontend routes, components, state, or Supabase browser configuration.
- Login, signup, logout, password storage, password hashing, or account
  verification.
- Session creation, refresh-token handling, or token revocation.
- Canonical parent, student, staff, or system identity.
- Assignment of platform roles or generation of custom access-token claims.
- Final authorization policy design.
- Data or tables belonging to DAS 1, DAS 3, or another subsystem.

### 3.3 Required external contracts

The platform/authentication team must provide:

- The Supabase project and Auth configuration.
- The access-token claim contract.
- A stable mapping from the JWT `sub` claim to the platform parent identity.
- Trusted staff/system role claims when ingestion clients need them.
- RLS policies for the `insight` schema.
- Representative identities or tokens for authorization contract testing.

The orchestration team must provide:

- Traefik routing for `/api/insights`.
- Prefix stripping before requests reach Express.
- Separate API and worker services.
- API-only public exposure.
- Environment and secret injection.

## 4. Runtime Architecture

### 4.1 API process

The API process:

1. Receives a service-local Express route such as
   `/students/:studentId/track-progress`.
2. Assigns a request/correlation ID.
3. Verifies the Supabase bearer token for protected routes.
4. Creates an immutable request principal from trusted claims.
5. Creates a request-scoped Supabase client carrying the caller's access token.
6. Validates request parameters and bodies.
7. Calls an application use case.
8. Uses repository and provider ports.
9. Returns the standard DAS 7 response envelope.

The API process uses a Supabase publishable key plus the caller's JWT. It must
not receive the worker's secret key.

This is the target behavior after the platform-auth contract is available.
During revision R6A/R6B, the API only adopts the service-local route shape and
validates hosted-development Supabase infrastructure; it does not add a
development-only authentication bypass.

### 4.2 Worker process

The worker represents the `Clock` actor in the Notify Parent sequence diagram.
It:

1. Finds due notification work.
2. Atomically claims jobs through a PostgreSQL RPC function.
3. Loads the applicable progress snapshot.
4. Generates and persists a fresh summary.
5. Creates an email-notification record.
6. Sends through the email-provider port.
7. Records success, failure, retry, and lease state.

The worker has no public HTTP trigger. It uses a server-only Supabase secret
key because it performs system work without an end-user request. That secret
must never be exposed to the browser, the API runtime, fixtures, or logs.

### 4.3 Supabase

Supabase provides:

- Supabase Auth.
- The Data API used by `supabase-js`.
- A hosted PostgreSQL database for development and, later, production.

DAS 7 uses an imperative migration workflow under `supabase/migrations/` and
commits `supabase/config.toml`. The CLI is linked to the hosted development
project while implementation is in progress. It previews and applies committed
migrations to that project and generates TypeScript types from the linked
schema.

The project does not use `supabase start`, `supabase stop`, a local Supabase
container, or local database resets. Development records are created only in
the hosted development project and are not committed as seed or fixture files.
The hosted development project is explicitly designated for DAS7. If it was
previously used by another project or subsystem, inspect and reconcile its
migration history before the first DAS7 migration is pushed; do not silently
adopt unrelated migrations. Hosted smoke checks use unique run identifiers and
selective cleanup. Database migrations are durable remote changes, so a
correction uses a reviewed forward migration; there is no automatic rollback
assumption. The production project remains unlinked until the final production
handoff.

### 4.4 LLM provider

The LLM provider is external. The selected vendor is a composition-time
decision and must not affect controllers, application use cases, or domain
entities.

Summary and recommendation generation remain distinct application operations,
even when both use the same underlying LLM client.

### 4.5 Email provider

The email provider is external and replaceable. Provider-specific request,
authentication, error, and retry details remain inside its infrastructure
adapter.

## 5. Layering and Dependency Rules

```text
HTTP / worker entrypoints
          |
          v
application use cases
          |
          v
domain entities and value objects
          ^
          |
application ports
          ^
          |
Supabase, LLM, email, and clock adapters
```

### 5.1 Domain layer

Contains entities, value objects, invariants, and domain errors. It must not
import Express, Supabase, provider SDKs, environment variables, or database row
types.

The target domain retains:

- `Parent`
- `Student`
- `ProgressRecord`
- `Summary`
- `Recommendation`
- `NotificationPreference`
- `EmailNotification`

`Parent` no longer inherits from a credential-owning `User`. Account type,
password hash, verification state, and local session data are not part of the
DAS 7 domain.

### 5.2 Application layer

Contains the use cases represented by the supplied sequence diagrams:

- Track child progress.
- Request or obtain a summary.
- Request recommendations.
- Read and update notification preferences.
- Ingest and correct platform data.
- Schedule and deliver notifications.

Application code depends on repository and provider interfaces rather than
concrete Supabase, LLM, or email implementations.

### 5.3 HTTP layer

Contains:

- Express routers.
- Controllers.
- Request schemas.
- Response mapping.
- Bearer-token verification integration.
- Request-principal creation.
- Error mapping and global middleware.

It does not contain SQL, Supabase query construction, LLM prompts, or email
provider requests.

### 5.4 Infrastructure layer

Contains:

- Supabase client factories.
- Supabase row schemas and mappers.
- Repository implementations.
- PostgreSQL RPC adapters.
- LLM client and provider adapter.
- Summary and recommendation prompt adapters.
- Email provider adapter.
- System clock implementation.

Provider-specific values must not escape this layer.

### 5.5 Composition layer

Creates separate dependency graphs for:

- The public API.
- The internal worker.
- Tests using fakes.

Only composition may select concrete repository or provider implementations.

## 6. Routing

### 6.1 Public and internal paths

Traefik owns the public service prefix:

```text
Public request:
GET /api/insights/students/student-1/track-progress

After Traefik prefix stripping:
GET /students/student-1/track-progress
```

Express therefore mounts service-local routes at the root. It must not add a
second `/api` prefix.

### 6.2 Public contract

The target public routes are:

| Public route | Service-local route | Purpose |
| --- | --- | --- |
| `GET /api/insights/health` | `GET /health` | Liveness |
| `GET /api/insights/health/ready` | `GET /health/ready` | Dependency readiness |
| `GET /api/insights/me` | `GET /me` | Current parent projection and students |
| `GET /api/insights/students/:studentId/track-progress` | `GET /students/:studentId/track-progress` | Progress and generated summary |
| `GET /api/insights/students/:studentId/summary` | `GET /students/:studentId/summary` | Generated summary |
| `POST /api/insights/students/:studentId/recommendations` | `POST /students/:studentId/recommendations` | Generated recommendation |
| `GET /api/insights/parents/:parentId/preferences` | `GET /parents/:parentId/preferences` | Read preferences |
| `PUT /api/insights/parents/:parentId/preferences` | `PUT /parents/:parentId/preferences` | Update preferences |
| `/api/insights/v1/*` | `/v1/*` | Versioned data ingestion |

Health endpoints are public. In the target integration, functional routes
require a valid bearer token and row authorization is enforced by the
platform-supplied RLS contract. That token/RLS integration is deferred until
R6C; R6A/R6B do not weaken the boundary with a temporary bypass.

### 6.3 Response envelope

Success:

```json
{
    "ok": true,
    "data": {}
}
```

Failure:

```json
{
    "ok": false,
    "error": "Public error message"
}
```

Existing DAS 7 response data shapes remain stable during the Supabase revision.

### 6.4 Middleware order

1. Request ID.
2. Security headers and body limits.
3. Structured request logging with redaction.
4. Bearer-token verification for protected routes.
5. Request-principal construction.
6. Request validation.
7. Controller.
8. Not-found handler.
9. Global error handler.

There are no DAS 7 login or authorization-role routers.

## 7. Identity and Authorization Boundary

### 7.1 Request principal

DAS 7 consumes an immutable principal containing only trusted token values:

- `subject`: Supabase JWT `sub`.
- `sessionId`: the token session ID when supplied.
- `role`: a platform-owned custom/app metadata claim when supplied.
- `requestId`: the DAS 7 correlation ID.

Never use `user_metadata` for an authorization decision because users can edit
it. Authorization claims must come from platform-controlled claims such as
`app_metadata`.

### 7.2 Token verification

Use `supabase.auth.getClaims()` for Supabase-issued access tokens. Do not
implement JWT cryptography manually.

Token verification is a technical service-boundary integration. It does not
make DAS 7 responsible for Auth flows or authorization policy ownership.

### 7.3 Request-scoped database client

Protected API requests use a request-scoped Supabase client configured with:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- An `accessToken` callback returning the incoming verified token

The client factory selects the `insight` schema through the SDK database
configuration; repositories then use ordinary `.from(...)` calls. Supabase
evaluates RLS using the same end-user identity.

### 7.4 System client

The notification worker uses a separate client configured with:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

The system client is not injected into HTTP controllers or request-scoped
repositories.

### 7.5 RLS ownership

DAS 7 migrations:

- Create and own the `insight` schema and tables.
- Enable RLS on every Data API table.
- Declare the minimum schema, table, sequence, and function grants required by
  each PostgreSQL role.
- Avoid permissive catch-all policies.

The platform/authentication team:

- Supplies the claim model.
- Defines and approves the RLS predicates.
- Owns role and guardian authorization rules.
- Supplies contract-test identities.

Until those policies exist, RLS should deny protected user access by default.

## 8. Data Architecture

### 8.1 Schema

All DAS 7 tables live in the custom `insight` schema.

| Table | Purpose |
| --- | --- |
| `parent_profiles` | Local projection of a canonical parent and its Auth user ID |
| `student_profiles` | Local projection of a canonical student |
| `parent_students` | Guardian relationship used by DAS 7 |
| `progress_records` | Student progress observations and source provenance |
| `summaries` | Generated summaries tied to a progress version |
| `recommendations` | Generated recommendations tied to a basis summary |
| `notification_preferences` | Parent schedule and recipient settings |
| `email_notifications` | Email delivery history with one attached summary |
| `notification_jobs` | Durable schedules, leases, attempts, and retry state |
| `idempotency_records` | Safe replay of ingestion mutations |
| `audit_events` | Append-only mutation audit trail |

There is no DAS 7 users, passwords, verification-codes, or sessions table.

### 8.2 Diagram alignment

- A parent is guardian of one or more students as an application invariant.
- A student has zero or more progress records.
- A student may be summarized by zero or more summaries.
- A summary is based on a specific progress snapshot/version.
- A recommendation references both the advised student and its basis summary.
- An email notification belongs to a parent and attaches exactly one summary.

Supporting job, preference, idempotency, and audit records do not change these
core relationships.

### 8.3 Identity projections

Parent and student projections are not canonical identity stores. They contain
only fields DAS 7 needs to present or process insights.

The parent projection records:

- Canonical platform parent ID.
- Supabase Auth user ID used to relate `auth.uid()` to the parent.
- Display fields required by DAS 7, if any.

The student projection records:

- Canonical platform student ID.
- Name, date of birth, and band level required by the DAS 7 domain.
- Current progress-version marker.

Notification recipient email remains in notification preferences because it is
a DAS 7 delivery setting, not a password or authentication credential.

### 8.4 Provenance and idempotency

Every externally ingested progress record includes:

- Source subsystem/client identifier.
- Source record identifier.
- Source event or observation time.
- Ingestion time.
- Auditable actor subject.

Mutating ingestion requests require a scoped idempotency key. Retrying a
completed request returns the stored outcome without duplicating domain data.

### 8.5 Transactions through RPC

The Data API does not expose a client-managed transaction spanning multiple
requests. Operations that must be all-or-nothing use narrowly scoped PostgreSQL
functions called with `rpc()`.

Required atomic operations include:

- Insert or correct progress, advance the progress version, write the audit
  event, and complete the idempotency record.
- Claim notification jobs with a lease.
- Persist linked notification/job state where partial completion would be
  invalid.

Prefer `SECURITY INVOKER`. Do not use `SECURITY DEFINER` to bypass a permission
or RLS problem. Function execution grants must be explicit.

### 8.6 Data API exposure

The `insight` schema must be included in the project's exposed schemas.
Migrations must explicitly grant the required access because table exposure and
RLS are separate controls and new Supabase defaults do not guarantee implicit
grants.

## 9. Summary and Recommendation Generation

### 9.1 Port hierarchy

```text
TrackProgressModel --------> SummaryGeneratorPort
RecommendationModel -------> RecommendationGeneratorPort
                                      |
                                      v
                         provider-neutral LLM client
                                      |
                                      v
                             selected online LLM API
```

`SummaryGeneratorPort` and `RecommendationGeneratorPort` remain the application
contracts. They do not build on each other.

Their infrastructure adapters may share:

- `LlmClientPort`
- Authentication and HTTP transport
- Timeout handling
- Provider error classification
- Structured-output parsing
- Invocation metadata

### 9.2 Structured output

Each operation owns its prompt and Zod response schema. Generated output is
accepted only after runtime validation.

Persist generation metadata sufficient for support and reproducibility:

- Provider.
- Model.
- Prompt version.
- Provider request ID when available.
- Generation timestamp.

Do not persist API keys or unnecessary raw provider payloads.

### 9.3 Privacy

Send only progress and summary data necessary for the requested operation.
Avoid sending parent contact details, authentication claims, or unrelated
student identity fields. Do not log raw prompts or generated educational
content by default.

### 9.4 Configuration

The target provider-neutral configuration is:

- `LLM_PROVIDER`
- `LLM_API_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`
- `LLM_TIMEOUT_MS`

Separate summary and recommendation service URLs are removed.

## 10. Notification Architecture

Notification scheduling is database-backed rather than an in-memory timer.

Each due parent-student schedule creates or reuses one durable job. Jobs contain
a stable scheduled time, lease owner, lease expiry, attempt count, retry time,
and terminal outcome.

The worker:

- Claims jobs atomically.
- Keeps LLM and email network calls outside database transactions.
- Revalidates the progress version before persisting a generated summary.
- Uses capped retry/backoff for transient provider failures.
- Does not retry permanent validation or recipient failures indefinitely.
- Uses idempotent state transitions to reduce duplicate delivery after crashes.

A parent with multiple students receives one email per student, matching the
Notify Parent sequence diagram.

## 11. Target Project Structure

```text
backend/
|-- package.json
|-- package-lock.json
|-- tsconfig.json
|-- tsconfig.build.json
|-- tsconfig.test.json
|-- jest.config.cjs
|-- .env.example
|-- .gitignore
|-- README.md
|-- Dockerfile
|
|-- contracts/
|   |-- frontend-api.openapi.yaml
|   |-- platform-auth.contract.md
|   |-- ingestion-api.contract.md
|   |-- summary-generator.contract.md
|   |-- recommendation-generator.contract.md
|   `-- email-provider.contract.md
|
|-- docs/
|   |-- overall-architecture.md
|   |-- backend-architecture.md
|   |-- database-schema.md
|   |-- revision-plan.md
|   |-- plan.md
|   `-- progress.md
|
|-- supabase/
|   |-- config.toml
|   `-- migrations/
|
|-- src/
|   |-- entrypoints/
|   |   |-- api.ts
|   |   `-- worker.ts
|   |
|   |-- app/
|   |   |-- create-api-app.ts
|   |   |-- create-worker.ts
|   |   |-- api-container.ts
|   |   `-- worker-container.ts
|   |
|   |-- config/
|   |   |-- environment.ts
|   |   |-- supabase.config.ts
|   |   |-- llm.config.ts
|   |   |-- email.config.ts
|   |   `-- notification.config.ts
|   |
|   |-- domain/
|   |   |-- entities/
|   |   |-- value-objects/
|   |   `-- errors/
|   |
|   |-- http/
|   |   |-- api.router.ts
|   |   |-- health/
|   |   |-- middleware/
|   |   |-- principal/
|   |   `-- responses/
|   |
|   |-- modules/
|   |   |-- parents/
|   |   |-- track-progress/
|   |   |-- preferences/
|   |   |-- ingestion/
|   |   `-- notifications/
|   |
|   |-- infrastructure/
|   |   |-- supabase/
|   |   |   |-- clients/
|   |   |   |-- generated/
|   |   |   |-- mappers/
|   |   |   |-- repositories/
|   |   |   |-- rpc/
|   |   |   |-- errors.ts
|   |   |   |-- readiness.ts
|   |   |   `-- index.ts
|   |   |-- llm/
|   |   |-- email/
|   |   `-- time/
|   |
|   `-- shared/
|       |-- readiness.ts
|       |-- ids/
|       |-- logging/
|       `-- validation/
|
`-- test/
    |-- unit/
    |-- http/
    |-- integration/supabase/
    |-- integration/providers/
    |-- contract/
    |-- e2e/
    |-- fakes/
    `-- fixtures/
```

### 11.1 Top-level directories

| Directory | Responsibility |
| --- | --- |
| `contracts/` | Stable interfaces consumed by the frontend, platform teams, ingestion clients, and external providers. These files describe promises between systems rather than implementation details. |
| `docs/` | Architecture decisions, schema explanations, implementation order, revision steps, and progress records for developers. |
| `supabase/` | Database source of truth: CLI project configuration and ordered PostgreSQL migrations, functions, grants, and RLS enablement for the linked hosted project. It contains no database files or committed test data. |
| `src/` | Production TypeScript for the API, worker, domain, use cases, and infrastructure adapters. |
| `test/` | Jest unit, HTTP, Supabase integration, provider integration, contract, and end-to-end tests plus their fakes and fixtures. |

The root configuration files define package installation, TypeScript
compilation, Jest execution, environment examples, container packaging, and
repository ignore rules.

The `test/` tree shows the final structure after the dedicated testing phase.
Existing baseline tests remain in place, but missing Supabase/provider test
directories and files are not created during implementation merely to match
the diagram.

### 11.2 `src/` directories

| Directory | Responsibility |
| --- | --- |
| `entrypoints/` | Minimal process starters. `api.ts` starts Express and `worker.ts` starts scheduled notification processing. Entrypoints load configuration, assemble the process, start it, and handle shutdown; they contain no business logic. |
| `app/` | Composition roots. App factories create Express or the worker loop, while containers connect application ports to concrete Supabase, LLM, email, and clock adapters. |
| `config/` | The only production area that reads environment variables. It validates raw values and returns typed API, Supabase, LLM, email, and notification settings. |
| `domain/` | Pure DAS 7 entities, value objects, invariants, and business errors. It has no Express, Supabase, SQL, provider SDK, or environment dependency. |
| `http/` | HTTP behavior shared across features, including the combined router, health routes, global middleware, verified request-principal handling, response envelopes, and error mapping. Its `principal/` boundary contains framework-neutral claims, principal, and verifier types; the Supabase-backed verifier is deferred to R6C. |
| `modules/` | Feature-oriented application code for parents, progress tracking, preferences, ingestion, and notifications. Modules coordinate domain objects through ports without knowing the concrete infrastructure. |
| `infrastructure/` | Technical implementations of application ports: Supabase clients and repositories, PostgreSQL RPC wrappers, LLM adapters, email adapters, and the real system clock. |
| `infrastructure/supabase/clients/` | Typed `supabase-js` factories. The request factory carries a verified caller token; the worker factory is the only secret-key construction path. |
| `infrastructure/supabase/generated/` | CLI-generated `Database` types for the exposed `insight` schema. Regenerate them from the linked hosted project; do not hand-edit them. |
| `infrastructure/supabase/mappers/` | Runtime row schemas, PostgreSQL date/JSON conversions, row-to-domain mappers, and domain-to-insert/update mappers. Invalid rows stop here. |
| `infrastructure/supabase/repositories/` | Concrete implementations of the feature-owned repository ports. They own Data API queries, deterministic ordering, and Supabase error translation. |
| `infrastructure/supabase/rpc/` | Thin wrappers over reviewed PostgreSQL functions for progress writes and notification-job lease transitions. These preserve database-side atomicity. |
| `infrastructure/supabase/readiness.ts` | Bounded metadata-only reachability probe used through API dependency injection; it never returns protected rows. |
| `app/worker-container.ts` `persistence` | Worker-only repository graph built from the secret-key client. The API container has no equivalent property. |
| `shared/` | Small technical contracts and utilities genuinely reused across multiple areas, such as the readiness capability, identifier helpers, structured logging primitives, and generic validation helpers. It is not a miscellaneous business-logic folder. |

### 11.3 Module convention

An HTTP-backed feature normally follows this internal shape:

```text
modules/<feature>/
|-- http/          # Feature router, controller, request schema, and response map
|-- application/   # Use cases and workflow coordination
`-- ports/         # Repository and provider capabilities required by the use case
```

The notification module normally has no public `http/` directory because its
workflow begins with the worker clock rather than an HTTP request.

Repository interfaces live with the application capability that requires them.
Concrete Supabase repository classes live under
`infrastructure/supabase/repositories/`. This keeps Supabase query types out of
the feature modules.

### 11.4 Important directory boundaries

- `supabase/` defines the database itself; `src/infrastructure/supabase/`
  contains TypeScript that communicates with that database.
- `domain/` defines business state and rules; `modules/` coordinates those
  rules into complete use cases.
- `entrypoints/` start processes; `app/` assembles their dependency graphs.
- The top-level `http/` directory contains cross-cutting HTTP behavior; a
  module's `http/` directory contains only that feature's routes and
  controllers.
- `contracts/` records externally visible agreements; `docs/` explains internal
  decisions and plans.
- Generated Supabase database types stay under
  `infrastructure/supabase/generated/` and must not become domain entities.
- Provider-specific LLM and email details stay in `infrastructure/`; application
  modules depend only on their provider-neutral ports.

There is no DAS 7 authentication module or MySQL infrastructure in the target
structure.

## 12. Configuration Boundary

### 12.1 API environment

- `NODE_ENV`
- `HOST`
- `PORT`
- `LOG_LEVEL`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SCHEMA`
- LLM settings when API-triggered generation is enabled

### 12.2 Worker environment

- Shared non-secret runtime settings.
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SCHEMA`
- LLM settings.
- Email-provider settings.
- Notification schedule, lease, retry, and polling settings.

Production containers listen on port `8000`. Local tooling may forward another
host port, but application code reads only the validated `PORT` setting.

All package versions are pinned and the package lock is committed. Private
environment files, Supabase temporary state, logs, coverage, dependencies, and
build output remain ignored.

### 12.3 Supabase environment workflow

During implementation:

- The CLI is linked only to the Supabase-hosted development project.
- API and worker environment variables point only to that development project.
- Schema changes are stored as committed migrations.
- Every remote push is previewed before it is applied.
- Remote reset commands are not part of the normal workflow.
- Production URLs, keys, project references, and database credentials are not
  used.

After implementation and the dedicated testing phase:

- Preview the complete migration history against the production project.
- Link or deploy to production through an explicitly reviewed final step.
- Apply the same committed migrations without development records or test
  fixtures.
- Replace development environment values with production values through the
  deployment secret store.

## 13. Testing Strategy

Use Jest throughout, but create or substantially rewrite permanent test files
only during the dedicated testing phase after all planned implementation work
is complete.

Existing test files remain available as the pre-revision behavioral baseline.
During implementation, run any existing tests that remain applicable, plus
typechecking, builds, migration previews, and narrowly scoped hosted-development
smoke checks. Record future cases in the testing backlog instead of creating
new `.test.ts` files in each implementation phase.

The dedicated testing phase will organize:

- `test/unit`: domain and application behavior using explicit fakes.
- `test/http`: service-local Express routing and response contracts using
  Supertest.
- `test/integration/supabase`: migrations, repositories, RPC functions,
  idempotency, and job claiming against the hosted development project.
- `test/integration/providers`: controlled LLM and email provider behavior.
- `test/contract`: gateway paths, token claims, ingestion DTOs, and external
  provider shapes.
- `test/e2e`: complete API and worker workflows.

Hosted Supabase integration tests must never target production. They use unique
run identifiers, create only isolated development records, run serially when
they share state, and clean up only the records they created. They must not
reset or wipe the linked hosted project.

Authorization contract tests are a production gate, but the platform/auth team
owns the final claims and policy implementation.

## 14. Operational Requirements

- Liveness does not depend on external providers.
- Readiness verifies the required Supabase dependency and configuration.
- API and worker shut down gracefully.
- Logs include correlation IDs and redact tokens, keys, email content, prompts,
  and generated student content.
- External calls use bounded timeouts and classified failures.
- Jobs and ingestion writes are idempotent.
- No database or provider secret is returned to clients.
- No direct connection to another subsystem's tables exists.
- There is no public notification-trigger endpoint.

## 15. Migration Boundary

The current MySQL implementation is a development baseline, not the target
architecture.

During the revision:

- Preserve reusable domain, application, HTTP, and Jest behavior.
- Replace MySQL adapters, migrations, environment settings, and integration
  boundaries with Supabase equivalents.
- Remove locally owned credential and session concepts.
- Change internal Express routing from `/api/*` to service-local paths.
- Refactor the two generator-service clients into one provider-neutral LLM
  boundary.
- Validate implementation through the hosted development project and retain a
  complete backlog for the dedicated permanent-test phase.

No runtime dual-write, data-copy, or MySQL rollback path is required because
there is no production MySQL data to preserve.

The exact execution order and completion gates are recorded in
[`revision-plan.md`](revision-plan.md). The remaining feature plan in
[`plan.md`](plan.md) stays paused until the revision is complete.

## 16. Reference Guidance

- Supabase JWTs and `getClaims()`:
  <https://supabase.com/docs/guides/auth/jwts>
- Custom Data API schemas:
  <https://supabase.com/docs/guides/api/using-custom-schemas>
- Securing the Data API and RLS:
  <https://supabase.com/docs/guides/api/securing-your-api>
- Row Level Security:
  <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Linked-project CLI workflow:
  <https://supabase.com/docs/guides/local-development/cli-workflows>
- Data API grant-default change:
  <https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically>
