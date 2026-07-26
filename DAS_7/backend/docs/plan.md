# DAS 7 Backend Implementation Plan

**Status:** Paused until [`revision-plan.md`](revision-plan.md) is complete.
R6A and R6B are complete; platform-auth integration is deferred to R6C.

**Architecture:** [`backend-architecture.md`](backend-architecture.md)

**Testing stack:** Jest, `ts-jest`, and Supertest

**Testing timing:** Preserve existing tests, but defer new or substantially
rewritten permanent test files until Phase 13 after Phases 9 through 12 are
implemented.

## 1. How to Use This Plan

The original implementation completed Phases 0 through 8 against MySQL. The
project architecture has since changed to Supabase and platform-owned identity.

Do not continue with the next feature phase yet. R6B's non-authentication
connectivity and persistence smoke checks against the hosted development
Supabase project are complete. The next revision gate is R6C, which cannot
start until the platform/authentication team provides the token and claims
contract.

Do not begin R6C or the feature phases until the platform/authentication team
provides the token and claims contract. A testing Supabase project does not
replace that external contract and must not be used to create an authentication
bypass.

Execute [`revision-plan.md`](revision-plan.md) from beginning to end first. That
revision will:

- Replace MySQL with Supabase.
- Remove DAS 7-owned credential and session concepts.
- Prepare the service boundary for Supabase JWT verification without
  implementing Auth flows; the actual token integration is deferred to R6C.
- Align internal routes with the `/api/insights` gateway prefix.
- Validate the existing Supabase clients, repositories, and RPCs against the
  hosted development project.
- Replace the two generator-service clients with a provider-neutral LLM
  boundary.
- Restore the already implemented DAS 7 workflows on the hosted development
  project.

Once every revision completion gate passes, resume this plan at Phase 9.

During Phases 9 through 12, record required test scenarios in the testing
backlog. Use typecheck, build, existing applicable tests, migration previews,
and narrowly scoped hosted-development smoke checks for implementation
feedback. Create the permanent revised/new test files together in Phase 13.

## 2. Previously Completed Feature Baseline

These phases describe implemented behavior that the revision must preserve.
Their MySQL-specific infrastructure is not part of the target system.

| Phase | Feature baseline | Status |
| --- | --- | --- |
| 0 | Backend scaffold, TypeScript, Express, and Jest | Completed |
| 1 | Typed configuration and API/worker composition | Completed; revision required |
| 2 | Domain entities, value objects, ports, and errors | Completed; identity revision required |
| 3 | Relational schema and migrations | Completed for MySQL; superseded |
| 4 | Repositories and transactions | Completed for MySQL; superseded |
| 5 | External generator boundaries | Completed; LLM revision required |
| 6 | Track Progress and Summary | Completed; Supabase revalidation required |
| 7 | Recommendations | Completed; Supabase revalidation required |
| 8 | Notification Preferences | Completed; Supabase revalidation required |

## Phase 9: Implement Versioned Data Ingestion

### Goal

Allow other trusted platform components to push normalized DAS 7 data without
creating a runtime dependency on their APIs or databases.

### APIs

Expose service-local versioned routes under `/v1`; Traefik publishes them under
`/api/insights/v1`.

Implement:

- Upsert a parent projection using a canonical platform parent ID and Supabase
  Auth user ID.
- Upsert a student projection using a canonical platform student ID.
- Assign or update a parent-student guardian relationship.
- Add one or more progress records.
- Correct an existing progress record without erasing its audit history.

The exact OpenAPI contract must be committed before controller implementation.

### Application behavior

1. Validate identifiers, dates, skill area, score precision, and required
   provenance.
2. Require a scoped idempotency key for every mutation.
3. Use an atomic Supabase RPC for each multi-table mutation.
4. Write the domain mutation, progress version, audit event, and idempotency
   outcome in one database transaction.
5. Return the stored outcome when a completed idempotency key is replayed.
6. Reject reuse of a key with a different request payload.
7. Do not generate a summary as part of ingestion.

### Authorization boundary

After R6C is completed, DAS 7 will verify the platform token and pass trusted
claims to Supabase. Staff/system claim assignment and the RLS policies that
allow ingestion are owned by the platform/authentication team. Until then,
ingestion remains a planned contract and is not enabled through a development
authentication shortcut.

### Deferred testing backlog

Record the following for Phase 13 without creating permanent test files yet:

- Unit cases for validation and application decisions.
- HTTP cases for every route and error envelope.
- Hosted Supabase integration cases for atomic writes and rollback.
- Idempotency replay and conflicting-payload cases.
- Progress-version advancement and append-only audit cases.
- Authorization contract cases using platform-provided identities.

**Done when:** valid writes are atomic and auditable, retries cannot duplicate
data, progress versions advance correctly in the hosted development project,
and all required test cases are recorded.

## Phase 10: Connect the Online LLM Provider

### Goal

Connect the existing summary and recommendation use cases to one selected
online LLM provider without leaking provider details into the application or
domain layers.

### Implementation

1. Select and pin the provider SDK or implement its HTTPS client.
2. Implement the provider-neutral `LlmClientPort`.
3. Keep summary and recommendation prompt construction in separate adapters.
4. Request structured output and validate every response with Zod.
5. Map provider authentication, rate limits, timeouts, malformed responses,
   refusals, and outages to existing generator errors.
6. Persist provider, model, prompt version, provider request ID, and generation
   time.
7. Send only data required for the generation operation.
8. Keep API keys, prompts, and generated student content out of logs.
9. Preserve the deterministic fake-generator seams for the dedicated testing
   phase.

### Deferred testing backlog

Record the following for Phase 13:

- Controlled provider success responses.
- Malformed and incomplete structured output.
- Authentication failure and rate limiting.
- Timeout and abort behavior.
- Retryable and non-retryable errors.
- Summary and recommendation prompt-version metadata.
- Sensitive-value redaction.

**Done when:** one configured provider supports both generation workflows and
can be replaced without modifying controllers, application use cases, or
domain entities, and the provider test backlog is complete.

## Phase 11: Implement the Notification Worker and Email Provider

### Goal

Complete the Notify Parent sequence diagram with durable scheduling, fresh
summary generation, replaceable email delivery, and safe recovery from
failures.

### Application objects

Implement the two application objects named by `sequenceDiagram7_2.puml`:

- The worker loop plays `NotificationController` and the `Clock` actor. It has
  no HTTP surface, so `modules/notifications/` gains an `application/`
  directory but no `http/` directory.
- `NotifierModel` owns `notifyParent(student)`: job lease, summary generation,
  email-notification record, delivery, and terminal state.

`NotifierModel` must not duplicate the snapshot-consistency logic that already
exists in `TrackProgressModel`. It obtains its summary through the shared
`GenerateStudentSummary` capability extracted in revision phase R8
(`modules/summaries/`). This phase is blocked until that extraction is done.

### Worker behavior

1. Calculate due work from parent notification preferences.
2. Create or reuse one job for each parent-student schedule occurrence.
3. Atomically claim jobs through the Supabase job-claim RPC.
4. Call `GenerateStudentSummary`, which loads the student's progress snapshot,
   generates through `SummaryGeneratorPort`, revalidates the progress version,
   and persists the summary.
5. Persist the email-notification record and job linkage atomically.
6. Send through `EmailProviderPort` outside the database transaction.
7. Record sent or failed state.
8. Retry only transient failures with capped backoff.
9. Recover expired leases without running two workers on the same active job.

A parent with multiple children receives one email per child. There is no
public notification-trigger endpoint.

### Scheduling rules

- Use Singapore time for weekly, fortnightly, and monthly preferences.
- Store instants in UTC.
- Keep the original schedule occurrence stable across retries.
- Make terminal delivery transitions idempotent.

### Deferred testing backlog

Record the following for Phase 13:

- Jest fake-timer and fixed-clock cases.
- Weekly, fortnightly, and monthly due calculations.
- Disabled preferences and multiple children.
- Fresh summary generation and stale-version regeneration.
- Provider success and permanent/transient failure.
- Retry backoff, crash recovery, and expired leases.
- Concurrent worker claims and duplicate-delivery prevention.

**Done when:** the worker can execute the Notify Parent success and failure
paths against controlled development dependencies, concurrent claims are
handled by the database design, and all permanent test cases are recorded.

## Phase 12: Package and Harden DAS 7

### Goal

Produce deployable API and worker processes with safe operational behavior.

### Implementation

1. Create one production image with separate API and worker commands.
2. Listen on configurable `HOST` and `PORT`; use port `8000` in the platform.
3. Expose only the API through Traefik.
4. Add liveness and Supabase-aware readiness.
5. Add request IDs, structured logging, and sensitive-data redaction.
6. Add security headers, request body limits, and gateway-compatible rate
   limiting.
7. Add bounded timeouts for Supabase, LLM, and email operations.
8. Implement graceful API and worker shutdown.
9. Document environment configuration and secret ownership.
10. Document migration deployment, rollback, backup, and restore procedures.
11. Record the CI command requirements that Phase 13 will implement for unit,
    HTTP, Supabase integration, contract, and end-to-end suites.

### Deferred testing backlog

Record the following for Phase 13:

- API and worker container startup.
- API port `8000` and worker non-exposure.
- Traefik `/api/insights` prefix stripping.
- Missing or malformed production configuration.
- Supabase, LLM, and email outages.
- Graceful shutdown.
- Confirmation that no CORS configuration is present.

**Done when:** the API and worker can be deployed independently from the same
image, implementation smoke checks pass, and operational test cases are
recorded.

## Phase 13: Dedicated Testing and Verification

### Goal

Create and run the permanent automated test suite after all revision and
feature implementation work is complete.

### Test implementation

1. Review every deferred testing backlog from R2 through R10 and Phases 9
   through 12.
2. Remove or rewrite obsolete MySQL-era tests.
3. Add/update unit tests for domain entities, value objects, application use
   cases, scheduling, and error handling.
4. Add/update Supertest HTTP tests for service-local routes, validation,
   principals, middleware, and response envelopes.
5. Add hosted Supabase integration tests for migrations, repositories, RPCs,
   idempotency, ordering, leases, and RLS contracts.
6. Add controlled LLM and email provider integration tests.
7. Add API, ingestion, platform-claim, gateway, and provider contract tests.
8. Add end-to-end API and worker workflows.
9. Add the final CI scripts and coverage reporting.
10. Resolve all implementation defects found by the completed suite.

### Hosted-project safety

- Tests target only the Supabase-hosted development project.
- Test configuration rejects known production URLs and project references.
- Each run uses unique identifiers.
- Tests delete only records created by that run.
- Tests never use a linked-project reset or wipe the development database.
- No real parent, student, or production data is used.

### Acceptance commands

Run from `backend/`:

```powershell
npm run typecheck
npm run build
npm test
npm run test:http
npm run test:integration
npm run test:contract
npm run test:e2e
npm run test:coverage
```

**Done when:** the permanent Jest suite covers the completed implementation,
all commands pass against the hosted development environment where required,
and no unresolved defect remains.

## Phase 14: Cross-Team Integration and Production Handoff

### Goal

Verify DAS 7 against platform-owned interfaces without implementing another
team's responsibilities, then link and deploy to the production Supabase
project through an explicitly reviewed handoff.

### Platform integration

1. Validate the final Supabase access-token claim contract.
2. Run shared RLS contract tests using parent, staff/system, and worker
   identities.
3. Verify parents can access only students allowed by the platform policy.
4. Verify ingestion callers receive only their approved operations.
5. Verify the worker secret is restricted to the worker runtime.
6. Verify `/api/insights/*` gateway routing.
7. Verify the shared frontend consumes the documented DAS 7 API contract.
8. Record the compatible platform, frontend, and DAS 7 revisions.
9. Preview the full committed migration history against the production
   Supabase project.
10. Link or deploy to production only after the preview is reviewed.
11. Apply migrations without development data or test fixtures.
12. Replace development environment values with production secrets through the
    deployment environment.

If a test fails because a platform claim or RLS policy is missing, report it as
an external integration dependency. Do not add DAS 7 login, password, session,
or role-management code to work around it.

### Final acceptance

- Track Progress and Summary pass end to end.
- Recommendation generation passes end to end.
- Notification Preferences pass end to end.
- Ingestion is atomic, idempotent, and auditable.
- Scheduled notifications pass success, failure, retry, and recovery cases.
- No MySQL code, dependency, migration, or configuration remains.
- No DAS 7 authentication lifecycle or frontend implementation exists.
- No direct DAS 1/DAS 3 API or database dependency exists.
- Secrets and student content are absent from logs and committed fixtures.

**Done when:** all DAS 7 workflows pass through the platform gateway and
Supabase policy boundary using the production-shaped container setup, and the
reviewed migrations are deployed to the production project.

## Public API Contract

Public browser and platform clients use:

- `GET /api/insights/health`
- `GET /api/insights/health/ready`
- `GET /api/insights/me`
- `GET /api/insights/students/:studentId/track-progress`
- `GET /api/insights/students/:studentId/summary`
- `POST /api/insights/students/:studentId/recommendations`
- `GET /api/insights/parents/:parentId/preferences`
- `PUT /api/insights/parents/:parentId/preferences`
- `/api/insights/v1/*` for versioned ingestion

Express registers the same routes without `/api/insights`.

Successful responses use:

```json
{
    "ok": true,
    "data": {}
}
```

Failed responses use:

```json
{
    "ok": false,
    "error": "Public error message"
}
```

## Dedicated Test Organization

Phase 13 creates or updates:

- `test/unit/`: domain and application behavior using injected fakes.
- `test/http/`: service-local Express routes, middleware, validation, and
  envelopes.
- `test/integration/supabase/`: migrations, repositories, RPCs, and RLS
  contracts against the hosted development project.
- `test/integration/providers/`: LLM and email boundaries.
- `test/contract/`: HTTP, ingestion, token-claim, and provider contracts.
- `test/e2e/`: complete API and worker workflows.
- `test/fixtures/`: fictional and sanitized reusable test data.

Use `.test.ts` filenames. Prefer explicit fakes for business logic, Jest mocks
for narrow technical boundaries, and Jest fake timers for clock-controlled
behavior. Do not introduce Vitest.

Before Phase 13, preserve existing baseline tests but do not create or
substantially rewrite permanent test files. Implementation phases maintain a
documented testing backlog and use hosted-development smoke checks.

## Fixed Boundaries

- Supabase Auth is platform-owned.
- DAS 7 verifies incoming Supabase access tokens but does not issue or manage
  them.
- R6A and R6B intentionally stop before that token integration; they use only
  service-local routing and hosted-development Supabase smoke checks.
- Authorization claim creation and RLS policy design are external
  responsibilities.
- The frontend is external to DAS 7.
- Implementation and testing use a Supabase-hosted development project; no
  local Supabase database or local-storage framework is used.
- The production Supabase project is linked only during Phase 14.
- DAS 7 receives data through its ingestion APIs and does not query another
  subsystem.
- The Supabase Data API is the only DAS 7 application runtime database access
  path; the Supabase CLI remains responsible for migrations.
- The notification worker is the only DAS 7 runtime that receives a Supabase
  secret key.
- Summary and recommendation generation share a provider-neutral LLM client.
- Email delivery remains provider-neutral.
- API and worker run as separate processes.
- Public traffic is same-origin through `/api/insights`; no CORS configuration
  is required.
- Permanent new/revised test files are created together in Phase 13 after
  feature implementation.
