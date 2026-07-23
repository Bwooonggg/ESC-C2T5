# DAS 7 Backend Progress

## Current Status

**Architecture revision:** R1 through R5 complete; R6 next

**Next work:** Revision Phase R6 in [`revision-plan.md`](revision-plan.md)

**Feature plan:** Paused until the complete revision plan passes

The target architecture now uses Supabase for PostgreSQL and Auth integration,
a provider-neutral online LLM boundary, and a separate DAS 7 API and worker.

Implementation and the later dedicated testing phase use a Supabase-hosted
development project. No local Supabase database is planned. The production
project remains unlinked until the final production handoff.

Existing tests remain as the pre-revision baseline. New or substantially
rewritten permanent test files are deferred until all revision and feature
implementation phases are complete.

The version-controlled Supabase CLI foundation and the first hosted `insight`
schema migration chain and Supabase persistence boundary are now present.
Identity ownership has been refactored; JWT verification, gateway-aligned
routing, workflow composition, LLM consolidation, and final MySQL removal
remain in later revision phases.

## Why the Plan Is Paused

The current implementation was built against assumptions that are no longer
valid:

- DAS 7 uses MySQL and a custom MySQL migration runner.
- Credential-related fields and repository contracts are modeled locally.
- Express mounts an internal `/api` prefix.
- Summary and recommendation generation are configured as two external
  generator services.
- The old remaining plan included a DAS 7-owned authentication phase.

Continuing directly with ingestion or notifications would add new work to an
infrastructure and ownership model that is being replaced.

Complete [`revision-plan.md`](revision-plan.md) before resuming
[`plan.md`](plan.md) at Phase 9.

## Completed Feature Baseline

The following behavior exists and should be preserved during the revision.

| Original phase | Description | Current interpretation |
| --- | --- | --- |
| 0 | Scaffold, dependencies, Jest, and health routes | Reusable |
| 1 | Typed configuration and separate API/worker containers | Reusable after environment revision |
| 2 | Domain entities, value objects, ports, and domain errors | Mostly reusable; identity concepts need revision |
| 3 | MySQL relational schema and migrations | Historical only; replace with Supabase/PostgreSQL |
| 4 | MySQL mappers, repositories, and transactions | Historical only; replace with Supabase adapters and RPCs |
| 5 | Generator ports, adapters, HTTP client, validation, and timeouts | Partly reusable; refactor to one LLM boundary |
| 6 | Track Progress and Summary workflow | Preserve and revalidate |
| 7 | Recommendation workflow | Preserve and revalidate |
| 8 | Notification Preferences workflow | Preserve and revalidate |

## Reusable Work

- TypeScript, Express.js, ESM/NodeNext, Jest, `ts-jest`, and Supertest setup.
- Four-space indentation convention.
- API and worker composition separation.
- Domain validation for students, progress records, summaries,
  recommendations, preferences, and email notifications.
- Repository and provider port pattern.
- `TrackProgressModel`.
- `RecommendationModel`.
- Summary snapshot/version revalidation.
- Concurrent summary-generation coalescing.
- Track Progress, Summary, Recommendation, and Preference controllers.
- Standard `{ "ok": true, "data": ... }` and
  `{ "ok": false, "error": "..." }` envelopes.
- Runtime validation of generator output.
- Request correlation and invocation metadata.
- Existing unit and HTTP test scenarios.
- Existing database-backed behavior tests as behavioral specifications.

## Work That Will Be Superseded

- `mysql2` and MySQL configuration.
- The MySQL pool, migration runner, transaction manager, mappers, and
  repositories.
- `db/migrations` and MySQL integration-test configuration.
- Local credential fields such as password hash and verification state.
- The local account-type model where it exists only for authentication or
  authorization.
- User and session repository contracts that are not needed by DAS 7.
- The deferred DAS 7 authentication implementation phase.
- Internal Express `/api` mounting.
- Separate summary-generator and recommendation-generator URLs.

Do not delete superseded work until its Supabase replacement passes the
corresponding parity tests.

## Last Verified Pre-Revision Baseline

The following commands passed before the architecture pivot:

```powershell
npm run typecheck
npm run build
npm test
npx tsc --noEmit -p tsconfig.test.json
npm run test:http
npm run test:coverage
npm run test:integration
```

Recorded results:

- 17 unit/HTTP Jest suites passed.
- 82 unit/HTTP tests passed.
- 3 MySQL integration suites passed.
- 12 MySQL integration tests passed.
- Track Progress, Recommendation, and Notification Preferences passed
  database-backed end-to-end scenarios.

These are historical baseline results, not evidence that the Supabase target
has been implemented.

## Revision R1 Verification

R1 captured the current implementation baseline and identified the work that
must be replaced or revalidated during the Supabase revision.

### Environment

- Node.js: `v24.8.0`
- npm: `11.16.0`
- Installed package tree recorded with `npm ls --depth=0`.

### Database-free verification

The following checks passed:

```powershell
npm run typecheck
npm run build
npm test
npm run test:http
```

Results:

- 17 Jest suites passed.
- 82 tests passed.
- 4 HTTP suites passed.
- 16 HTTP tests passed.

### Current database integration verification

After the MySQL service was enabled, `npm run test:integration` passed:

- 3 MySQL integration suites passed.
- 12 MySQL integration tests passed.

The earlier `ECONNREFUSED 127.0.0.1:3306` result was an environment outage,
not a test failure. MySQL integration will eventually be replaced by tests
against the hosted Supabase development project during the dedicated testing
phase.

### Impact inventory

- MySQL coupling exists in `mysql2`, MySQL configuration, the API container,
  migration entrypoint, MySQL infrastructure, SQL migrations, and MySQL unit
  and integration tests.
- Local identity coupling exists in the `User` entity, `AccountType`, user and
  session ports, credential-related configuration/mappers, and tests.
- Express currently mounts the router under `/api`; the target service-local
  routes must instead rely on Traefik's `/api/insights` prefix stripping.
- Summary and recommendation generation currently use the separate generator
  adapter/client hierarchy and service-specific configuration; this will be
  refactored to a shared provider-neutral LLM client boundary.
- At the R1 baseline, no Supabase directory, dependency, client, or migration
  existed.

R1's baseline and impact-inventory gate is complete. The database-backed
baseline is now reproducible with the MySQL service enabled and does not change
the approved revision sequence.

## Revision R2 Progress

The implementation portion of R2 is complete:

- Exact-pinned `@supabase/supabase-js` and `supabase` CLI packages are installed.
- The project-pinned CLI reports version `2.109.1`.
- `supabase/config.toml` is committed to the project structure and targets the
  future `insight` schema.
- Local Supabase seeding is disabled; no `seed.sql` was created.
- Migration and generated-type directories are tracked without adding test
  files.
- Supabase environment fields and hosted-project CLI scripts are available.
- The existing typecheck, build, and 82-test Jest baseline still pass.

At the completion of R2, the CLI was authenticated and linked to the hosted
project now designated for DAS7. The eight migration records from the previous
project were repaired as reverted in the migration-history table only. The old
`private` and `test` tables remain untouched and have zero estimated rows.
Linked migration status and the dry-run push both succeeded; no DAS7
migration, schema, or data had been applied at that checkpoint.

## Revision R3 Progress

The PostgreSQL schema and database boundary implementation is complete for the
hosted development project:

- Four imperative migrations were created with the project-pinned Supabase
  CLI and applied after a successful linked dry run.
- The `insight` schema contains the parent/student projections, guardian
  relationships, progress records, summaries, recommendations, notification
  preferences, email notifications, durable notification jobs, idempotency
  records, and audit events required by the approved diagrams.
- PostgreSQL constraints preserve required identifiers and text, score and
  version ranges, allowed skill areas and notification frequencies, normalized
  email addresses, correction provenance, summary/recommendation ownership,
  notification state transitions, scoped idempotency, and append-only audit
  behavior.
- Query-driven indexes cover guardian lookup, ordered progress, latest
  summaries, recommendation history, pending/leased jobs, delivery history,
  audit investigation, idempotency cleanup, and source-record deduplication.
- `SECURITY INVOKER` RPCs provide atomic progress insertion/correction with
  version advancement and idempotency, plus notification-job claiming and
  owner-checked completion/failure transitions.
- RLS is enabled on every `insight` table. The schema and explicit role grants
  are in place, while ownership and ingestion policies remain deliberately
  absent until the platform/Auth team supplies the claims contract in R6.
- The `insight` schema is exposed through the hosted project's Data API, and
  generated TypeScript definitions are stored under
  `src/infrastructure/supabase/generated/database.types.ts`.
- The initial config push was reviewed and the final hosted configuration
  preserves the project's existing Auth and Storage settings; only the
  approved `insight` Data API exposure was added.

### R3 verification

The following checks passed after the migrations and generated types were
applied:

```powershell
npm run supabase:db:push:dry-run
npm run supabase:db:push
npm run supabase:migrations
npm run supabase:types
npm run typecheck
npm run build
npm test -- --runInBand
npx supabase db advisors --linked --type all --level warn --fail-on error
```

Results:

- Four local and remote migration versions are aligned.
- All 11 expected tables exist with RLS enabled.
- All seven expected functions are `SECURITY INVOKER`.
- Only the three worker job-transition functions have service-role execute
  grants; no anonymous function grants were added.
- Existing Jest verification remains green: 17 suites and 82 tests passed.
- Database advisors reported no revision-owned errors. The remaining warning
  belongs to a legacy `public` function from the repurposed development
  project, outside the new `insight` schema.
- No local Supabase service, reset, seed data, or production project linkage
  was used.

## Revision R4 Progress

The identity ownership and domain-boundary refactor is complete:

- Removed the DAS7 `User` entity, `AccountType` value object, auth router
  placeholder, user repository port, session repository port, and transitional
  MySQL user repository.
- `Parent` is now an independent projection with `parentId`, opaque
  platform-issued `authUserId`, display name, and guardian student IDs. It no
  longer inherits credential or platform-role state.
- Renamed the parent lookup port to `findByAuthUserId` and changed audit events
  from `actorUserId` to an opaque `actorSubject`.
- Added framework-neutral platform integration seams under
  `src/http/principal/`: verified access-token claims, an immutable
  `RequestPrincipal`, and an `AccessTokenVerifier` interface. These define the
  R6 boundary but do not verify tokens or implement authentication flows.
- Updated the transitional MySQL parent and audit adapters to ignore local
  credentials and map only projection/subject data. MySQL removal remains
  intentionally deferred to R9.
- Marked `docs/database-schema.md` as historical MySQL documentation and
  pointed it to the Supabase `insight` schema as the current source of truth.

### R4 verification

```powershell
npm run typecheck
npm run build
npm test -- --runInBand
```

Results:

- Typecheck and build passed.
- 13 existing suites and 51 tests passed unchanged.
- Four historical suites did not compile because they still import the removed
  credential model or MySQL user repository. They are recorded as deferred
  identity-refactor cases (`domain/entities`, `domain/value-objects`,
  `mysql-row-mappers`, and `mysql-repositories`); no permanent test files were
  changed.
- A source search found no DAS7 `User`, `AccountType`, password-hash,
  verification-state, session-port, or user-repository implementation.
- No Supabase Auth SDK types or authentication lifecycle implementation were
  added.

## Revision R5 Progress

The Supabase infrastructure boundary is complete without moving authentication
or authorization ownership into DAS7:

- Added separate request-scoped publishable-key and worker-only secret-key
  Supabase client factories. The API container accepts an injected readiness
  probe but cannot construct the worker secret client.
- Added typed runtime row schemas and strict row-to-domain mappers for the
  `insight` tables, plus domain-to-insert/update mappers for persistence.
- Added Supabase repository adapters for parents, guardian relationships,
  students, progress records, summaries, recommendations, notification
  preferences, email notifications, notification jobs, audit events, and
  idempotency records.
- Added wrappers for the R3 progress-record and notification-job RPCs. Progress
  writes use the RPC so version advancement, audit, and idempotency remain one
  database operation; job claiming and state transitions remain lease-owned.
- Added deterministic ordering to list/latest queries and a bounded Supabase
  readiness probe that returns no protected data.
- Added the worker-only Supabase persistence graph, including a process-scoped
  lease owner for notification-job RPCs. The API container has no secret-key
  client or worker persistence property.
- Added the required `studentId` persistence projection to
  `EmailNotification`, matching the Supabase composite foreign keys. The
  transitional MySQL adapter was updated only enough to keep the source
  boundary compiling; MySQL remains historical until R9.

### R5 verification

```powershell
npm run typecheck
npm run build
npm run test:http -- --runInBand
```

Results:

- Typecheck passed with the generated hosted-project database types.
- Build passed.
- Four HTTP Jest suites and 16 tests passed.
- The full Jest command still stops at the same four historical identity/MySQL
  suites recorded under R4; the failures are stale imports and fixtures, not
  Supabase R5 failures.
- No permanent Supabase repository or provider test files were added; the
  mapper, repository, RPC, readiness, and client-separation cases remain in
  the dedicated testing backlog.

## Documentation Pivot

| Document | Status |
| --- | --- |
| [`backend-architecture.md`](backend-architecture.md) | Updated to the Supabase target |
| [`revision-plan.md`](revision-plan.md) | Created as the mandatory migration sequence |
| [`plan.md`](plan.md) | Updated and paused at Phase 9 |
| `progress.md` | Updated to distinguish legacy completion from revision work |
| [`overall-architecture.md`](overall-architecture.md) | Source platform context; reconciliation is included in the revision plan |

## Revision Tracking

| Revision phase | Description | Status |
| --- | --- | --- |
| R1 | Capture the baseline and establish revision safety gates | Done |
| R2 | Add the hosted Supabase development foundation and configuration | Done |
| R3 | Create the PostgreSQL `insight` schema and RPCs | Done |
| R4 | Refactor identity ownership and the domain boundary | Done |
| R5 | Implement Supabase clients, mappers, repositories, and readiness | Done |
| R6 | Integrate JWT verification and gateway-aligned routing | Next |
| R7 | Restore existing workflows on Supabase | Pending |
| R8 | Refactor generator infrastructure to the shared LLM boundary | Pending |
| R9 | Remove MySQL and obsolete authentication infrastructure | Pending |
| R10 | Complete revision verification and documentation | Pending |

## Post-Revision Feature Tracking

These phases remain blocked until R1 through R10 are complete.

| Phase | Description | Status |
| --- | --- | --- |
| 9 | Versioned data ingestion | Blocked by revision |
| 10 | Connect the online LLM provider | Blocked by revision |
| 11 | Notification worker and email provider | Blocked by revision |
| 12 | Packaging and operational hardening | Blocked by revision |
| 13 | Dedicated testing and verification | Blocked by revision |
| 14 | Cross-team integration and production handoff | Blocked by revision |

Authentication lifecycle implementation and frontend implementation are not
DAS 7 phases.

## Progress Rules

- Execute revision phases in order.
- Keep at most one revision phase marked `In progress`.
- Do not mark a revision phase done until its verification gate passes.
- Record commands and test results under the completed revision phase.
- Preserve existing behavior before deleting its superseded implementation.
- Do not add or substantially rewrite permanent test files before the dedicated
  testing phase; record cases in the testing backlog instead.
- Update this file whenever a revision or feature phase is completed.
- Do not add completion or update dates.
- Update [`revision-plan.md`](revision-plan.md) or [`plan.md`](plan.md) when the
  approved sequence changes.
