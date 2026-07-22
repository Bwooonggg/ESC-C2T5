# DAS 7 Backend Architecture and Project Structure

**Status:** Approved architecture reference  
**Scope:** DAS 7 TypeScript backend, MySQL persistence, external generation services, and scheduled email notifications

## 1. Purpose

This document records the agreed backend architecture for DAS 7. It is intended to guide implementation and keep the real backend compatible with:

- The current React frontend.
- The DAS 7 class diagram.
- The Track Child's Progress sequence diagram.
- The Notify Parent sequence diagram.
- Future staff and system data-entry clients.

The implementation will use raw Express and TypeScript with `mysql2/promise` and plain SQL migrations. It will not use Prisma or another ORM.

## 2. Architectural Summary

The backend is a modular monolith: one codebase with two independently runnable processes.

1. **API process**
   - Receives HTTP requests from the frontend and future data-entry clients.
   - Authenticates and authorizes users.
   - Validates requests.
   - Reads and writes MySQL through repositories.
   - Calls summary and recommendation generators through adapters.
   - Returns the frontend's existing JSON envelope.

2. **Worker process**
   - Implements the `Clock` actor from the Notify Parent sequence diagram.
   - Finds due notification work in MySQL.
   - Generates a fresh student summary.
   - Sends email through an email-service adapter.
   - Records success, failure, and retry state.

Both processes share domain entities, application workflows, repository interfaces, MySQL implementations, external-service adapters, configuration, and observability.

```text
Browser -> single public domain
                    |
                    v
          same-origin web host
             |             |
             v             v
       React assets     /api -> Express routers
                                  |
                                  v
                       middleware -> controllers -> application models/use cases
                                                       |                 |
                                                       v                 v
                                                MySQL repositories   generator adapters
                                                                         |
                                                                         v
                                                              external generator services

Worker / Clock -> NotificationController -> NotifierModel
                                               |       |
                                               v       v
                                       summary adapter email adapter
                                               |       |
                                               v       v
                                      SummaryGenerator EmailProvider
```

### 2.1 Same-origin deployment

The React application and public API share one scheme, hostname, and port. The
public web host serves the frontend for `/` and forwards `/api/*` to the Express
API process. Browser requests therefore remain same-origin and the backend does
not expose cross-origin browser access or maintain an origin allowlist.

Local development preserves the same browser-facing model: Vite serves the
frontend and proxies `/api/*` to the local Express process. Calls to summary,
recommendation, and email providers are server-to-server and are unaffected by
the browser deployment model.

## 3. Diagram Alignment

The supplied UML diagrams are the primary source of truth for domain ownership and use-case ordering.

### 3.1 Class diagram mapping

| Diagram element | Backend representation |
|---|---|
| `User` | Domain entity and `users` table. Holds identity, contact information, credential hash, account type, and verification state. |
| `Parent` | Domain entity specializing `User`; represented by a `parents` row referencing a `users` row. |
| `Student` | Domain entity and `students` table. The persistence-facing `current_progress_version` snapshot marker is operational metadata and is not a new UML relationship. |
| Guardian association | `parent_students` many-to-many join table. The class diagram's logical `1..*` minimum for both parents and students is enforced by the application workflow. |
| `ProgressRecord` | Domain entity and `progress_records` table. |
| `Summary` | Domain entity and `summaries` table. Belongs to a student and records its source progress version. |
| `Recommendation` | Domain entity and `recommendations` table. References both the advised student and basis summary. |
| `EmailNotification` | Domain entity and `email_notifications` table. Belongs to a parent and attaches exactly one summary. |

Additional supporting entities are permitted where required by the frontend or operational needs:

- `NotificationPreference`
- Authentication sessions and verification codes (final authentication phase)
- Durable notification jobs
- Audit events
- Idempotency records for ingestion mutations

These additions must not replace or reorder the interactions in the supplied diagrams.

### 3.2 Track Child's Progress flow

The backend follows this sequence:

1. `TrackProgressUI` sends a request.
2. `TrackProgressController` resolves the authenticated parent and verifies the guardian relationship.
3. `TrackProgressController` calls `TrackProgressModel`.
4. `TrackProgressModel` obtains the student's progress from MySQL.
5. If progress is available, the model asks `GeneratorAdapter` for a summary.
6. `GeneratorAdapter` calls `SummaryGeneratorService`.
7. The returned summary is validated and persisted.
8. Progress records and the summary are returned to the frontend.
9. If the parent explicitly requests recommendations, the model loads the latest summary and calls `RecommendationGeneratorService` through the adapter.
10. If progress cannot be fetched, the backend returns `progressUnavailable` in the existing error envelope.

The frontend currently issues overlapping summary and track-progress requests. Both requests invoke the same summary-generation application operation. The adapter may coalesce concurrent requests or reuse a result for the same student progress version, preventing duplicate external calls while preserving the diagram's logical interaction. This optimization must not make `(student, source progress version)` unique: a scheduled notification may intentionally create a fresh summary snapshot from unchanged progress.

The application reads the student's progress records together with its current
progress-version marker. It carries that marker into the generated `Summary`
and verifies the marker has not changed before persisting the result. If a
progress mutation wins the race while the external generator is running, the
stale result is discarded or regenerated for the new version.

### 3.3 Notify Parent flow

The backend follows this sequence:

1. The worker's clock determines that a notification is due.
2. The clock calls `NotificationController` for one student.
3. `NotificationController` calls `NotifierModel`.
4. `NotifierModel` loads that student's progress records.
5. `NotifierModel` calls `GeneratorServiceAdapter`.
6. `GeneratorServiceAdapter` calls `SummaryGeneratorService` and returns a fresh summary.
7. The summary is persisted and attached to a new `EmailNotification`.
8. `NotifierModel` calls `EmailServiceAdapter` with the summary and recipient.
9. `EmailServiceAdapter` calls `EmailProvider`.
10. Success is recorded as `notificationSent`; failure is recorded as `notificationFailed` and may be retried.

There is no public notification-trigger endpoint. Notifications are clock-triggered. A parent with multiple children receives one email per child, and each email attaches one summary.

## 4. Routing System

The application must explicitly register routes. Controllers do not choose their own URLs.

```text
Frontend request
GET /api/students/s1/track-progress
              |
              v
Same-origin web host or development proxy
              |
              v
Express application mounted at /api
              |
              v
api.router.ts
              |
              v
track-progress.routes.ts
              |
              v
authentication -> authorization -> validation
              |
              v
TrackProgressController -> TrackProgressModel
```

### 4.1 Router composition

`create-api-app.ts` creates Express, installs global middleware, mounts `api.router.ts` under `/api`, and installs the final error handler.

`api.router.ts` combines feature routers:

| Mount point | Router | Responsibility |
|---|---|---|
| `/health` | `health.routes.ts` | Liveness and readiness. |
| `/auth` (deferred) | `auth.routes.ts` | Reserved for login, verification, and logout during the final authentication phase. |
| `/` | `parent.routes.ts` | Current-parent route such as `/me`. |
| `/students` | `track-progress.routes.ts` | Progress, summary, and recommendation routes. |
| `/parents` | `preference.routes.ts` | Notification preferences. |
| `/v1` | `ingestion.routes.ts` | Staff/system data-entry operations. |

The notifications module deliberately has no router because the Notify Parent use case begins with `Clock.timerExpired()`, not an HTTP request.

### 4.2 Middleware order

Requests pass through middleware in this order:

1. Request/correlation ID.
2. Security headers and body-size limits.
3. Structured request logging with sensitive-field redaction.
4. Authentication.
5. Role and student-access authorization.
6. Parameter, query, and body validation.
7. Route controller.
8. Not-found handler for unmatched routes.
9. Global error handler.

Authentication must occur before authorization. The global error handler must be installed last.

In the current implementation, the authentication router and authentication/
authorization middleware are intentionally unmounted. They are introduced in
the final authentication integration phase.

## 5. Public API Contract

The current frontend contract remains unchanged.

### 5.1 Response envelope

Success:

```json
{ "ok": true, "data": {} }
```

Failure:

```json
{ "ok": false, "error": "Public error message" }
```

### 5.2 Existing frontend routes

| Route | Purpose |
|---|---|
| `GET /api/health` | Compatibility health check. |
| `GET /api/health/ready` | Confirms that the API can reach MySQL. |
| `GET /api/me` | Returns the authenticated parent and guarded students. |
| `GET /api/students/:studentId/track-progress` | Returns progress records and a summary. |
| `GET /api/students/:studentId/summary` | Implements `Parent.requestSummary(child)`. |
| `POST /api/students/:studentId/recommendations` | Generates recommendations from the latest summary. |
| `GET /api/parents/:parentId/preferences` | Reads notification preferences. |
| `PUT /api/parents/:parentId/preferences` | Updates enabled state, frequency, and recipient email. |

Parents may access only students linked to them through the guardian association. A parent may update only their own preferences.

### 5.3 Future data-entry routes

Staff and trusted-system accounts may use versioned routes such as:

- `POST /api/v1/parents`
- `POST /api/v1/students`
- `PUT /api/v1/parents/:parentId/students/:studentId`
- `POST /api/v1/students/:studentId/progress-records`
- `PATCH /api/v1/students/:studentId/progress-records/:recordId`

Progress writes persist or correct `ProgressRecord` data and update the student's `current_progress_version` in the same transaction. They do not generate summaries. Summary generation remains part of Track Progress, Request Summary, and Notify Parent.

Mutating requests require validation, staff/system authorization, provenance, audit recording, and an idempotency key.

## 6. Proposed Project Structure

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
|-- docker-compose.yml
|
|-- contracts/
|   |-- frontend-api.openapi.yaml
|   |-- summary-generator.contract.md
|   |-- recommendation-generator.contract.md
|   `-- email-provider.contract.md
|
|-- db/
|   |-- migrations/
|   |   |-- 0001_create_users_and_parents.sql
|   |   |-- 0002_create_students_and_guardians.sql
|   |   |-- 0003_create_progress_records.sql
|   |   |-- 0004_create_summaries.sql
|   |   |-- 0005_create_recommendations.sql
|   |   |-- 0006_create_notification_preferences.sql
|   |   |-- 0007_create_email_notifications.sql
|   |   |-- 0008_create_notification_jobs.sql
|   |   |-- 0009_create_audit_events.sql
|   |   |-- 0010_create_idempotency_records.sql
|   |   `-- 0011_add_query_indexes.sql
|   `-- seeds/
|       |-- skill-areas.sql
|       `-- development-data.sql
|
|-- src/
|   |-- entrypoints/
|   |   |-- api.ts
|   |   |-- worker.ts
|   |   |-- migrate.ts
|   |   `-- seed.ts
|   |
|   |-- app/
|   |   |-- create-api-app.ts
|   |   |-- create-worker.ts
|   |   |-- api-container.ts
|   |   `-- worker-container.ts
|   |
|   |-- config/
|   |   |-- environment.ts
|   |   |-- database.config.ts
|   |   |-- generator.config.ts
|   |   |-- email.config.ts
|   |   `-- notification.config.ts
|   |
|   |-- domain/
|   |   |-- entities/
|   |   |   |-- user.ts
|   |   |   |-- parent.ts
|   |   |   |-- student.ts
|   |   |   |-- progress-record.ts
|   |   |   |-- summary.ts
|   |   |   |-- recommendation.ts
|   |   |   |-- email-notification.ts
|   |   |   `-- notification-preference.ts
|   |   |-- value-objects/
|   |   |   |-- account-type.ts
|   |   |   |-- skill-area.ts
|   |   |   |-- notification-frequency.ts
|   |   |   `-- email-address.ts
|   |   `-- errors/
|   |       |-- domain.error.ts
|   |       |-- progress-unavailable.error.ts
|   |       |-- summary-unavailable.error.ts
|   |       `-- authorization.error.ts
|   |
|   |-- http/
|   |   |-- api.router.ts
|   |   |-- health/
|   |   |   |-- health.routes.ts
|   |   |   `-- health.controller.ts
|   |   |-- middleware/
|   |   |   |-- request-id.middleware.ts
|   |   |   |-- authenticate.middleware.ts
|   |   |   |-- authorize-role.middleware.ts
|   |   |   |-- authorize-student.middleware.ts
|   |   |   |-- validate.middleware.ts
|   |   |   |-- rate-limit.middleware.ts
|   |   |   |-- not-found.middleware.ts
|   |   |   `-- error-handler.middleware.ts
|   |   `-- responses/
|   |       |-- api-envelope.ts
|   |       `-- error-mapper.ts
|   |
|   |-- modules/
|   |   |-- auth/
|   |   |   |-- http/
|   |   |   |   |-- auth.routes.ts
|   |   |   |   |-- auth.controller.ts
|   |   |   |   `-- auth.schemas.ts
|   |   |   |-- application/
|   |   |   |   |-- login-user.ts
|   |   |   |   |-- logout-user.ts
|   |   |   |   `-- verify-user.ts
|   |   |   `-- ports/
|   |   |       |-- user.repository.ts
|   |   |       |-- session.repository.ts
|   |   |       |-- password-hasher.ts
|   |   |       `-- token-service.ts
|   |   |
|   |   |-- parents/
|   |   |   |-- http/
|   |   |   |   |-- parent.routes.ts
|   |   |   |   `-- parent.controller.ts
|   |   |   |-- application/
|   |   |   |   `-- get-current-parent.ts
|   |   |   `-- ports/
|   |   |       `-- parent.repository.ts
|   |   |
|   |   |-- track-progress/
|   |   |   |-- http/
|   |   |   |   |-- track-progress.routes.ts
|   |   |   |   |-- track-progress.controller.ts
|   |   |   |   `-- track-progress.schemas.ts
|   |   |   |-- application/
|   |   |   |   `-- track-progress.model.ts
|   |   |   `-- ports/
|   |   |       |-- student.repository.ts
|   |   |       |-- progress-record.repository.ts
|   |   |       |-- summary.repository.ts
|   |   |       |-- recommendation.repository.ts
|   |   |       |-- summary-generator.ts
|   |   |       `-- recommendation-generator.ts
|   |   |
|   |   |-- preferences/
|   |   |   |-- http/
|   |   |   |   |-- preference.routes.ts
|   |   |   |   |-- preference.controller.ts
|   |   |   |   `-- preference.schemas.ts
|   |   |   |-- application/
|   |   |   |   |-- get-preferences.ts
|   |   |   |   `-- save-preferences.ts
|   |   |   `-- ports/
|   |   |       `-- notification-preference.repository.ts
|   |   |
|   |   |-- ingestion/
|   |   |   |-- http/
|   |   |   |   |-- ingestion.routes.ts
|   |   |   |   |-- ingestion.controller.ts
|   |   |   |   `-- ingestion.schemas.ts
|   |   |   |-- application/
|   |   |   |   |-- create-parent.ts
|   |   |   |   |-- create-student.ts
|   |   |   |   |-- assign-guardian.ts
|   |   |   |   |-- add-progress-records.ts
|   |   |   |   `-- correct-progress-record.ts
|   |   |   `-- ports/
|   |   |       `-- audit.repository.ts
|   |   |
|   |   `-- notifications/
|   |       |-- application/
|   |       |   |-- notification.controller.ts
|   |       |   |-- notifier.model.ts
|   |       |   |-- find-due-notifications.ts
|   |       |   `-- retry-failed-notification.ts
|   |       `-- ports/
|   |           |-- email-notification.repository.ts
|   |           |-- notification-job.repository.ts
|   |           |-- email-delivery.ts
|   |           `-- clock.ts
|   |
|   |-- adapters/
|   |   |-- generators/
|   |   |   |-- generator.adapter.ts
|   |   |   |-- generator-service.adapter.ts
|   |   |   |-- summary-generator.client.ts
|   |   |   |-- recommendation-generator.client.ts
|   |   |   `-- generator-response.schemas.ts
|   |   `-- email/
|   |       |-- email-service.adapter.ts
|   |       |-- email-provider.client.ts
|   |       `-- email-provider.schemas.ts
|   |
|   |-- infrastructure/
|   |   |-- mysql/
|   |   |   |-- pool.ts
|   |   |   |-- transaction-manager.ts
|   |   |   |-- migration-runner.ts
|   |   |   |-- row-mappers/
|   |   |   `-- repositories/
|   |   |       |-- mysql-user.repository.ts
|   |   |       |-- mysql-session.repository.ts
|   |   |       |-- mysql-parent.repository.ts
|   |   |       |-- mysql-student.repository.ts
|   |   |       |-- mysql-progress-record.repository.ts
|   |   |       |-- mysql-summary.repository.ts
|   |   |       |-- mysql-recommendation.repository.ts
|   |   |       |-- mysql-preference.repository.ts
|   |   |       |-- mysql-email-notification.repository.ts
|   |   |       |-- mysql-notification-job.repository.ts
|   |   |       `-- mysql-audit.repository.ts
|   |   |-- jobs/
|   |   |   |-- job-runner.ts
|   |   |   |-- job-claimer.ts
|   |   |   |-- job-lease.ts
|   |   |   `-- retry-policy.ts
|   |   |-- scheduling/
|   |   |   |-- system-clock.ts
|   |   |   `-- notification-schedule.ts
|   |   |-- security/
|   |   |   |-- password-hasher.ts
|   |   |   `-- token-service.ts
|   |   `-- observability/
|   |       |-- logger.ts
|   |       |-- metrics.ts
|   |       `-- redaction.ts
|   |
|   |-- shared/
|   |   |-- identifiers.ts
|   |   |-- date-time.ts
|   |   |-- idempotency.ts
|   |   `-- result.ts
|   |
|   `-- types/
|       `-- express.d.ts
|
`-- test/
    |-- unit/
    |   |-- domain/
    |   |-- track-progress/
    |   |-- notifications/
    |   |-- preferences/
    |   `-- ingestion/
    |-- http/
    |   |-- health.test.ts
    |   |-- middleware/
    |   `-- routes/
    |-- integration/
    |   |-- mysql/
    |   |-- generator-adapters/
    |   `-- email-adapter/
    |-- contract/
    |   |-- frontend-api/
    |   `-- external-services/
    |-- e2e/
    |   |-- track-progress.e2e.test.ts
    |   |-- recommendations.e2e.test.ts
    |   |-- preferences.e2e.test.ts
    |   |-- ingestion.e2e.test.ts
    |   `-- notify-parent.e2e.test.ts
    `-- fixtures/
        |-- parents.ts
        |-- students.ts
        `-- progress-records.ts
```

## 7. Directory Responsibilities

### `entrypoints/`

Contains process startup and graceful shutdown only. Entrypoints do not contain routes, SQL, or business rules.

### `app/`

Constructs the application and manually injects dependencies. The containers connect interfaces such as `ProgressRecordRepository` to implementations such as `MySqlProgressRecordRepository`.

`api-container.ts` and `worker-container.ts` are separate composition roots.
They receive the same validated `AppConfig` shape while keeping API and worker
dependencies independently constructible.

### `config/`

Reads and validates environment configuration once during startup. Required configuration includes MySQL connection details, external-service endpoints and credentials, email-provider settings, timeouts, and notification schedules.

`environment.ts` loads `.env` with `dotenv` and validates values with `zod`.
Development and test environments receive local defaults; production rejects
missing MySQL, generator, and email-provider settings. Authentication secrets,
session settings, and related route configuration are introduced in the final
authentication phase. Public host routing is deployment configuration, not an
application origin setting.
Application code receives the resulting typed configuration through its
composition container and must not read `process.env` directly.

### `domain/`

Represents the class diagram in transport- and database-independent TypeScript. Domain code must not import Express, MySQL2, or HTTP clients.

### `http/`

Contains application-wide routing, middleware, health checks, response envelopes, and error mapping. Feature-specific routes and controllers remain in their respective modules.

### `modules/`

Groups behavior by feature:

- `auth`: login, logout, verification, and sessions.
- `parents`: `/me` and parent/student lookup.
- `track-progress`: progress, summary, and recommendation workflows.
- `preferences`: notification settings.
- `ingestion`: future staff/system data entry.
- `notifications`: clock-triggered notification processing without HTTP routes.

The `auth` module is reserved for the final authentication and authorization
phase. Its routes and middleware remain unmounted until that integration.

Inside a module:

- `http/` maps transport requests to application calls.
- `application/` implements the workflow.
- `ports/` defines required repositories or external capabilities.

### `adapters/`

Translates domain inputs and outputs to external-service protocols. If a generator becomes internal later, its adapter can be replaced without changing controllers or models.

`GeneratorAdapter` and `GeneratorServiceAdapter` are diagram-facing facades over shared external HTTP clients. They preserve the two diagram names without duplicating provider logic.

### `infrastructure/`

Contains concrete technical implementations:

- MySQL pool, transactions, migrations, row mapping, and repositories.
- Durable job claiming, leasing, and retry behavior.
- Clock and schedule calculations.
- Password hashing and token implementation.
- Logging, metrics, and sensitive-data redaction.

SQL must be confined to migrations and MySQL repositories.

### `shared/`

Contains small domain-neutral helpers for identifiers, time conversion, idempotency, and result handling. Business rules must not accumulate here.

### `types/`

Extends Express request typing with the authenticated user, request ID, and authorized student context so controllers do not need unsafe casts.

### `test/`

- `unit`: isolated domain and application tests using injected fakes.
- `http`: Express router, middleware, controller, validation, and response-envelope tests using Supertest.
- `integration`: real MySQL and controlled-provider boundary tests.
- `contract`: verifies frontend and external-service request/response shapes.
- `e2e`: exercises complete API and worker workflows.
- `fixtures`: fictional reusable test data.

Jest is the only test runner. `ts-jest` transforms TypeScript for the test
process, and Supertest exercises the Express application without opening a
fixed network port. Production code continues to compile as ESM with NodeNext;
`tsconfig.test.json` compiles tests as CommonJS and maps production `.js`
import suffixes back to TypeScript modules. MySQL-backed integration and end-to-end
suites run serially so they cannot mutate shared test state concurrently.

## 8. Database and Repository Rules

The initial table mapping and constraint decisions are recorded in
[`database-schema.md`](database-schema.md). The following rules apply to the
SQL migrations and their future repository implementations:

- Use MySQL 8.x with InnoDB.
- Use `mysql2/promise` with one configured pool per process.
- Use parameterized statements for all dynamic values.
- Run migrations through the portable `migrate` entrypoint using the validated
  `MYSQL_*` environment settings; never embed a developer-specific path or
  credential in migration code.
- Use `DATE` for dates without time and UTC `DATETIME(3)` for timestamps.
- Use foreign keys for diagram relationships.
- Use transactions for related database changes.
- Do not keep a transaction open while calling a generator or email provider.
- Normalize email values at the domain boundary and reject non-normalized email
  values at the database boundary.
- Keep recurring read and worker-query indexes in a dedicated numbered
  migration, with each index tied to a documented query shape.
- Store immutable summary history rather than overwriting prior summaries.
- Allow multiple summary snapshots for the same student and source progress version when separate requests or schedules generate them.
- Link each recommendation to its basis summary.
- Link each email notification to one summary and one receiving parent.
- Link each durable notification job to its generated summary and email notification when processing completes; keep the original `scheduled_for` value separate from `retry_at`.
- Record staff/system mutations in `audit_events`.

## 9. External Service Boundaries

### Summary generator

Accepts student context and ordered progress records. Returns summary content and optional provider metadata. The backend validates the result before saving it.

### Recommendation generator

Accepts the latest summary. Returns recommendation content and optional provider metadata. The backend stores the basis summary relationship.

### Email provider

Accepts a prepared `EmailNotification`. Returns a provider delivery identifier or a failure result.

All provider calls require:

- Authentication configured outside source control.
- Request timeouts.
- Correlation and idempotency identifiers.
- Runtime response validation.
- Transient-only retries.
- Logs that exclude student records and generated content.

## 10. Notification Scheduling

The first version uses Singapore time:

- Weekly: Monday at 09:00.
- Fortnightly: Monday at 09:00 every fourteen days.
- Monthly: first day of the month at 09:00.

The worker safely claims due rows so multiple workers cannot send the same notification. A lease allows recovery if a worker crashes. The original `scheduled_for` time remains stable while transient provider failures use a separate `retry_at` and capped backoff. Each failure records `failed_at` and `last_error` for investigation, including after retries are exhausted.

The schedule applies per parent preference, but execution remains student-scoped to follow the sequence diagram.

## 11. Security and Privacy

- Store password hashes, never plaintext passwords.
- Require TLS for deployed API, MySQL, and provider connections.
- Keep secrets in environment-specific secret storage.
- Enforce guardian authorization for every student route.
- Restrict ingestion to staff or trusted-system account types.
- Validate all untrusted request and provider data at runtime.
- Apply request-size and rate limits.
- Redact passwords, tokens, student notes, summaries, and recommendations from logs.
- Audit sensitive data changes.
- Define database backup, retention, and restoration procedures before production use.

## 12. Testing and Acceptance Criteria

Use `.test.ts` filenames throughout. Run fast unit, HTTP, and contract tests
without MySQL; run integration and end-to-end suites against an isolated test
database. The default Jest configuration excludes `test/integration/`; the
serial integration command uses `jest.integration.config.cjs` and explicit
`MYSQL_TEST_*` connection variables. Prefer dependency injection and explicit
fakes for application services. Use Jest mocks at technical boundaries only,
Jest fake timers for the notification clock, and controlled HTTP servers for
provider-adapter tests.

The implementation is acceptable when all of the following hold:

1. The existing frontend runs without changing its routes or response types.
2. Track Progress follows controller -> model -> progress repository -> summary adapter -> summary service.
3. Missing progress follows the `progressUnavailable` branch.
4. Recommendations are generated only after an explicit parent request and use the latest summary.
5. Notify Parent follows clock -> notification controller -> notifier model -> summary generator -> email provider.
6. Email success and failure branches are both persisted.
7. Each notification references exactly one parent and one summary.
8. Diagram relationships are enforced through foreign keys and application validation.
9. Parents cannot access unrelated students.
10. Parents cannot call staff/system ingestion routes.
11. Raw SQL repositories pass integration tests against real MySQL.
12. Concurrent summary requests and notification-worker claims do not create unintended duplicates.
13. Generator timeouts, malformed responses, email failures, worker crashes, and database outages fail safely and observably.
14. `npm run typecheck`, `npm run build`, `npm test`, `npm run test:integration`, `npm run test:contract`, and `npm run test:e2e` pass.

## 13. Recorded Decisions and Assumptions

- Use raw Express and TypeScript.
- Use Jest, `ts-jest`, and Supertest for all backend testing; do not introduce Vitest.
- Keep production compilation on ESM/NodeNext and use CommonJS only in the Jest test transform.
- Use `mysql2/promise` and plain SQL migrations.
- Do not introduce Prisma, another ORM, Redis, or a microservice split initially.
- Keep the API and worker in one repository but run them as separate processes.
- Treat summary, recommendation, and email services as external through replaceable adapters.
- Preserve the current frontend's routes and response envelope.
- Serve the frontend and `/api` from one public origin; do not expose cross-origin browser API access.
- Route `/` to the React application and `/api/*` to Express at the public web host.
- Use routers explicitly; controllers do not register their own URLs.
- Generate summaries during Track Progress, Request Summary, and Notify Parent, not during ingestion.
- Generate recommendations only on explicit parent request.
- Send one scheduled email per student with one attached summary.
- Keep Notification Preferences, ingestion, durable jobs, audit records, and observability as supporting extensions to the UML diagrams.
