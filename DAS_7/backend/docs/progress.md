# DAS 7 Backend Progress

## Current Status

**Architecture revision:** Planned, not started

**Next work:** Revision Phase R1 in [`revision-plan.md`](revision-plan.md)

**Feature plan:** Paused until the complete revision plan passes

The target architecture now uses Supabase for PostgreSQL and Auth integration,
a provider-neutral online LLM boundary, and a separate DAS 7 API and worker.

The architecture and implementation documents have been revised. No Supabase
implementation, MySQL removal, identity refactor, or routing change has been
performed yet.

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
| R1 | Capture the baseline and establish revision safety gates | Pending |
| R2 | Add the local Supabase foundation and configuration | Pending |
| R3 | Create the PostgreSQL `insight` schema and RPCs | Pending |
| R4 | Refactor identity ownership and the domain boundary | Pending |
| R5 | Implement Supabase clients, mappers, repositories, and readiness | Pending |
| R6 | Integrate JWT verification and gateway-aligned routing | Pending |
| R7 | Restore existing workflows and tests on Supabase | Pending |
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
| 13 | Cross-team integration and final acceptance | Blocked by revision |

Authentication lifecycle implementation and frontend implementation are not
DAS 7 phases.

## Progress Rules

- Execute revision phases in order.
- Keep at most one revision phase marked `In progress`.
- Do not mark a revision phase done until its verification gate passes.
- Record commands and test results under the completed revision phase.
- Preserve existing behavior before deleting its superseded implementation.
- Update this file whenever a revision or feature phase is completed.
- Do not add completion or update dates.
- Update [`revision-plan.md`](revision-plan.md) or [`plan.md`](plan.md) when the
  approved sequence changes.
