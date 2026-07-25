# Unit Tests

Unit test cases in `test/unit/`, grouped by module. Run with `npm run test:unit`.

## Adapters — generator integration
- Tested the summary and recommendation adapters mapping a domain progress snapshot / persisted summary onto their generator clients.
- Tested that a replaceable client failure is propagated unchanged.
- Tested `GeneratorHttpClient` with a well-formed request (JSON body plus correlation and idempotency headers), a malformed provider response (rejected without leaking the payload), provider status failures (mapped to provider-neutral errors), and a request that exceeds the timeout (aborted and normalized).

## Config — environment loading
- Tested `loadConfig` with safe development defaults, a complete production configuration, missing production values (reported together), and malformed values (rejected).

## Application containers
- Tested that separate API and worker containers are built from one shared configuration.

## HTTP — error mapping
- Tested `mapError` with `ProgressUnavailableError` (503 progressUnavailable), `SummaryUnavailableError` (404 summaryUnavailable), a recommendation generator failure (recommendationUnavailable) and a non-recommendation generator failure (summaryUnavailable), a `ZodError` (400 invalid request), a generic `DomainError` (400 with its own message), and an unknown error (generic 500).

## Infrastructure — Supabase date conversions
- Tested `parsePostgresTimestamp` with a valid timestamp, an unparseable value (throws), and error metadata (table/field named on the error).
- Tested `parsePostgresDate` with a valid ISO date, malformed strings (`2026/01/01`, `2026-1-1`, `26-01-01`, timestamp form, empty), and impossible calendar dates (`2026-02-30`, `2026-13-01`, `2026-00-10`, `2026-01-32`).
- Tested `toPostgresTimestamp` and `toPostgresDate` with a valid `Date`, an invalid `Date`, and (timestamp only) a non-`Date` value.

## Infrastructure — Supabase write support
- Tested `toProgressVersion` with valid versions (`v3`, `3`, `V0`, ` v12 `), non-version inputs (`-1`, `1.5`, `abc`, empty, `v`, `v-1`, `3v`), and field-name inclusion in the error.
- Tested `asJsonObject` and `asNullableJsonObject` returning a shallow clone, and the nullable variant returning `null` for `null`.

## Infrastructure — Supabase row → entity mappers
- Tested `mapParentRow`, `mapRecommendationRow`, and `mapNotificationPreferenceRow` mapping a valid row into the domain entity.
- Tested `mapStudentRow`, `mapProgressRecordRow`, and `mapSummaryRow` with a valid row and with an invalid date/timestamp (throws `SupabaseRowMappingError`).
- Tested `mapEmailNotificationRow` with an unsent notification (null `sentAt`), a sent notification (parsed `sentAt`), and an invalid `sent_at` timestamp.
- Tested `mapNotificationJobRow` with null optional timestamps preserved, a present optional timestamp parsed, and an invalid required timestamp (throws).
- Tested `mapAuditEventRow` mapping a valid row, and `mapIdempotencyRecordRow` with a valid row, a null response body, and a non-object response body (throws).

## Infrastructure — Supabase entity → insert/update mappers
- Tested `mapParentToInsert`, `mapParentStudentToInsert`, `mapStudentToInsert`, `mapSummaryToInsert`, `mapRecommendationToInsert`, `mapPreferenceToInsert`, and `mapAuditEventToInsert` producing the expected insert payloads (including progress-version normalization to a number).
- Tested `mapEmailNotificationToInsert` with a sent notification (serialized `sentAt`) and an unsent notification (null `sent_at`).
- Tested `mapNotificationJobToInsert` with null optional timestamps plus a lease owner, and with present optional timestamps.
- Tested `mapIdempotencyInputToInsert` producing a processing insert, and `mapIdempotencyTerminalToUpdate` for both the completed and failed branches.

## Application models — preferences
- Tested the preference models returning a stored preference, returning `null` when none exists, constructing/normalizing/persisting an updated preference, and refusing to persist an invalid recipient email.

## Application models — track progress
- Tested `TrackProgressModel` generating and persisting a summary from one snapshot, coalescing concurrent requests for the same snapshot, returning "progress unavailable" without calling the generator on empty records, regenerating with the same context on a version change, and not persisting on generator failure or invalid content.
- Tested `RecommendationModel` generating and persisting a recommendation from the latest summary, not persisting on generator failure, and not calling the generator when no summary exists.

## Domain — errors
- Tested that the validation, progress-unavailable, and summary-unavailable errors expose stable error codes.

## Domain — entities (⚠️ currently failing to compile — stale after the Supabase auth-model removal)
- Tested entity validation (rejecting invalid required fields), User identity/credential state, Parent modelling with guarded/frozen student IDs, Student and ProgressRecord creation, progress-score rules (0–100, ≤2 decimals, boundaries), Summary/Recommendation linkage, an invalid Summary source version, EmailNotification delivery-state consistency, and NotificationPreference creation/validation.

## Domain — value objects (⚠️ currently failing to compile — stale after the Supabase auth-model removal)
- Tested email address normalization/equality and rejection of malformed addresses, account types (accepted/rejected), the skill-area vocabulary, and notification frequencies.
